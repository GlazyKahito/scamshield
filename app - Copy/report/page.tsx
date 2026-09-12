"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ThreatReport } from "../../types/analysis";
import { getHistory } from "../../lib/storage/history";
import { ReportView } from "../../components/report/report-view";
import { SiteNav } from "../../components/ui/site-nav";
import styles from "../../components/ui/pages.module.css";

/**
 * /report — shows the most recent saved report.
 *
 * Exists so the bare /report path is never a dead link; individual reports live
 * at /report/[id].
 */
export default function LatestReportPage() {
  const [report, setReport] = useState<ThreatReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setReport(getHistory()[0] ?? null);
    setLoading(false);
  }, []);

  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shellNarrow}>
          <p className={styles.eyebrow}>THREAT REPORT</p>
          <h1 className={styles.title}>Your most recent analysis</h1>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shellNarrow}>
          {loading && <p className={`${styles.notice} ${styles.noticeInfo}`}>Loading…</p>}

          {!loading && !report && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No saved reports yet</p>
              <p className={styles.emptyText}>
                Analyse a message and choose &ldquo;Save this report&rdquo; to keep it here.
              </p>
              <Link href="/analyze" className={styles.btnPrimary}>Analyze something</Link>
            </div>
          )}

          {!loading && report && (
            <>
              <ReportView report={report} />
              <div className={styles.actions} style={{ marginTop: 36 }}>
                <Link href="/analyze" className={styles.btnPrimary}>Check another message</Link>
                <Link href="/dashboard" className={styles.btnGhost}>See all history</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
