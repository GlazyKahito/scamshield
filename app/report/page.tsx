import type { Metadata } from "next";
import { SiteNav } from "../../components/ui/site-nav";
import { SiteFooter } from "../../components/ui/site-footer";
import { SavedReport } from "../../components/report/saved-report";
import styles from "../../components/ui/pages.module.css";

export const metadata: Metadata = {
  title: "Latest report — ScamShield",
};

/**
 * /report — shows the most recent saved report.
 *
 * Exists so the bare /report path is never a dead link; individual reports live
 * at /report/[id].
 */
export default function LatestReportPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shellNarrow} data-reveal-stagger>
          <p className={styles.eyebrow}>THREAT REPORT</p>
          <h1 className={styles.title}>Your most recent analysis</h1>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shellNarrow}>
          <SavedReport />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
