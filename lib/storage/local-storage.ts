/**
 * localStorage implementation of StorageProvider.
 *
 * Defensive throughout: browser storage is shared, user-editable, and can be
 * disabled entirely (private browsing, blocked cookies, quota exhaustion).
 * Every read validates what it finds and discards anything malformed rather
 * than crashing the dashboard.
 */

import type { SimulatorResult, ThreatReport } from "../../types/analysis";
import type { StorageProvider } from "./provider";

const REPORTS_KEY = "scamshield:reports:v1";
const SIMULATOR_KEY = "scamshield:simulator:v1";
/** Keeps the dashboard responsive and stays well clear of the ~5MB quota. */
const MAX_REPORTS = 50;

function hasStorage(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const probe = "scamshield:probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Parse JSON, returning the fallback on anything unexpected. */
function readArray<T>(key: string, isValid: (value: unknown) => value is T): T[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop individual corrupt entries instead of discarding the whole history.
    return parsed.filter(isValid);
  } catch {
    return [];
  }
}

function writeArray(key: string, value: unknown[]): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Most likely a quota error. Trim aggressively and retry once.
    try {
      window.localStorage.setItem(key, JSON.stringify(value.slice(0, 10)));
      return true;
    } catch {
      return false;
    }
  }
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

function isSimulatorResult(value: unknown): value is SimulatorResult {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<SimulatorResult>;
  return (
    typeof r.id === "string" &&
    typeof r.scenarioId === "string" &&
    typeof r.isCorrect === "boolean" &&
    typeof r.createdAt === "string"
  );
}

export class LocalStorageProvider implements StorageProvider {
  isAvailable(): boolean {
    return hasStorage();
  }

  async listReports(): Promise<ThreatReport[]> {
    return readArray(REPORTS_KEY, isReport).sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }

  async getReport(id: string): Promise<ThreatReport | null> {
    const reports = await this.listReports();
    return reports.find((r) => r.id === id) ?? null;
  }

  async saveReport(report: ThreatReport): Promise<void> {
    const existing = await this.listReports();
    const deduped = existing.filter((r) => r.id !== report.id);
    writeArray(REPORTS_KEY, [report, ...deduped].slice(0, MAX_REPORTS));
  }

  async deleteReport(id: string): Promise<void> {
    const existing = await this.listReports();
    writeArray(REPORTS_KEY, existing.filter((r) => r.id !== id));
  }

  async listSimulatorResults(): Promise<SimulatorResult[]> {
    return readArray(SIMULATOR_KEY, isSimulatorResult);
  }

  async saveSimulatorResult(result: SimulatorResult): Promise<void> {
    const existing = await this.listSimulatorResults();
    writeArray(SIMULATOR_KEY, [...existing, result].slice(-200));
  }

  async clearAll(): Promise<void> {
    if (!hasStorage()) return;
    try {
      window.localStorage.removeItem(REPORTS_KEY);
      window.localStorage.removeItem(SIMULATOR_KEY);
    } catch {
      // Nothing useful to do — the caller re-reads and shows an empty state.
    }
  }
}
