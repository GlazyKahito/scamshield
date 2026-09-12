"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ThreatReport } from "../../types/analysis";
import { awarenessScore, clearHistory, getHistory, isStorageAvailable, summarize } from "../../lib/storage/history";
import { SiteNav } from "../../components/ui/site-nav";
import styles from "../../components/ui/pages.module.css";

/**
 * /dashboard — information-dense but calm.
 *
 * Reads only from localStorage; no network calls and no analysis happens here.
 */

const SEVERITY_COLOR: Record<string, string> = {
  LOW: "#34d399",
  MODERATE: "#fbbf24",
  HIGH: "#f59e0b",
  CRITICAL: "#ef4444",
};

const TYPE_LABEL: Record<string, string> = {
  TEXT: "Message",
  URL: "Link",
  IMAGE: "Screenshot",
};

function formatWhen(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export default function DashboardPage() {
  const [reports, setReports] = useState<ThreatReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageOk, setStorageOk] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [awareness, setAwareness] = useState({ score: 0, answered: 0, correct: 0 });

  const refresh = useCallback(() => {
    setReports(getHistory());
    setAwareness(awarenessScore());
  }, []);

  useEffect(() => {
    setStorageOk(isStorageAvailable());
    refresh();
    setLoading(false);
  }, [refresh]);

  const handleClear = useCallback(() => {
    clearHistory();
    refresh();
    setConfirming(false);
  }, [refresh]);

  const stats = summarize(reports);

  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shell}>
          <p className={styles.eyebrow}>YOUR HISTORY</p>
          <h1 className={styles.title}>Everything you&rsquo;ve checked</h1>
          <p className={styles.lead}>
            Saved reports stay in this browser. Nothing is uploaded, and clearing them removes them
            permanently.
          </p>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shell}>
          {!storageOk && (
            <p className={`${styles.notice} ${styles.noticeWarn}`} style={{ marginTop: 0, marginBottom: 24 }}>
              Your browser is blocking local storage, so history cannot be saved. Private browsing
              or a cookie-blocking setting is the usual cause.
            </p>
          )}

          <div className={styles.statCards}>
            <div className={styles.statCard}>
              <p className={styles.statBig}>{stats.total}</p>
              <p className={styles.statCaption}>Analyses saved</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statBig} style={{ color: "#f59e0b" }}>{stats.high}</p>
              <p className={styles.statCaption}>High or critical risk</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statBig} style={{ color: "#fbbf24" }}>{stats.moderate}</p>
              <p className={styles.statCaption}>Moderate risk</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statBig} style={{ color: "#34d399" }}>{stats.low}</p>
              <p className={styles.statCaption}>Low risk</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statBig} style={{ color: "#22d3ee" }}>
                {awareness.answered > 0 ? `${awareness.score}%` : "—"}
              </p>
              <p className={styles.statCaption}>
                {awareness.answered > 0
                  ? `Scam radar (${awareness.correct}/${awareness.answered})`
                  : "Scam radar — not tested yet"}
              </p>
            </div>
          </div>

          <section style={{ marginTop: 44 }}>
            <div className={styles.progressRow}>
              <h2 className={styles.sectionH} style={{ margin: 0 }}>Recent analyses</h2>
              {reports.length > 0 && (
                confirming ? (
                  <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" className={styles.btnGhost} onClick={handleClear}>
                      Yes, clear everything
                    </button>
                    <button type="button" className={styles.btnGhost} onClick={() => setConfirming(false)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button type="button" className={styles.btnGhost} onClick={() => setConfirming(true)}>
                    Clear local history
                  </button>
                )
              )}
            </div>

            {loading && <p className={`${styles.notice} ${styles.noticeInfo}`}>Loading…</p>}

            {!loading && reports.length === 0 && (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>Nothing saved yet</p>
                <p className={styles.emptyText}>
                  Analyse a message and choose &ldquo;Save this report&rdquo; to build a record of
                  what you have checked.
                </p>
                <Link href="/analyze" className={styles.btnPrimary}>Check a message</Link>
              </div>
            )}

            {!loading &&
              reports.map((report) => (
                <Link key={report.id} href={`/report/${report.id}`} className={styles.histItem}>
                  <span className={styles.histTop}>
                    <span className={styles.histTitle}>{report.title || "Untitled analysis"}</span>
                    <span
                      className={styles.histScore}
                      style={{ color: SEVERITY_COLOR[report.severity] ?? "#fff" }}
                    >
                      {report.riskScore}
                    </span>
                  </span>
                  <span className={styles.histMeta}>
                    <span>{formatWhen(report.createdAt)}</span>
                    <span>{TYPE_LABEL[report.inputType] ?? report.inputType}</span>
                    <span>{report.classification.replace(/_/g, " ").toLowerCase()}</span>
                    <span style={{ color: SEVERITY_COLOR[report.severity] }}>
                      {report.severity.toLowerCase()}
                    </span>
                  </span>
                </Link>
              ))}
          </section>
        </div>
      </main>
    </div>
  );
}
