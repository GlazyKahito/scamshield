"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileQuestion } from "lucide-react";
import type { ThreatReport } from "../../types/analysis";
import { getHistory, getReportById } from "../../lib/storage/history";
import { ReportView } from "./report-view";
import styles from "../ui/pages.module.css";

/**
 * Loads a saved report from this browser's history.
 *
 * `id` undefined means "the most recent report" (used by /report). Reports are
 * stored locally, so a link opened on another device lands on the not-found
 * state rather than an error.
 */
export function SavedReport({ id }: { id?: string }) {
  const [state, setState] = useState<{ loading: boolean; report: ThreatReport | null }>({
    loading: true,
    report: null,
  });

  useEffect(() => {
    const report = id ? getReportById(id) : (getHistory()[0] ?? null);
    setState({ loading: false, report });
  }, [id]);

  if (state.loading) {
    return (
      <p className={`${styles.notice} ${styles.noticeInfo}`} style={{ marginTop: 0 }} role="status">
        Loading report…
      </p>
    );
  }

  if (!state.report) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <FileQuestion size={36} strokeWidth={1.5} />
        </span>
        <p className={styles.emptyTitle}>{id ? "Report not found" : "No saved reports yet"}</p>
        <p className={styles.emptyText}>
          {id
            ? "Saved reports live only in the browser that created them. This one may have been deleted, or saved on a different device."
            : "Analyze a message and choose Save on the report to keep it here."}
        </p>
        <div className={styles.emptyActions}>
          <Link href="/analyze" className={styles.btnPrimary}>Analyze something</Link>
          <Link href="/dashboard" className={styles.btnGhost}>Back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <ReportView report={state.report} saved />
      <div className={styles.nextStrip}>
        <div>
          <p className={styles.nextTitle}>Got another one?</p>
          <p className={styles.nextText}>Check it before you reply, click or pay.</p>
        </div>
        <div className={styles.actions} style={{ marginTop: 0 }}>
          <Link href="/dashboard" className={styles.btnGhost}>All reports</Link>
          <Link href="/analyze" className={styles.btnPrimary}>Check another message</Link>
        </div>
      </div>
    </>
  );
}

export default SavedReport;
