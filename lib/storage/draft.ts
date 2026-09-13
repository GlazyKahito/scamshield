/**
 * One-shot hand-off of a draft from another page into the analyzer.
 *
 * sessionStorage rather than a query string: a pasted message can contain
 * personal details, and URLs end up in browser history, logs and referrers.
 * The analyzer reads the draft once and deletes it immediately.
 */

const DRAFT_KEY = "scamshield_draft";

export type DraftMode = "MESSAGE" | "URL";

export interface AnalyzerDraft {
  mode: DraftMode;
  value: string;
}

export function setAnalyzerDraft(draft: AnalyzerDraft): boolean {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function takeAnalyzerDraft(): AnalyzerDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    window.sessionStorage.removeItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { mode, value } = parsed as Partial<AnalyzerDraft>;
    if ((mode !== "MESSAGE" && mode !== "URL") || typeof value !== "string") return null;
    return { mode, value: value.slice(0, 8000) };
  } catch {
    return null;
  }
}
