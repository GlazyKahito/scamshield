import type { Metadata } from "next";
import { SiteNav } from "../../components/ui/site-nav";
import { Analyzer } from "../../components/analyzer/analyzer";
import styles from "../../components/ui/pages.module.css";

export const metadata: Metadata = {
  title: "Check a message — ScamShield",
  description: "Paste a suspicious message, link or screenshot and see why it looks risky.",
};

/**
 * /analyze — the focused security workspace.
 *
 * Server component wrapper; the interactive analyzer is the only client code.
 */
export default function AnalyzePage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shellNarrow}>
          <p className={styles.eyebrow}>ANALYZER</p>
          <h1 className={styles.title}>Check something suspicious</h1>
          <p className={styles.lead}>
            Paste a message, a link, or a screenshot. You will get a risk score, the exact phrases
            that triggered it, how the scam would work, and what to do next.
          </p>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shellNarrow}>
          <Analyzer />
        </div>
      </main>
    </div>
  );
}
