"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./scamshield.module.css";

/**
 * Primary navigation.
 *
 * Client component only because it tracks the active route and toggles the
 * mobile menu. Minimal on purpose: a mark, five destinations, one action.
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

  // Close the menu on navigation and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={styles.nav}>
      <div className={styles.shell}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo} onClick={() => setOpen(false)}>
            <ShieldMark />
            <span>
              Scam<span className={styles.logoAccent}>Shield</span>
            </span>
          </Link>

          <nav className={styles.navLinks} aria-label="Main">
            {LINKS.map((link) => {
              const active = isActive(link.href);
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

          <div className={styles.navRight}>
            {pathname !== "/analyze" && (
              <Link href="/analyze" className={styles.navCta}>
                Check a message
              </Link>
            )}
            <button
              type="button"
              className={styles.navToggle}
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>

        {open && (
          <nav id="mobile-nav" className={styles.mobileMenu} aria-label="Main (mobile)">
            {LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={active ? `${styles.mobileLink} ${styles.mobileLinkActive}` : styles.mobileLink}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}

/** Shield drawn as a scan aperture rather than a padlock. */
export function ShieldMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 1.5 3.5 4.6v6.1c0 4.5 3.1 8.3 7.5 9.8 4.4-1.5 7.5-5.3 7.5-9.8V4.6L11 1.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.5 10.4h9" stroke="#E5533A" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {open ? (
        <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <path d="M2.5 5.5h11M2.5 10.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default SiteNav;
