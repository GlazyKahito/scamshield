import Link from "next/link";
import { ShieldMark } from "./site-nav";
import styles from "./scamshield.module.css";

/**
 * Shared footer. Server component — no client JavaScript.
 *
 * The disclaimer is part of the product, not legal boilerplate: a low score is
 * not proof that a message is genuine, and every page should say so.
 */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.footerRow}>
          <span className={styles.footerBrand}>
            <ShieldMark size={16} />
            ScamShield &mdash; stay skeptical, stay safe.
          </span>
          <nav className={styles.footerLinks} aria-label="Footer">
            <Link href="/analyze" className={styles.footerLink}>Analyze</Link>
            <Link href="/dashboard" className={styles.footerLink}>Dashboard</Link>
            <Link href="/simulator" className={styles.footerLink}>Simulator</Link>
            <Link href="/scams" className={styles.footerLink}>Scam Library</Link>
            <Link href="/about" className={styles.footerLink}>About</Link>
          </nav>
        </div>
        <p className={styles.footerNote}>
          ScamShield reports risk based on the content you provide. It cannot verify who owns a
          domain or who sent a message, so a low score is not a guarantee that something is
          genuine. When money or account access is involved, check through a channel you found
          yourself.
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
