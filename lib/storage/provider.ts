/**
 * Storage abstraction.
 *
 * The UI talks to this interface, never to localStorage directly. Swapping in a
 * Supabase-backed implementation later means writing one new file and changing
 * the factory below — no component changes.
 *
 * Every method is async even though the localStorage implementation is
 * synchronous, precisely so a network-backed provider can drop in without
 * rewriting call sites.
 */

import type { SimulatorResult, ThreatReport } from "../../types/analysis";

export interface AwarenessBreakdown {
  /** Correct answers per scam category, used for "strong at / needs practice". */
  correct: Record<string, number>;
  total: Record<string, number>;
}

export interface StorageProvider {
  listReports(): Promise<ThreatReport[]>;
  getReport(id: string): Promise<ThreatReport | null>;
  saveReport(report: ThreatReport): Promise<void>;
  deleteReport(id: string): Promise<void>;

  listSimulatorResults(): Promise<SimulatorResult[]>;
  saveSimulatorResult(result: SimulatorResult): Promise<void>;

  clearAll(): Promise<void>;
  isAvailable(): boolean;
}

let provider: StorageProvider | null = null;

/**
 * Returns the active provider.
 *
 * Imported lazily so the localStorage implementation is never evaluated during
 * server rendering, where `window` does not exist.
 */
export async function getStorage(): Promise<StorageProvider> {
  if (provider) return provider;
  const { LocalStorageProvider } = await import("./local-storage");
  provider = new LocalStorageProvider();
  return provider;
}

/** Test seam: lets a future SupabaseProvider be injected. */
export function setStorageProvider(next: StorageProvider): void {
  provider = next;
}
