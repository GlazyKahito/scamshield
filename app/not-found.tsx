import Link from "next/link";
import { SiteNav } from "../components/ui/site-nav";
import { SiteFooter } from "../components/ui/site-footer";
import { CutReveal } from "../components/ui/motion/cut-reveal";
import styles from "../components/ui/pages.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <main className={styles.body} style={{ display: "flex", alignItems: "center" }}>
        <div className={styles.shellNarrow} style={{ width: "100%", textAlign: "center", paddingTop: 48 }}>
          <p className={styles.eyebrow}>ERROR 404 &middot; PAGE NOT FOUND</p>
          <h1 className={styles.title}>
            <CutReveal>Nothing to see here.</CutReveal>
          </h1>
          <p className={styles.lead} style={{ marginLeft: "auto", marginRight: "auto" }}>
            This page doesn&rsquo;t exist. If a message sent you here, that&rsquo;s worth a second
            look too.
          </p>
          <div className={styles.emptyActions} style={{ marginTop: 28 }}>
            <Link href="/" className={styles.btnGhost}>Go home</Link>
            <Link href="/analyze" className={styles.btnPrimary}>Check a message</Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
