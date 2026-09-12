/**
 * Awareness score derivation.
 *
 * Kept separate from the storage layer so the scoring model can be tested and
 * changed without touching persistence.
 */

import type { SimulatorResult } from "../../types/analysis";

export interface AwarenessSummary {
  score: number;
  answered: number;
  correct: number;
  strongAt: string[];
  needsPractice: string[];
}

const LABELS: Record<string, string> = {
  PHISHING: "Phishing",
  JOB_SCAM: "Fake jobs",
  UPI_SCAM: "UPI scams",
  DELIVERY_SCAM: "Delivery scams",
  INVESTMENT_SCAM: "Investment scams",
  IMPERSONATION: "Impersonation",
  ACCOUNT_TAKEOVER: "Account takeover",
};

export function summarizeAwareness(results: SimulatorResult[]): AwarenessSummary {
  if (results.length === 0) {
    return { score: 0, answered: 0, correct: 0, strongAt: [], needsPractice: [] };
  }

  const correct = results.filter((r) => r.isCorrect).length;
  const score = Math.round((correct / results.length) * 100);

  const byCategory = new Map<string, { correct: number; total: number }>();
  for (const r of results) {
    const entry = byCategory.get(r.category) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (r.isCorrect) entry.correct += 1;
    byCategory.set(r.category, entry);
  }

  const strongAt: string[] = [];
  const needsPractice: string[] = [];

  for (const [category, { correct: c, total }] of byCategory) {
    const label = LABELS[category] ?? category;
    const ratio = c / total;
    // Require at least one full attempt before labelling a category either way.
    if (ratio >= 0.75) strongAt.push(label);
    else if (ratio < 0.5) needsPractice.push(label);
  }

  return { score, answered: results.length, correct, strongAt, needsPractice };
}
