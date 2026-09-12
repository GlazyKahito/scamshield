"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ThreatReport } from "../../../types/analysis";
import { getReportById } from "../../../lib/storage/history";
import { ReportView } from "../../../components/report/report-view";
import { SiteNav } from "../../../components/ui/site-nav";
import styles from "../../../components/ui/pages.module.css";

/**
 * /report/[id] — a saved report.
 *
 * Client-rendered because history lives in localStorage, which does not exist
 * during server rendering. `loading` starts true so we never flash "not found"
 * before the lookup has run.
 */
export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<ThreatReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = typeof params?.id === "string" ? params.id : "";
    setReport(id ? getReportById(id) : null);
    setLoading(false);
  }, [params]);

  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shellNarrow}>
          <p className={styles.eyebrow}>THREAT REPORT</p>
          <h1 className={styles.title}>
            {loading ? "Loading report" : report ? "Saved analysis" : "Report not found"}
          </h1>
          {report && (
            <p className={styles.lead}>
              Analysed {new Date(report.createdAt).toLocaleString()} &middot;{" "}
              {report.inputType === "TEXT" ? "Message" : report.inputType === "URL" ? "Link" : "Screenshot"}
            </p>
          )}
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shellNarrow}>
          {loading && <p className={`${styles.notice} ${styles.noticeInfo}`}>Loading…</p>}

          {!loading && !report && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>This report isn&rsquo;t in your history</p>
              <p className={styles.emptyText}>
                Saved reports live in this browser only. If you cleared your history, used a
                different device, or are in private browsing, it won&rsquo;t be here.
              </p>
              <Link href="/analyze" className={styles.btnPrimary}>Analyze something</Link>
            </div>
          )}

          {!loading && report && (
            <>
              <ReportView report={report} />
              <div className={styles.actions} style={{ marginTop: 36 }}>
                <Link href="/analyze" className={styles.btnPrimary}>Check another message</Link>
                <Link href="/dashboard" className={styles.btnGhost}>Back to history</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
