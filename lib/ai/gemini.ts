import "server-only";

import { aiAnalysisSchema, normalizeAiAnalysis } from "./schema";
import { buildAnalysisPrompt, buildImagePrompt, SYSTEM_INSTRUCTION } from "./prompts";
import type { AiAnalysis } from "../../types/analysis";

const DEFAULT_MODEL = "muse-spark-1.3";
const DEFAULT_BASE_URL = "https://api.meta.ai/v1";
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

function fail(reason: AiFailureReason): AiResult {
  return { ok: false, reason, message: AI_FAILURE_MESSAGES[reason] };
}

function extractResponseText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  const data = payload as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };

  const chatContent = data.choices?.[0]?.message?.content;

  if (typeof chatContent === "string") {
    return chatContent;
  }

  if (Array.isArray(chatContent)) {
    const text = chatContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return typeof part.text === "string" ? part.text : "";
        }
        return "";
      })
      .join("")
      .trim();

    if (text) return text;
  }

  const responseText = data.output
    ?.flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  return responseText || undefined;
}

function validate(rawText: string | undefined): AiResult | { parsed: AiAnalysis } {
  if (!rawText || rawText.trim().length === 0) return fail("EMPTY_RESPONSE");

  const cleaned = rawText
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let json: unknown;

  try {
    json = JSON.parse(cleaned);
  } catch {
    return fail("INVALID_JSON");
  }

  const result = aiAnalysisSchema.safeParse(json);

  if (!result.success) {
    console.warn(
      "[muse] schema validation failed:",
      result.error.issues.map((issue) => issue.path.join(".")).join(", "),
    );
    return fail("SCHEMA_VALIDATION_FAILED");
  }

  return { parsed: normalizeAiAnalysis(result.data) };
}

interface TextOptions {
  ruleFindings?: string[];
  hostnames?: string[];
}

async function callMuse(messages: unknown[]): Promise<AiResult> {
  const apiKey = process.env.MUSE_API_KEY?.trim();

  if (!apiKey) return fail("NO_API_KEY");

  const model = getModelName();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Muse API ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const payload: unknown = await response.json();
    const validated = validate(extractResponseText(payload));

    if ("parsed" in validated) {
      return { ok: true, analysis: validated.parsed, model };
    }

    return validated;
  } catch (error) {
    return fail(classifyError(error));
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
      role: "system",
      content: SYSTEM_INSTRUCTION,
    },
    {
      role: "user",
      content: buildAnalysisPrompt(content, options),
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
      role: "system",
      content: SYSTEM_INSTRUCTION,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: buildImagePrompt(),
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`,
          },
        },
      ],
    },
  ]);
}

/**
 * Compatibility exports.
 *
 * Existing ScamShield files can keep their current Gemini-named imports
 * while the provider is migrated. These aliases can be removed later when
 * the file itself is renamed from gemini.ts to muse.ts.
 */
export const analyzeWithGemini = analyzeWithMuse;
export const analyzeImageWithGemini = analyzeImageWithMuse;
