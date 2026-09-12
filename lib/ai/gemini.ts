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

import { GoogleGenAI } from "@google/genai";
import { aiAnalysisSchema, GEMINI_RESPONSE_SCHEMA, normalizeAiAnalysis } from "./schema";
import { buildAnalysisPrompt, buildImagePrompt, SYSTEM_INSTRUCTION } from "./prompts";
import type { AiAnalysis } from "../../types/analysis";

const DEFAULT_MODEL = "gemini-2.0-flash";
const TIMEOUT_MS = 20_000;

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
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/abort|timeout|timed out/i.test(text)) return "TIMEOUT";
  if (/429|rate|quota|exhausted/i.test(text)) return "RATE_LIMITED";
  return "PROVIDER_ERROR";
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
    const response = await getClient(apiKey).models.generateContent({
      model,
      contents: buildAnalysisPrompt(content, options),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        // Low temperature: this is an assessment, not a creative task. We want
        // the same message to score consistently across runs.
        temperature: 0.2,
        maxOutputTokens: 2048,
        abortSignal: controller.signal,
      },
    });

    const validated = validate(response.text);
    if ("parsed" in validated) return { ok: true, analysis: validated.parsed, model };
    return validated;
  } catch (error) {
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
    const response = await getClient(apiKey).models.generateContent({
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
        temperature: 0.2,
        maxOutputTokens: 2048,
        abortSignal: controller.signal,
      },
    });

    const validated = validate(response.text);
    if ("parsed" in validated) return { ok: true, analysis: validated.parsed, model };
    return validated;
  } catch (error) {
    return fail(classifyError(error));
  } finally {
    clearTimeout(timer);
  }
}
