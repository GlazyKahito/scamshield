/**
 * Analysis history — localStorage for the MVP.
 *
 * Defensive by default: browser storage is user-editable, can be disabled
 * (private mode, blocked cookies), and can hit quota. Every read validates what
 * it finds and drops individual corrupt entries rather than throwing away the
 * whole history or crashing the dashboard.
 *
 * Swapping this for a database later means reimplementing these five functions.
 * Nothing else in the app touches localStorage directly.
 */

import type { ThreatReport, Severity } from "../../types/analysis";

export const HISTORY_KEY = "scamshield_history";
const SIMULATOR_KEY = "scamshield_simulator";
/** Keeps the dashboard fast and stays well clear of the ~5MB quota. */
const MAX_ENTRIES = 50;

export interface SimulatorAnswer {
  scenarioId: string;
  correct: boolean;
  at: string;
}

function available(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const probe = "__ss_probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function isStorageAvailable(): boolean {
  return available();
}

function isReport(value: unknown): value is ThreatReport {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<ThreatReport>;
  return (
    typeof r.id === "string" &&
    typeof r.riskScore === "number" &&
    Number.isFinite(r.riskScore) &&
    typeof r.severity === "string" &&
    typeof r.classification === "string" &&
    typeof r.createdAt === "string" &&
    Array.isArray(r.signals)
  );
}

function read<T>(key: string, valid: (v: unknown) => v is T): T[] {
  if (!available()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(valid);
  } catch {
    return [];
  }
}

function write(key: string, value: unknown[]): boolean {
  if (!available()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Most likely quota. Trim hard and retry once before giving up.
    try {
      window.localStorage.setItem(key, JSON.stringify(value.slice(0, 10)));
      return true;
    } catch {
      return false;
    }
  }
}

export function getHistory(): ThreatReport[] {
  return read(HISTORY_KEY, isReport).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function getReportById(id: string): ThreatReport | null {
  return getHistory().find((r) => r.id === id) ?? null;
}

export function saveReport(report: ThreatReport): boolean {
  const existing = getHistory().filter((r) => r.id !== report.id);
  return write(HISTORY_KEY, [report, ...existing].slice(0, MAX_ENTRIES));
}

export function deleteReport(id: string): void {
  write(HISTORY_KEY, getHistory().filter((r) => r.id !== id));
}

export function clearHistory(): void {
  if (!available()) return;
  try {
    window.localStorage.removeItem(HISTORY_KEY);
    window.localStorage.removeItem(SIMULATOR_KEY);
  } catch {
    // Nothing useful to do; callers re-read and render the empty state.
  }
}

/* ---------------- Simulator progress ---------------- */

function isAnswer(value: unknown): value is SimulatorAnswer {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Partial<SimulatorAnswer>;
  return typeof a.scenarioId === "string" && typeof a.correct === "boolean" && typeof a.at === "string";
}

export function getSimulatorAnswers(): SimulatorAnswer[] {
  return read(SIMULATOR_KEY, isAnswer);
}

export function saveSimulatorAnswer(answer: SimulatorAnswer): void {
  write(SIMULATOR_KEY, [...getSimulatorAnswers(), answer].slice(-200));
}

export function awarenessScore(): { score: number; answered: number; correct: number } {
  const answers = getSimulatorAnswers();
  if (answers.length === 0) return { score: 0, answered: 0, correct: 0 };
  const correct = answers.filter((a) => a.correct).length;
  return { score: Math.round((correct / answers.length) * 100), answered: answers.length, correct };
}

/* ---------------- Dashboard aggregation ---------------- */

export interface HistoryStats {
  total: number;
  high: number;
  moderate: number;
  low: number;
}

/**
 * CRITICAL is folded into the high-risk count.
 *
 * The dashboard asks for three buckets, while the engine produces four
 * severities. Collapsing at the top keeps "high-risk detections" meaning
 * "things you should not have acted on".
 */
export function summarize(reports: ThreatReport[]): HistoryStats {
  const count = (test: (s: Severity) => boolean) =>
    reports.filter((r) => test(r.severity as Severity)).length;

  return {
    total: reports.length,
    high: count((s) => s === "HIGH" || s === "CRITICAL"),
    moderate: count((s) => s === "MODERATE"),
    low: count((s) => s === "LOW"),
  };
}
