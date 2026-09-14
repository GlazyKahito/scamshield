"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, Trash2 } from "lucide-react";
import type { Severity, ThreatReport } from "../../types/analysis";
import {
  awarenessScore,
  clearHistory,
  deleteReport,
  getHistory,
  isStorageAvailable,
} from "../../lib/storage/history";
import {
  CLASSIFICATION_LABEL,
  INPUT_TYPE_LABEL,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  toSeverity,
} from "../report/severity";
import { NumberTicker } from "../ui/motion/number-ticker";
import styles from "../ui/pages.module.css";

/**
 * Dashboard — history and awareness at a glance.
 *
 * Reads only from lib/storage/history, which validates every entry and drops
 * corrupt ones, so a tampered localStorage value cannot crash this page.
 * Nothing here is sample data: an empty history renders an empty state.
 */

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MODERATE", "LOW"];

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Math.round((Date.now() - then) / 1000);
  if (diff < 60) return "just now";
  const minutes = Math.round(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function Dashboard() {
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [reports, setReports] = useState<ThreatReport[]>([]);
  const [awareness, setAwareness] = useState({ score: 0, answered: 0, correct: 0 });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Severity | "ALL">("ALL");
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(() => {
    setReports(getHistory());
    setAwareness(awarenessScore());
  }, []);

  useEffect(() => {
    setStorageOk(isStorageAvailable());
    refresh();
    setLoaded(true);
    // Stay in sync if another tab saves or clears reports.
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const counts = useMemo(() => {
    const base: Record<Severity, number> = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
    for (const r of reports) base[toSeverity(r.severity)] += 1;
    return base;
  }, [reports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (filter !== "ALL" && toSeverity(r.severity) !== filter) return false;
      if (!q) return true;
      const haystack = [
        r.title,
        r.summary,
        CLASSIFICATION_LABEL[r.classification] ?? r.classification,
        INPUT_TYPE_LABEL[r.inputType] ?? r.inputType,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [reports, query, filter]);

  const handleDelete = (id: string, index: number) => {
    deleteReport(id);
    refresh();
    // The focused button just disappeared; keep keyboard users in the list.
    window.requestAnimationFrame(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>("[data-delete-report]");
      const next = buttons[Math.min(index, buttons.length - 1)];
      if (next) next.focus();
      else document.getElementById("history-heading")?.focus();
    });
  };

  const handleClear = () => {
    clearHistory();
    setConfirmClear(false);
    setQuery("");
    setFilter("ALL");
    refresh();
  };

  if (!loaded) {
    return <p className={`${styles.notice} ${styles.noticeInfo}`} style={{ marginTop: 0 }}>Loading your history…</p>;
  }

  const total = reports.length;
  const highRisk = counts.HIGH + counts.CRITICAL;
  const latest = reports[0];

  return (
    <>
      {!storageOk && (
        <p className={`${styles.notice} ${styles.noticeWarn}`} style={{ marginTop: 0, marginBottom: 20 }}>
          <span className={styles.noticeIcon} aria-hidden="true">!</span>
          <span>
            Your browser is blocking local storage, so history can&rsquo;t be saved or shown. Private
            browsing is the usual cause.
          </span>
        </p>
      )}

      <section aria-label="Summary">
        <div className={styles.statCards}>
          <div className={styles.statCard}>
            <span className={styles.statCardLabel}>TOTAL CHECKS</span>
            <p className={styles.statBig}><NumberTicker value={total} /></p>
            <p className={styles.statCaption}>
              {latest ? `Last saved ${relativeTime(latest.createdAt)}` : "Saved reports appear here"}
            </p>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statCardLabel}>HIGH-RISK</span>
            <p className={styles.statBig} style={{ color: highRisk > 0 ? SEVERITY_COLOR.CRITICAL : undefined }}>
              <NumberTicker value={highRisk} delay={0.08} />
            </p>
            <p className={styles.statCaption}>
              {total > 0 ? `${Math.round((highRisk / total) * 100)}% of saved checks` : "High and critical findings"}
            </p>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statCardLabel}>AWARENESS</span>
            <p className={styles.statBig} style={{ color: awareness.answered > 0 ? "var(--sev-low)" : undefined }}>
              {awareness.answered > 0 ? <NumberTicker value={awareness.score} suffix="%" delay={0.16} /> : "—"}
            </p>
            <p className={styles.statCaption}>
              {awareness.answered > 0 ? (
                `${awareness.correct} of ${awareness.answered} simulator answers correct`
              ) : (
                <Link href="/simulator">Take the simulator &rarr;</Link>
              )}
            </p>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statCardLabel}>SAFE</span>
            <p className={styles.statBig} style={{ color: counts.LOW > 0 ? SEVERITY_COLOR.LOW : undefined }}>
              <NumberTicker value={counts.LOW} delay={0.24} />
            </p>
            <p className={styles.statCaption}>No known patterns matched</p>
          </div>
        </div>

        <div className={styles.breakdown}>
          <div className={styles.breakdownHead}>
            <span className={styles.statCardLabel}>SEVERITY BREAKDOWN</span>
            <span className={styles.statCardLabel}>{total} REPORT{total === 1 ? "" : "S"}</span>
          </div>
          <div
            className={styles.stackBar}
            role="img"
            aria-label={
              total === 0
                ? "No reports yet"
                : SEVERITY_ORDER.map((s) => `${counts[s]} ${SEVERITY_LABEL[s].toLowerCase()}`).join(", ")
            }
          >
            {total > 0 &&
              SEVERITY_ORDER.map((s) =>
                counts[s] > 0 ? (
                  <span key={s} className={styles.stackSeg} style={{ flexGrow: counts[s], background: SEVERITY_COLOR[s] }} />
                ) : null,
              )}
          </div>
          <ul className={styles.stackLegend}>
            {SEVERITY_ORDER.map((s) => (
              <li key={s} className={styles.stackLegendItem}>
                <span className={styles.swatch} style={{ background: SEVERITY_COLOR[s] }} aria-hidden="true" />
                {SEVERITY_LABEL[s].replace(" risk", "")}
                <strong>{counts[s]}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="history-heading">
        <div className={styles.histHead}>
          <div>
            <span className={styles.sectionIdx}>HISTORY</span>
            <h2 id="history-heading" className={styles.sectionH} tabIndex={-1} style={{ outline: "none" }}>Saved reports</h2>
          </div>

          {total > 0 &&
            (confirmClear ? (
              <span className={styles.confirm} role="group" aria-label="Confirm clearing history">
                Delete all reports and simulator progress?
                <button type="button" className={styles.btnDanger} onClick={handleClear}>
                  Yes, clear
                </button>
                <button type="button" className={styles.btnQuiet} onClick={() => setConfirmClear(false)} autoFocus>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" className={styles.btnQuiet} onClick={() => setConfirmClear(true)}>
                <Trash2 size={15} aria-hidden="true" />
                Clear all
              </button>
            ))}
        </div>

        {total === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <ShieldCheck size={36} strokeWidth={1.5} />
            </span>
            <p className={styles.emptyTitle}>No saved reports yet</p>
            <p className={styles.emptyText}>
              Analyze a message, link or screenshot, then choose <strong>Save</strong> on the report.
              It stays in this browser &mdash; nothing is uploaded.
            </p>
            <div className={styles.emptyActions}>
              <Link href="/analyze" className={styles.btnPrimary}>Analyze something</Link>
              <Link href="/simulator" className={styles.btnGhost}>Try the simulator</Link>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.histControls}>
              <label className={styles.search}>
                <span className="sr-only">Search saved reports</span>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  className={styles.searchInput}
                  placeholder="Search by title, type or summary"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>

              <div className={styles.chipRow} role="group" aria-label="Filter by severity">
                {(["ALL", ...SEVERITY_ORDER] as const).map((s) => {
                  const on = filter === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      className={on ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                      onClick={() => setFilter(s)}
                    >
                      {s !== "ALL" && (
                        <span className={styles.swatch} style={{ background: SEVERITY_COLOR[s] }} aria-hidden="true" />
                      )}
                      {s === "ALL" ? "All" : SEVERITY_LABEL[s].replace(" risk", "")}
                      <span className={styles.chipCount}>{s === "ALL" ? total : counts[s]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="sr-only" aria-live="polite">
              {filtered.length} of {total} reports shown
            </p>

            {filtered.length === 0 ? (
              <p className={`${styles.notice} ${styles.noticeInfo}`} style={{ marginTop: 0 }}>
                <span className={styles.noticeIcon} aria-hidden="true">i</span>
                <span>
                  No reports match.{" "}
                  <button
                    type="button"
                    className={styles.btnQuiet}
                    style={{ minHeight: 0, padding: "0 4px", color: "var(--signal)" }}
                    onClick={() => {
                      setQuery("");
                      setFilter("ALL");
                    }}
                  >
                    Reset filters
                  </button>
                </span>
              </p>
            ) : (
              <ul className={styles.histList}>
                {filtered.map((r, index) => {
                  const sev = toSeverity(r.severity);
                  const color = SEVERITY_COLOR[sev];
                  return (
                    <li key={r.id} className={styles.histItem}>
                      <Link href={`/report/${encodeURIComponent(r.id)}`} className={styles.histLink}>
                        <span className={styles.histScore}>
                          <span className={styles.histScoreNum} style={{ color }}>{r.riskScore}</span>
                          <span className={styles.histSev} style={{ color }}>{sev}</span>
                        </span>
                        <span className={styles.histMain}>
                          <span className={styles.histTitle}>{r.title || "Untitled check"}</span>
                          <span className={styles.histMeta}>
                            <span>{CLASSIFICATION_LABEL[r.classification] ?? r.classification}</span>
                            <span>{INPUT_TYPE_LABEL[r.inputType] ?? r.inputType}</span>
                            <span>{relativeTime(r.createdAt)}</span>
                          </span>
                        </span>
                      </Link>
                      <span className={styles.histSide}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => handleDelete(r.id, index)}
                          data-delete-report
                          aria-label={`Delete report: ${r.title || "Untitled check"}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}

export default Dashboard;
