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
 * truncated JSON body. Thinking is MINIMAL, the Flash default: LOW pushed
 * responses past 20s in production. Older models reject thinkingLevel, so
 * they keep the low temperature instead.
 */
function generationTuning(model: string): Pick<GenerateContentConfig, "temperature" | "thinkingConfig"> {
  return /gemini-[3-9]/i.test(model)
    ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
    : { temperature: 0.2 };
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

export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
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

/** Google's transient failures: overloaded or briefly unavailable. Worth one retry. */
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const RETRY_DELAY_MS = 800;
/** Skip the retry when less than this is left of TIMEOUT_MS; it could not finish. */
const RETRY_MIN_BUDGET_MS = 8_000;

/**
 * generateContent with a single retry on transient provider errors. The
 * caller's abort signal still bounds the total time across both attempts.
 */
async function generate(apiKey: string, params: GenerateContentParameters): Promise<GenerateContentResponse> {
  const started = Date.now();
  try {
    return await getClient(apiKey).models.generateContent(params);
  } catch (error) {
    const transient = error instanceof ApiError && RETRYABLE_STATUS.has(error.status);
    if (!transient || TIMEOUT_MS - (Date.now() - started) < RETRY_MIN_BUDGET_MS) throw error;
    console.warn("[gemini] transient provider error, retrying once:", error.status);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return getClient(apiKey).models.generateContent(params);
  }
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
}

/** Analyse submitted text. Returns a typed failure instead of throwing. */
export async function analyzeWithGemini(content: string, options: TextOptions = {}): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return fail("NO_API_KEY");

  const model = getModelName();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await generate(apiKey, {
      model,
      contents: buildAnalysisPrompt(content, options),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        ...generationTuning(model),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: controller.signal,
      },
    });

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
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return fail("NO_API_KEY");

  const model = getModelName();
  if (!supportsVision(model)) return fail("VISION_UNSUPPORTED");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await generate(apiKey, {
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
        abortSignal: controller.signal,
      },
    });

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
