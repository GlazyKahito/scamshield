import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../../../components/ui/site-nav";
import { SiteFooter } from "../../../components/ui/site-footer";
import { SavedReport } from "../../../components/report/saved-report";
import { CutReveal } from "../../../components/ui/motion/cut-reveal";
import styles from "../../../components/ui/pages.module.css";

export const metadata: Metadata = {
  title: "Saved report — ScamShield",
  // Report contents are private to the browser that saved them.
  robots: { index: false, follow: false },
};

/**
 * /report/[id] — one saved report.
 *
 * The report itself is read client-side from local history via getReportById;
 * the server never sees it.
 */
export default async function SavedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    // Malformed escape sequence: fall through with the raw value, which simply won't match.
  }

  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shellNarrow} data-reveal-stagger>
          <p className={styles.eyebrow}>
            <Link href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>
              &larr; DASHBOARD
            </Link>
            <span style={{ color: "var(--muted)" }}> / SAVED REPORT</span>
          </p>
          <h1 className={styles.title}>
            <CutReveal>Threat report</CutReveal>
          </h1>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shellNarrow}>
          <SavedReport id={id} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
