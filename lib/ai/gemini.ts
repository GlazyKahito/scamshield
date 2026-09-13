import "server-only";

import { aiAnalysisSchema, normalizeAiAnalysis } from "./schema";
import { buildAnalysisPrompt, buildImagePrompt, SYSTEM_INSTRUCTION } from "./prompts";
import type { AiAnalysis } from "../../types/analysis";

const DEFAULT_MODEL = "muse-spark-1.3-contributor-free";
const DEFAULT_BASE_URL = "https://opencode.ai/zen/v1";
const TIMEOUT_MS = 30_000;

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

export const AI_FAILURE_MESSAGES: Record<AiFailureReason, string> = {
  NO_API_KEY: "AI analysis is not configured. ScamShield is using local security checks.",
  TIMEOUT: "AI analysis timed out. ScamShield is using local security checks.",
  RATE_LIMITED: "AI analysis is rate limited right now. ScamShield is using local security checks.",
  PROVIDER_ERROR: "AI analysis is currently unavailable. ScamShield is using local security checks.",
  EMPTY_RESPONSE: "AI analysis returned no result. ScamShield is using local security checks.",
  INVALID_JSON: "AI analysis returned an unreadable result. ScamShield is using local security checks.",
  SCHEMA_VALIDATION_FAILED: "AI analysis returned an invalid result and was discarded. ScamShield is using local security checks.",
  VISION_UNSUPPORTED: "Screenshot analysis is not supported by the configured Muse model.",
};

export function getModelName(): string {
  return process.env.MUSE_MODEL?.trim() || DEFAULT_MODEL;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.MUSE_API_KEY?.trim());
}

export function supportsVision(_model = getModelName()): boolean {
  return true;
}

function getBaseUrl(): string {
  return process.env.MUSE_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

function classifyError(error: unknown): AiFailureReason {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);

  if (/abort|timeout|timed out/i.test(text)) return "TIMEOUT";
  if (/429|rate.?limit|quota|too many requests/i.test(text)) return "RATE_LIMITED";

  return "PROVIDER_ERROR";
}

function failure(reason: AiFailureReason, detail?: string): AiResult {
  return {
    ok: false,
    reason,
    message: detail ?? AI_FAILURE_MESSAGES[reason],
  };
}

function extractResponseText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  const data = payload as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const text = data.output
    ?.flatMap((item) => item.content ?? [])
    .filter((part) => typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  return text || undefined;
}

function validate(rawText: string | undefined): AiResult | { parsed: AiAnalysis } {
  if (!rawText || rawText.trim().length === 0) return failure("EMPTY_RESPONSE");

  const cleaned = rawText
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let json: unknown;

  try {
    json = JSON.parse(cleaned);
  } catch {
    return failure("INVALID_JSON");
  }

  const result = aiAnalysisSchema.safeParse(json);

  if (!result.success) {
    console.warn(
      "[muse] schema validation failed:",
      result.error.issues.map((issue) => issue.path.join(".")).join(", "),
    );
    return failure("SCHEMA_VALIDATION_FAILED");
  }

  return { parsed: normalizeAiAnalysis(result.data) };
}

interface TextOptions {
  ruleFindings?: string[];
  hostnames?: string[];
}

type MuseContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

interface MuseInput {
  role: "user";
  content: MuseContent[];
}

async function callMuse(input: MuseInput[]): Promise<AiResult> {
  const apiKey = process.env.MUSE_API_KEY?.trim();

  if (!apiKey) return failure("NO_API_KEY");

  const model = getModelName();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${getBaseUrl()}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions:
          `${SYSTEM_INSTRUCTION}\n\n` +
          "Return ONLY the final JSON object required by the ScamShield analysis schema. " +
          "Do not wrap it in markdown fences. Do not add commentary before or after the JSON.",
        input,
        reasoning: {
          effort: "minimal",
        },
        max_output_tokens: 4096,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const status = response.status;

      if (status === 401) {
        return failure(
          "PROVIDER_ERROR",
          "Muse API returned HTTP 401 (authentication failed). Check the OpenCode Zen API key in MUSE_API_KEY.",
        );
      }

      if (status === 403) {
        return failure(
          "PROVIDER_ERROR",
          "Muse API returned HTTP 403 (access denied). Check OpenCode Zen access for this key.",
        );
      }

      if (status === 429) {
        return failure(
          "RATE_LIMITED",
          "Muse Spark 1.3 Contributor Free is currently rate limited. ScamShield is using local security checks.",
        );
      }

      if (status === 400) {
        const body = await response.text().catch(() => "");
        const safeDetail = body.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 700);
        return failure(
          "PROVIDER_ERROR",
          `Muse API returned HTTP 400 (invalid request).${safeDetail ? ` Provider: ${safeDetail}` : ""}`,
        );
      }

      if (status >= 500) {
        return failure(
          "PROVIDER_ERROR",
          `Muse API returned HTTP ${status} (provider error). ScamShield is using local security checks.`,
        );
      }

      return failure(
        "PROVIDER_ERROR",
        `Muse API returned HTTP ${status}. ScamShield is using local security checks.`,
      );
    }

    const payload: unknown = await response.json();
    const validated = validate(extractResponseText(payload));

    if ("parsed" in validated) {
      return { ok: true, analysis: validated.parsed, model };
    }

    return validated;
  } catch (error) {
    return failure(classifyError(error));
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeWithMuse(
  content: string,
  options: TextOptions = {},
): Promise<AiResult> {
  return callMuse([
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: buildAnalysisPrompt(content, options),
        },
      ],
    },
  ]);
}

interface ImageOptions {
  base64Data: string;
  mimeType: string;
}

export async function analyzeImageWithMuse({
  base64Data,
  mimeType,
}: ImageOptions): Promise<AiResult> {
  return callMuse([
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: buildImagePrompt(),
        },
        {
          type: "input_image",
          image_url: `data:${mimeType};base64,${base64Data}`,
        },
      ],
    },
  ]);
}

/**
 * Compatibility exports.
 *
 * Existing ScamShield files can keep their current Gemini-named imports
 * while the provider is migrated. These aliases can be removed later.
 */
export const analyzeWithGemini = analyzeWithMuse;
export const analyzeImageWithGemini = analyzeImageWithMuse;
