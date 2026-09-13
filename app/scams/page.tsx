"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES, SCAM_LIBRARY, type ScamEntry } from "../../lib/content/scam-library";
import { setAnalyzerDraft } from "../../lib/storage/draft";
import { SiteNav } from "../../components/ui/site-nav";
import { SiteFooter } from "../../components/ui/site-footer";
import styles from "../../components/ui/pages.module.css";

/**
 * /scams — a browsable knowledge interface.
 *
 * Desktop: an index on the left, the selected entry on the right.
 * Mobile: the same index, with the selected entry opening inline beneath it.
 * Filtering and search are client-side over a small fixed dataset.
 */

function EntryDetail({ entry }: { entry: ScamEntry }) {
  const router = useRouter();

  const checkExample = () => {
    setAnalyzerDraft({ mode: "MESSAGE", value: entry.example });
    router.push("/analyze");
  };

  return (
    <>
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
        <ul className={styles.redFlags}>
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

      <div className={styles.detailActions}>
        <button type="button" className={styles.btnPrimary} onClick={checkExample}>
          Analyze this example
        </button>
        <Link href="/simulator" className={styles.btnGhost}>
          Test yourself
        </Link>
      </div>
    </>
  );
}

export default function ScamLibraryPage() {
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(SCAM_LIBRARY[0]?.id ?? null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of SCAM_LIBRARY) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return map;
  }, []);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SCAM_LIBRARY.filter((e) => {
      if (filter && e.category !== filter) return false;
      if (!q) return true;
      return [e.name, e.category, e.hook, e.looksLike, e.example, e.wants, e.whatToDo, ...e.redFlags]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filter, query]);

  // Keep a sensible selection on desktop when filters hide the current entry.
  const selected = entries.find((e) => e.id === openId) ?? entries[0] ?? null;

  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shell} data-reveal-stagger>
          <p className={styles.eyebrow}>SCAM LIBRARY &middot; {SCAM_LIBRARY.length} PATTERNS</p>
          <h1 className={styles.title}>Know the shapes before they reach you.</h1>
          <p className={styles.lead}>
            Scams vary enormously in story and almost not at all in structure. Learn the structure
            once and the story stops mattering.
          </p>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shell}>
          <div className={styles.libControls}>
            <label className={styles.search}>
              <span className="sr-only">Search the scam library</span>
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search e.g. OTP, refund, KYC"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            <div className={styles.chipRow} role="group" aria-label="Filter by category">
              <button
                type="button"
                className={filter === null ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                onClick={() => setFilter(null)}
                aria-pressed={filter === null}
              >
                All <span className={styles.chipCount}>{SCAM_LIBRARY.length}</span>
              </button>
              {CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0).map((category) => (
                <button
                  key={category}
                  type="button"
                  className={filter === category ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  onClick={() => setFilter(filter === category ? null : category)}
                  aria-pressed={filter === category}
                >
                  {category} <span className={styles.chipCount}>{counts.get(category)}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="sr-only" aria-live="polite">
            {entries.length} of {SCAM_LIBRARY.length} scam patterns shown
          </p>

          {entries.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Nothing matches that</p>
              <p className={styles.emptyText}>
                Try a broader word, or clear the filters. If you have a real message in front of you,
                the analyzer will read it directly.
              </p>
              <div className={styles.emptyActions}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => {
                    setQuery("");
                    setFilter(null);
                  }}
                >
                  Clear filters
                </button>
                <Link href="/analyze" className={styles.btnPrimary}>Check a real message</Link>
              </div>
            </div>
          ) : (
            <div className={styles.libLayout}>
              <ul className={styles.libIndex}>
                {entries.map((entry) => {
                  const isSelected = selected?.id === entry.id;
                  // On mobile the entry toggles; on desktop it just selects.
                  const expanded = openId === entry.id;
                  return (
                    <li key={entry.id} className={isSelected ? `${styles.entry} ${styles.entryOn}` : styles.entry}>
                      <button
                        type="button"
                        className={styles.entryBtn}
                        aria-expanded={expanded}
                        onClick={() => {
                          const desktop = window.matchMedia("(min-width: 900px)").matches;
                          setOpenId(expanded && !desktop ? null : entry.id);
                        }}
                      >
                        <span className={styles.entryTop}>
                          <span className={styles.entryCat}>{entry.category}</span>
                          <span className={styles.entrySign} aria-hidden="true">{expanded ? "–" : "+"}</span>
                        </span>
                        <span className={styles.entryName}>{entry.name}</span>
                        <span className={styles.entryHook}>{entry.hook}</span>
                      </button>

                      {expanded && (
                        <div className={styles.entryInline}>
                          <EntryDetail entry={entry} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {selected && (
                <div className={styles.libDetail}>
                  <article key={selected.id} className={styles.detail}>
                    <p className={styles.entryCat} style={{ color: "var(--signal)" }}>{selected.category}</p>
                    <h2 className={styles.detailTitle}>{selected.name}</h2>
                    <p className={styles.detailHook}>{selected.hook}</p>
                    <EntryDetail entry={selected} />
                  </article>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
