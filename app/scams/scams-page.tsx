"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, SCAM_LIBRARY } from "../../lib/content/scam-library";
import { SiteNav } from "../../components/ui/site-nav";
import styles from "../../components/ui/pages.module.css";

/**
 * /scams — a browsable knowledge interface.
 *
 * Entries are collapsed by default so the page can be scanned first and read
 * second. Filtering is client-side over a small fixed dataset.
 */
export default function ScamLibraryPage() {
  const [filter, setFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(SCAM_LIBRARY[0]?.id ?? null);

  const entries = useMemo(
    () => (filter ? SCAM_LIBRARY.filter((e) => e.category === filter) : SCAM_LIBRARY),
    [filter],
  );

  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shellNarrow}>
          <p className={styles.eyebrow}>SCAM LIBRARY</p>
          <h1 className={styles.title}>Know the shapes before they reach you</h1>
          <p className={styles.lead}>
            Scams vary enormously in story and almost not at all in structure. Learn the structure
            once and the story stops mattering.
          </p>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shellNarrow}>
          <div className={styles.filterRow} role="group" aria-label="Filter by category">
            <button
              type="button"
              className={filter === null ? `${styles.exampleBtn} ${styles.tabActive}` : styles.exampleBtn}
              onClick={() => setFilter(null)}
              aria-pressed={filter === null}
            >
              All
            </button>
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={filter === category ? `${styles.exampleBtn} ${styles.tabActive}` : styles.exampleBtn}
                onClick={() => setFilter(category)}
                aria-pressed={filter === category}
              >
                {category}
              </button>
            ))}
          </div>

          {entries.map((entry) => {
            const open = openId === entry.id;
            return (
              <article key={entry.id} className={styles.entry}>
                <h2 style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={styles.entryBtn}
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : entry.id)}
                  >
                    <span className={styles.entryTop}>
                      <span className={styles.entryName}>{entry.name}</span>
                      <span className={styles.chainSign} aria-hidden="true">{open ? "–" : "+"}</span>
                    </span>
                    <span className={styles.entryHook}>{entry.hook}</span>
                  </button>
                </h2>

                {open && (
                  <div className={styles.entryBody}>
                    <div className={styles.entryBlock}>
                      <p className={styles.entryLabel}>WHAT IT LOOKS LIKE</p>
                      <p className={styles.entryText}>{entry.looksLike}</p>
                    </div>

                    <div className={styles.entryBlock}>
                      <p className={styles.entryLabel}>A FICTIONAL EXAMPLE</p>
                      <p className={styles.quote}>{entry.example}</p>
                    </div>

                    <div className={styles.entryBlock}>
                      <p className={styles.entryLabel}>RED FLAGS</p>
                      <ul className={styles.flagList}>
                        {entry.redFlags.map((flag) => (
                          <li key={flag}>{flag}</li>
                        ))}
                      </ul>
                    </div>

                    <div className={styles.entryBlock}>
                      <p className={styles.entryLabel}>WHAT THE ATTACKER WANTS</p>
                      <p className={styles.entryText}>{entry.wants}</p>
                    </div>

                    <div className={styles.entryBlock}>
                      <p className={styles.entryLabel}>WHAT TO DO</p>
                      <p className={styles.entryText}>{entry.whatToDo}</p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          <div className={styles.actions} style={{ marginTop: 34 }}>
            <Link href="/simulator" className={styles.btnPrimary}>Test yourself on these</Link>
            <Link href="/analyze" className={styles.btnGhost}>Check a real message</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
