import "server-only";

/**
 * The ScamShield analysis pipeline.
 *
 *   input → validation → extraction → rule engine ┐
 *                                                 ├→ risk engine → report
 *                                     Gemini ─────┘
 *
 * The deterministic layer always runs. Gemini is additive: if it fails, we
 * degrade to RULE_BASED_FALLBACK and still return a complete, useful report.
 * That ordering is deliberate — the product must work with the API key removed.
 */

import { randomUUID } from "node:crypto";
import type {
  AiAnalysis,
  Classification,
  InputType,
  RuleAnalysis,
  SecuritySignal,
  ThreatReport,
  UrlAnalysis,
} from "../../types/analysis";
import { analyzeMessage, classifyFromSignals, normalizeText } from "./message-analyzer";
import { analyzeUrl } from "./url-analyzer";
import {
  buildFallbackAttackChain,
  buildFallbackRecommendations,
  buildFallbackSummary,
  combineScores,
  deterministicConfidence,
  scoreSignals,
  severityFromScore,
} from "./risk-engine";
import { analyzeWithGemini, type AiResult } from "../ai/gemini";

/** Run the deterministic layer over a text message. */
export function runRuleEngineOnText(text: string): RuleAnalysis {
  const message = analyzeMessage(text);
  const urlAnalyses = message.extractedUrls.map(analyzeUrl);

  // URL signals join the message signals; the risk engine dedupes by group.
  const urlSignals = urlAnalyses.flatMap((u) => u.signals);
  const signals = [...message.signals, ...urlSignals];
  const score = scoreSignals(signals);

  return {
    score,
    signals,
    extractedUrls: message.extractedUrls,
    urlAnalyses,
    claimedBrands: message.claimedBrands,
    classification: classifyFromSignals(signals, text, score),
  };
}

/** Run the deterministic layer over a bare URL submission. */
export function runRuleEngineOnUrl(rawUrl: string): RuleAnalysis {
  const analysis = analyzeUrl(rawUrl);
  const score = scoreSignals(analysis.signals);

  return {
    score,
    signals: analysis.signals,
    extractedUrls: [rawUrl],
    urlAnalyses: [analysis],
    claimedBrands: [],
    classification: score >= 25 ? "SUSPICIOUS" : "SAFE",
  };
}

/** Short human label for history lists. Never the full message body. */
function deriveTitle(input: string, classification: Classification): string {
  const firstLine = normalizeText(input).split("\n")[0] ?? "";
  const trimmed = firstLine.slice(0, 48).trim();
  if (trimmed.length > 0) return trimmed + (firstLine.length > 48 ? "…" : "");
  return classification.replace(/_/g, " ").toLowerCase();
}

/**
 * Merge AI signals into the deterministic set.
 *
 * AI signals carry weight 0: Gemini's contribution to the score arrives through
 * the fused `aiScore`, not by inventing new point values. Letting the model
 * assign its own weights would make the scoring model unauditable.
 */
function mergeSignals(ruleSignals: SecuritySignal[], ai: AiAnalysis | null): SecuritySignal[] {
  if (!ai) return ruleSignals;

  const seen = new Set(ruleSignals.map((s) => s.name.toLowerCase()));
  const aiSignals: SecuritySignal[] = ai.signals
    .filter((s) => !seen.has(s.name.toLowerCase()))
    .map((s) => ({
      name: s.name,
      severity: s.severity,
      evidence: s.evidence,
      explanation: s.explanation,
      source: "AI",
      group: "social_engineering",
      weight: 0,
    }));

  // Mark rule signals the AI independently corroborated — agreement between two
  // independent methods is the strongest evidence the report can show.
  const aiNames = new Set(ai.signals.map((s) => s.name.toLowerCase()));
  const corroborated = ruleSignals.map((s) =>
    aiNames.has(s.name.toLowerCase()) ? { ...s, source: "COMBINED" as const } : s,
  );

  return [...corroborated, ...aiSignals];
}

interface BuildOptions {
  input: string;
  inputType: InputType;
  rule: RuleAnalysis;
  aiResult: AiResult | null;
}

/** Assemble the final report from whichever layers succeeded. */
export function buildReport({ input, inputType, rule, aiResult }: BuildOptions): ThreatReport {
  const ai = aiResult?.ok ? aiResult.analysis : null;
  const aiScore = ai ? ai.riskScore : null;
  const riskScore = combineScores(rule.score, aiScore);
  const severity = severityFromScore(riskScore);
  const hasUrl = rule.extractedUrls.length > 0;

  // Prefer the AI's classification when it is confident and not a generic
  // catch-all; otherwise the deterministic guess is more useful than "OTHER".
  const classification: Classification =
    ai && ai.confidence >= 0.5 && ai.classification !== "OTHER"
      ? ai.classification
      : rule.classification;

  const signals = mergeSignals(rule.signals, ai);

  const attackChain =
    ai && ai.attackChain.length > 0
      ? ai.attackChain
      : buildFallbackAttackChain(rule.signals, classification, hasUrl);

  const recommendedActions =
    ai && ai.recommendedActions.length > 0
      ? ai.recommendedActions
      : buildFallbackRecommendations(classification, rule.signals, hasUrl);

  const summary = ai?.summary || buildFallbackSummary(riskScore, classification, rule.signals);

  const confidence = ai ? ai.confidence : deterministicConfidence(rule.signals, riskScore);

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    inputType,
    title: deriveTitle(input, classification),
    inputPreview: normalizeText(input).slice(0, 500),

    riskScore,
    ruleScore: rule.score,
    aiScore,
    severity,
    classification,
    confidence,
    summary,

    signals,
    attackChain,
    recommendedActions,
    educationalTip:
      ai?.educationalTip ||
      "Whenever a message pushes you to act quickly, stop and reach the organisation through a number or app you already had. Urgency is the one ingredient every scam needs.",

    urlAnalyses: rule.urlAnalyses,
    analysisMode: ai ? "HYBRID" : "RULE_BASED_FALLBACK",
    aiUnavailableReason: aiResult && !aiResult.ok ? aiResult.message : undefined,
  };
}

/** Full text analysis: deterministic engine, then Gemini, then fusion. */
export async function analyzeTextInput(text: string): Promise<ThreatReport> {
  const rule = runRuleEngineOnText(text);

  const aiResult = await analyzeWithGemini(text, {
    ruleFindings: rule.signals.map((s) => s.name),
    hostnames: rule.urlAnalyses.map((u) => u.facts.hostname).filter(Boolean),
  });

  return buildReport({ input: text, inputType: "TEXT", rule, aiResult });
}

/** Full URL analysis. The URL is parsed, never visited. */
export async function analyzeUrlInput(rawUrl: string): Promise<ThreatReport> {
  const rule = runRuleEngineOnUrl(rawUrl);

  const aiResult = await analyzeWithGemini(`A user submitted this link for analysis: ${rawUrl}`, {
    ruleFindings: rule.signals.map((s) => s.name),
    hostnames: rule.urlAnalyses.map((u: UrlAnalysis) => u.facts.hostname).filter(Boolean),
  });

  return buildReport({ input: rawUrl, inputType: "URL", rule, aiResult });
}
