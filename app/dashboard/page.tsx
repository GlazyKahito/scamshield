import type { Metadata } from "next";
import { SiteNav } from "../../components/ui/site-nav";
import { SiteFooter } from "../../components/ui/site-footer";
import { Dashboard } from "../../components/dashboard/dashboard";
import { FlickeringGrid } from "../../components/ui/flickering-grid";
import styles from "../../components/ui/pages.module.css";

export const metadata: Metadata = {
  title: "Dashboard — ScamShield",
  description: "Your saved ScamShield reports, risk breakdown and awareness score.",
};

/**
 * /dashboard — saved history and awareness.
 *
 * Server component wrapper; history lives in the browser, so the dashboard
 * itself is a client component.
 */
export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <FlickeringGrid className={styles.headGrid} />
        <div className={styles.shell}>
          <p className={styles.eyebrow}>DASHBOARD</p>
          <h1 className={styles.title}>Your security overview</h1>
          <p className={styles.lead}>
            Every report you save, and how sharp your scam radar is. Stored only in this browser.
          </p>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shell}>
          <Dashboard />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
