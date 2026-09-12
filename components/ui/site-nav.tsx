"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./scamshield.module.css";

/**
 * Primary navigation.
 *
 * Client component only because it tracks the active route and toggles the
 * mobile menu. Uses the same CSS Module as the landing page, so it carries no
 * dependency on the Tailwind config.
 */

const LINKS = [
  { href: "/analyze", label: "Analyze" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/simulator", label: "Simulator" },
  { href: "/scams", label: "Scam Library" },
  { href: "/about", label: "About" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.nav}>
      <div className={styles.shell}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo} onClick={() => setOpen(false)}>
            <ShieldMark />
            <span>
              SCAM<span className={styles.logoAccent}>SHIELD</span>
            </span>
          </Link>

          <nav className={styles.navLinks} aria-label="Main">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            className={styles.navToggle}
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>

        {open && (
          <nav id="mobile-nav" className={styles.mobileMenu} aria-label="Main">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={styles.mobileLink}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

/** Shield drawn as a scan aperture rather than a padlock. */
function ShieldMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 1.5 3.5 4.6v6.1c0 4.5 3.1 8.3 7.5 9.8 4.4-1.5 7.5-5.3 7.5-9.8V4.6L11 1.5Z"
        stroke="#22d3ee"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.5 10.4h9" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default SiteNav;
