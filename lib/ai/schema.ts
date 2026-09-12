/**
 * Schema contract for the Gemini semantic layer.
 *
 * Two schemas live here, and they are not redundant:
 *
 *   1. GEMINI_RESPONSE_SCHEMA — passed to Gemini as `responseSchema` so the
 *      model emits structured JSON rather than prose we would have to scrape.
 *   2. aiAnalysisSchema (Zod) — validates what actually came back.
 *
 * Structured output constrains shape, not meaning. A model can return a
 * perfectly-shaped object with riskScore 9001, an empty evidence string, or a
 * classification that contradicts its own severity. Everything Gemini returns
 * is treated as untrusted until it clears the Zod pass *and* the semantic
 * checks below.
 */

import { Type } from "@google/genai";
import { z } from "zod";
import { CLASSIFICATIONS, SEVERITIES } from "../../types/analysis";
import type { AiAnalysis } from "../../types/analysis";

/* ------------------------------------------------------------------ *
 * 1. Schema sent to Gemini
 * ------------------------------------------------------------------ */

export const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    riskScore: { type: Type.INTEGER, description: "Semantic risk from 0 to 100." },
    classification: { type: Type.STRING, enum: [...CLASSIFICATIONS] },
    severity: { type: Type.STRING, enum: [...SEVERITIES] },
    confidence: { type: Type.NUMBER, description: "Your confidence from 0 to 1." },
    summary: { type: Type.STRING, description: "2-3 sentences for a non-technical reader." },
    signals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
          evidence: { type: Type.STRING, description: "A short quote from the submitted content." },
          explanation: { type: Type.STRING },
        },
        required: ["name", "severity", "evidence", "explanation"],
      },
    },
    attackChain: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.INTEGER },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["step", "title", "description"],
      },
    },
    recommendedActions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["DO", "DONT"] },
          text: { type: Type.STRING },
        },
        required: ["type", "text"],
      },
    },
    educationalTip: { type: Type.STRING },
  },
  required: [
    "riskScore", "classification", "severity", "confidence",
    "summary", "signals", "attackChain", "recommendedActions", "educationalTip",
  ],
} as const;

/* ------------------------------------------------------------------ *
 * 2. Zod validation of what came back
 * ------------------------------------------------------------------ */

/** Strip control characters; the UI renders as text, never as HTML. */
const safeString = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, " ").trim())
    .pipe(z.string().max(max));

export const aiAnalysisSchema = z.object({
  riskScore: z.number().finite().min(0).max(100).transform((n) => Math.round(n)),
  classification: z.enum(CLASSIFICATIONS as [string, ...string[]]),
  severity: z.enum(SEVERITIES as [string, ...string[]]),
  confidence: z.number().finite().min(0).max(1),
  summary: safeString(1200),
  signals: z
    .array(
      z.object({
        name: safeString(80),
        severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
        evidence: safeString(400),
        explanation: safeString(1000),
      }),
    )
    .max(15),
  attackChain: z
    .array(
      z.object({
        step: z.number().int().min(1).max(20),
        title: safeString(80),
        description: safeString(600),
      }),
    )
    .max(10),
  recommendedActions: z
    .array(
      z.object({
        type: z.enum(["DO", "DONT"]),
        text: safeString(300),
      }),
    )
    .max(14),
  educationalTip: safeString(600),
});

export type ValidatedAiAnalysis = z.infer<typeof aiAnalysisSchema>;

/**
 * Semantic repairs applied after shape validation.
 *
 * We repair rather than reject where the fix is unambiguous, because throwing
 * away an otherwise-useful analysis over a renumbered attack step would send
 * users to the fallback path for no real benefit. Anything we cannot repair
 * confidently is dropped.
 */
export function normalizeAiAnalysis(parsed: ValidatedAiAnalysis): AiAnalysis {
  // Drop signals with no real evidence — an unevidenced signal is exactly the
  // kind of confident-sounding filler we promised users we would not show.
  const signals = parsed.signals.filter(
    (s) => s.name.length > 0 && s.evidence.length > 0 && s.explanation.length > 0,
  );

  // Renumber the attack chain so the UI can trust `step` as a render order.
  const attackChain = parsed.attackChain
    .filter((s) => s.title.length > 0 && s.description.length > 0)
    .sort((a, b) => a.step - b.step)
    .map((s, i) => ({ ...s, step: i + 1 }));

  const recommendedActions = parsed.recommendedActions.filter((r) => r.text.length > 0);

  // Severity must agree with the score the model itself returned. If it does
  // not, the score is the more useful signal, so we recompute severity from it.
  const severity =
    parsed.riskScore >= 75 ? "CRITICAL"
    : parsed.riskScore >= 50 ? "HIGH"
    : parsed.riskScore >= 25 ? "MODERATE"
    : "LOW";

  // A SAFE classification paired with a high score is incoherent; trust the score.
  let classification = parsed.classification as AiAnalysis["classification"];
  if (classification === "SAFE" && parsed.riskScore >= 50) classification = "SUSPICIOUS";

  return {
    riskScore: parsed.riskScore,
    classification,
    severity,
    confidence: Math.round(parsed.confidence * 100) / 100,
    summary: parsed.summary,
    signals: signals as AiAnalysis["signals"],
    attackChain,
    recommendedActions: recommendedActions as AiAnalysis["recommendedActions"],
    educationalTip: parsed.educationalTip,
  };
}
