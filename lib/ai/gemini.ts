import "server-only";

/**
 * Gemini service — the only place in the codebase that talks to an AI provider.
 *
 * `import "server-only"` at the top makes this a build-time error to import
 * from a client component, which is a stronger guarantee than remembering not
 * to. GEMINI_API_KEY is read from the server environment and never passed
 * outward; nothing here is exposed through NEXT_PUBLIC_.
 *
 * Design rule: this module never throws. Gemini being down must degrade
 * ScamShield to its deterministic engine, not break the request. Every failure
 * path returns a typed result the caller can render honestly.
 */

import {
  ApiError,
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentConfig,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";
import { aiAnalysisSchema, GEMINI_RESPONSE_SCHEMA, normalizeAiAnalysis } from "./schema";
import { buildAnalysisPrompt, buildImagePrompt, SYSTEM_INSTRUCTION } from "./prompts";
import type { AiAnalysis } from "../../types/analysis";

const DEFAULT_MODEL = "gemini-3.8-flash";
/**
 * Gemini 3.8 Flash can take 20s+ to fill the full schema. Kept below the
 * browser-side request timeouts (threat scanner 50s, analyzer 60s) so the
 * server always answers first, with the rule-based report if AI ran out.
 */
const TIMEOUT_MS = 38_000;
/** Room for the full schema (up to ~9k tokens of text) plus any model reasoning tokens. */
const MAX_OUTPUT_TOKENS = 8192;

/**
 * Gemini 3 tuning. Temperature stays at the model default (1.0): Google warns
 * that lowering it on Gemini 3 can cause looping, which here surfaces as a
 * truncated JSON body. Thinking is LOW: gemini-3.8-flash and 3.7-flash reject
 * MINIMAL with 400 INVALID_ARGUMENT, and LOW fits inside TIMEOUT_MS. If a
 * model rejects the level anyway, generate() retries it without one. Older
 * models reject thinkingLevel, so they keep the low temperature instead.
 */
function generationTuning(model: string): Pick<GenerateContentConfig, "temperature" | "thinkingConfig"> {
  return /gemini-[3-9]/i.test(model)
    ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
    : { temperature: 0.2 };
}

/** Google's 400 for a thinking setting the model does not accept. */
function isThinkingRejected(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400 && /thinking/i.test(error.message);
}

/** The same request with the thinking setting removed, leaving the model's own default. */
function withoutThinking(params: GenerateContentParameters): GenerateContentParameters {
  const { thinkingConfig: _dropped, ...config } = params.config ?? {};
  return { ...params, config };
}

export type AiFailureReason =
  | "NO_API_KEY"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "EMPTY_RESPONSE"
  | "INVALID_JSON"
  | "SCHEMA_VALIDATION_FAILED"
  | "VISION_UNSUPPORTED";

export type AiResult =
  | { ok: true; analysis: AiAnalysis; model: string }
  | { ok: false; reason: AiFailureReason; message: string };

/** User-facing copy for each failure. Never leaks provider internals. */
export const AI_FAILURE_MESSAGES: Record<AiFailureReason, string> = {
  NO_API_KEY: "AI analysis is not configured. ScamShield is using local security checks.",
  TIMEOUT: "AI analysis timed out. ScamShield is using local security checks.",
  RATE_LIMITED: "AI analysis is rate limited right now. ScamShield is using local security checks.",
  PROVIDER_ERROR: "AI analysis is currently unavailable. ScamShield is using local security checks.",
  EMPTY_RESPONSE: "AI analysis returned no result. ScamShield is using local security checks.",
  INVALID_JSON: "AI analysis returned an unreadable result. ScamShield is using local security checks.",
  SCHEMA_VALIDATION_FAILED: "AI analysis returned an invalid result and was discarded. ScamShield is using local security checks.",
  VISION_UNSUPPORTED: "Screenshot analysis requires a vision-capable Gemini model.",
};

export function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * The key as Google should see it. Values pasted into a dashboard often keep
 * the quotes from a .env line or stray whitespace, which Google rejects as
 * API_KEY_INVALID, so both are stripped.
 */
function readApiKey(): string | undefined {
  const raw = process.env.GEMINI_API_KEY?.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  return raw || undefined;
}

export function isAiConfigured(): boolean {
  return Boolean(readApiKey());
}

/**
 * Vision support is model-dependent. We check the configured name rather than
 * attempting an upload and interpreting the error, because a failed multimodal
 * call costs the user a round trip to learn something we can infer for free.
 */
export function supportsVision(model = getModelName()): boolean {
  const m = model.toLowerCase();
  if (m.includes("embedding") || m.includes("imagen") || m.includes("tts")) return false;
  return m.includes("gemini-1.5") || m.includes("gemini-2") || m.includes("gemini-3") || m.includes("pro") || m.includes("flash");
}

let client: GoogleGenAI | null = null;
function getClient(apiKey: string): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

/** Map provider errors onto our reasons without surfacing provider detail. */
function classifyError(error: unknown): AiFailureReason {
  if (error instanceof ApiError) {
    // Status and Google's reason code only (e.g. API_KEY_INVALID) — the free
    // text of the message can echo request details.
    const code = /"reason":\s*"([A-Z_]+)"/.exec(error.message)?.[1] ?? /"status":\s*"([A-Z_]+)"/.exec(error.message)?.[1];
    console.warn("[gemini] provider error status:", error.status, code ?? "");
    return error.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR";
  }
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/abort|timeout|timed out/i.test(text)) return "TIMEOUT";
  // Word-bounded: a bare /rate/ also matched "generateContent" in unrelated errors.
  if (/\b429\b|quota|resource.?exhausted/i.test(text)) return "RATE_LIMITED";
  // Non-API failures (network, DNS, TLS) carry no request content, and the
  // name alone ("TypeError") is not enough to diagnose them.
  console.warn("[gemini] provider error:", text.slice(0, 160));
  return "PROVIDER_ERROR";
}

/**
 * Models tried, in order, when the primary cannot serve the request. Google
 * returns 503 UNAVAILABLE when a model is overloaded or has no capacity for
 * the key; in production gemini-3.8-flash did so for weeks. Order chosen from
 * /api/ai-status probes: 3.6 answered in under a second every time, 3.7 was
 * slower and sometimes stalled, and the 2.5 models are 404 for this key.
 * Override with GEMINI_FALLBACK_MODELS (comma-separated; empty disables).
 */
const DEFAULT_FALLBACK_MODELS = "gemini-3.6-flash,gemini-3.7-flash";

export function getModelChain(): string[] {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACK_MODELS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([getModelName(), ...fallbacks])];
}

/**
 * Statuses where another model can still answer: overloaded or unavailable
 * (5xx), per-model quota exhausted (429), or model not available (404).
 * Anything else — a bad key, a rejected request — would fail on every model.
 */
const FAILOVER_STATUS = new Set([404, 429, 500, 502, 503, 504]);
const FAILOVER_DELAY_MS = 400;
/** Stop failing over when less than this is left of TIMEOUT_MS; a new model could not finish. */
const FAILOVER_MIN_BUDGET_MS = 8_000;
/**
 * Longest one model may take before the next is tried. On the free tier a
 * model under load can accept a request and never answer; a normal full
 * analysis finishes in 2-10s.
 */
const ATTEMPT_TIMEOUT_MS = 14_000;
/** Passes over the model chain before giving up, budget permitting. */
const CHAIN_ROUNDS = 2;
const ROUND_PAUSE_MS = 1_500;

/**
 * generateContent across the model chain. `build` makes the request for a
 * given model; the caller's abort signal bounds the total time for all tries.
 */
async function generate(
  apiKey: string,
  models: string[],
  build: (model: string, signal: AbortSignal) => GenerateContentParameters,
  outer: AbortSignal,
  trace?: string[],
): Promise<{ response: GenerateContentResponse; model: string }> {
  const started = Date.now();
  const note = (entry: string) => trace?.push(`${entry} @${Date.now() - started}ms`);
  const statusOf = (e: unknown) => (e instanceof ApiError ? String(e.status) : e instanceof Error ? e.name : "error");
  // Two passes over the chain: Google's 503s are often gone a second later.
  const attempts = Array.from({ length: CHAIN_ROUNDS }, () => models).flat();
  // A model that stalled once is not given a second full attempt.
  const stalledModels = new Set<string>();
  let lastError: unknown = new Error("No Gemini model attempted");

  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    if (stalledModels.has(model)) continue;
    const remaining = TIMEOUT_MS - (Date.now() - started);
    if (i > 0 && remaining < FAILOVER_MIN_BUDGET_MS) break;
    // Cap each attempt so one stalled model cannot spend the whole budget.
    const attemptLimit = AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining));
    const params = build(model, AbortSignal.any([outer, attemptLimit]));
    try {
      try {
        const response = await getClient(apiKey).models.generateContent(params);
        note(`${model}: ok`);
        return { response, model };
      } catch (error) {
        note(`${model}: ${attemptLimit.aborted && !outer.aborted ? "attempt timeout" : statusOf(error)}`);
        if (!isThinkingRejected(error) || !params.config?.thinkingConfig) throw error;
        console.warn(`[gemini] ${model} rejected the thinking setting, retrying with its default`);
        const response = await getClient(apiKey).models.generateContent(withoutThinking(params));
        note(`${model} (default thinking): ok`);
        return { response, model };
      }
    } catch (error) {
      lastError = error;
      const stalled = attemptLimit.aborted && !outer.aborted;
      const canFailover = stalled || (error instanceof ApiError && FAILOVER_STATUS.has(error.status));
      if (!canFailover) throw error;
      if (stalled) stalledModels.add(model);
      console.warn(`[gemini] ${model} ${stalled ? "stalled" : `returned ${statusOf(error)}`}, trying the next model`);
      // A longer pause before starting the chain again gives a demand spike time to pass.
      const pause = (i + 1) % models.length === 0 ? ROUND_PAUSE_MS : FAILOVER_DELAY_MS;
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
  }
  throw lastError;
}

export interface ModelProbe {
  model: string;
  ok: boolean;
  /** HTTP status from Google, when it answered with an error. */
  status?: number;
  /** Google's machine-readable reason, e.g. API_KEY_INVALID or SERVICE_DISABLED. */
  reason?: string;
  /** Google's error text, first 240 chars. Safe here: the probe sends only fixed text. */
  detail?: string;
  ms: number;
}

export interface AiStatus {
  configured: boolean;
  /** Shape check only; the key itself is never returned. */
  keyFormat: "missing" | "ok" | "unexpected";
  models: ModelProbe[];
}

/**
 * Diagnostic: one tiny request per model in the chain. Returns Google's status
 * and reason code for each, never the key or any message text.
 */
/** The real analysis request, so a full probe exercises the same schema and settings. */
function analysisRequest(model: string, contents: string, abortSignal: AbortSignal): GenerateContentParameters {
  return {
    model,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      ...generationTuning(model),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal,
    },
  };
}

/**
 * @param full send the real analysis request (schema, system instruction,
 *             thinking settings) instead of a bare one-word prompt
 */
export async function probeGemini(candidates: string[] = getModelChain(), full = false): Promise<AiStatus> {
  const apiKey = readApiKey();
  if (!apiKey) return { configured: false, keyFormat: "missing", models: [] };
  // Key formats vary (AIza…, newer styles), so only flag whitespace or quotes left inside.
  const keyFormat = /^[\w.-]{20,}$/.test(apiKey) ? "ok" : "unexpected";

  const models: ModelProbe[] = [];
  for (const model of candidates) {
    const started = Date.now();
    try {
      const signal = AbortSignal.timeout(full ? 30_000 : 15_000);
      const response = await getClient(apiKey).models.generateContent(
        full
          ? analysisRequest(model, buildAnalysisPrompt("Hi, running 10 minutes late. See you at the cafe."), signal)
          : { model, contents: "Reply with the single word OK.", config: { maxOutputTokens: 16, abortSignal: signal } },
      );
      const probe: ModelProbe = { model, ok: true, ms: Date.now() - started };
      if (full) {
        const validated = validate(response.text);
        if (!("parsed" in validated)) {
          probe.ok = false;
          probe.reason = validated.ok ? undefined : validated.reason;
          probe.detail = response.candidates?.[0]?.finishReason;
        }
      }
      models.push(probe);
    } catch (error) {
      const probe: ModelProbe = { model, ok: false, ms: Date.now() - started };
      if (error instanceof ApiError) {
        probe.status = error.status;
        probe.reason =
          /"reason":\s*"([A-Z_]+)"/.exec(error.message)?.[1] ?? /"status":\s*"([A-Z_]+)"/.exec(error.message)?.[1];
        probe.detail = (/"message":\s*"([^"]*)"/.exec(error.message)?.[1] ?? error.message).slice(0, 240);
      } else {
        probe.reason = error instanceof Error ? error.name : "UNKNOWN";
      }
      models.push(probe);
    }
  }
  return { configured: true, keyFormat, models };
}

/** Names of the text-generation models this key can call, for picking a working chain. */
export async function listAvailableModels(): Promise<string[]> {
  const apiKey = readApiKey();
  if (!apiKey) return [];
  const names: string[] = [];
  const pager = await getClient(apiKey).models.list({ config: { pageSize: 100 } });
  for await (const m of pager) {
    if (m.supportedActions?.includes("generateContent") && m.name) names.push(m.name.replace(/^models\//, ""));
  }
  return names.sort();
}

/** Log why a response ended early; a truncated JSON body otherwise surfaces only as INVALID_JSON. */
function logFinish(response: GenerateContentResponse): void {
  const reason = response.candidates?.[0]?.finishReason;
  if (reason && reason !== "STOP") console.warn("[gemini] finish reason:", reason);
}

function fail(reason: AiFailureReason): AiResult {
  return { ok: false, reason, message: AI_FAILURE_MESSAGES[reason] };
}

/** Shared validation path for text and vision responses. */
function validate(rawText: string | undefined): AiResult | { parsed: AiAnalysis } {
  if (!rawText || rawText.trim().length === 0) return fail("EMPTY_RESPONSE");

  // Strip code fences defensively — responseSchema should prevent them, but a
  // fenced payload is trivially recoverable and not worth failing the request.
  const cleaned = rawText.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return fail("INVALID_JSON");
  }

  const result = aiAnalysisSchema.safeParse(json);
  if (!result.success) {
    // Log the failure shape only — never the analysed content.
    console.warn("[gemini] schema validation failed:", result.error.issues.map((i) => i.path.join(".")).join(", "));
    return fail("SCHEMA_VALIDATION_FAILED");
  }

  return { parsed: normalizeAiAnalysis(result.data) };
}

interface TextOptions {
  ruleFindings?: string[];
  hostnames?: string[];
  /** Diagnostics only: receives one entry per model attempt. */
  trace?: string[];
}

/** Analyse submitted text. Returns a typed failure instead of throwing. */
export async function analyzeWithGemini(content: string, options: TextOptions = {}): Promise<AiResult> {
  const apiKey = readApiKey();
  if (!apiKey) return fail("NO_API_KEY");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const contents = buildAnalysisPrompt(content, options);

  try {
    const { response, model } = await generate(
      apiKey,
      getModelChain(),
      (model, signal) => analysisRequest(model, contents, signal),
      controller.signal,
      options.trace,
    );

    logFinish(response);
    const validated = validate(response.text);
    if ("parsed" in validated) return { ok: true, analysis: validated.parsed, model };
    options.trace?.push(`validation: ${validated.ok ? "" : validated.reason} (finish ${response.candidates?.[0]?.finishReason ?? "?"})`);
    return validated;
  } catch (error) {
    // Our own timer fired: that is a timeout however the runtime words the abort.
    if (controller.signal.aborted) return fail("TIMEOUT");
    return fail(classifyError(error));
  } finally {
    clearTimeout(timer);
  }
}

interface ImageOptions {
  base64Data: string;
  mimeType: string;
}

/**
 * Analyse a screenshot.
 *
 * If the configured model has no vision capability we say so plainly rather
 * than faking OCR, per the spec.
 */
export async function analyzeImageWithGemini({ base64Data, mimeType }: ImageOptions): Promise<AiResult> {
  const apiKey = readApiKey();
  if (!apiKey) return fail("NO_API_KEY");

  const models = getModelChain().filter((m) => supportsVision(m));
  if (models.length === 0 || !supportsVision(getModelName())) return fail("VISION_UNSUPPORTED");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { response, model } = await generate(apiKey, models, (model, signal) => ({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: buildImagePrompt() },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        ...generationTuning(model),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: signal,
      },
    }), controller.signal);

    logFinish(response);
    const validated = validate(response.text);
    if ("parsed" in validated) return { ok: true, analysis: validated.parsed, model };
    return validated;
  } catch (error) {
    // Our own timer fired: that is a timeout however the runtime words the abort.
    if (controller.signal.aborted) return fail("TIMEOUT");
    return fail(classifyError(error));
  } finally {
    clearTimeout(timer);
  }
}
