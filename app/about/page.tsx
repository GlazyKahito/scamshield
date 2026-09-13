import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../../components/ui/site-nav";
import { SiteFooter } from "../../components/ui/site-footer";
import styles from "../../components/ui/pages.module.css";

export const metadata: Metadata = {
  title: "How ScamShield works",
  description: "Why ScamShield combines deterministic security rules with AI, and what it will not do.",
};

const ARCHITECTURE = [
  { idx: "01", name: "User input", text: "A message, link or screenshot. Validated and size-limited server-side before anything runs.", accent: false },
  { idx: "02", name: "Deterministic security engine", text: "Pattern rules and URL structure analysis. No AI involved. Runs on every single request.", accent: true },
  { idx: "03", name: "AI analysis", text: "Gemini reads intent and pressure. Submitted content is fenced as untrusted data and never obeyed as instructions.", accent: false },
  { idx: "04", name: "Risk engine", text: "Both scores are deduplicated by signal group, weighted, and combined into one auditable number.", accent: true },
  { idx: "05", name: "Structured threat report", text: "Score, evidence, attack path and contextual actions — every claim traceable to a detected signal.", accent: false },
];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shellNarrow} data-reveal-stagger>
          <p className={styles.eyebrow}>ABOUT</p>
          <h1 className={styles.title}>An AI security analyst for normal people</h1>
          <p className={styles.lead}>
            ScamShield explains suspicious messages instead of just judging them, because a
            conclusion you can check is worth more than one you have to trust.
          </p>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shellNarrow}>
          <section className={styles.proseBlock} data-reveal>
            <h2 className={styles.proseH}>The problem</h2>
            <p className={styles.proseP}>
              The old advice was to look for bad spelling and odd formatting. That advice is dead.
              Modern scams copy the exact tone, logo and phrasing of organisations you already deal
              with, and they arrive on the same channels those organisations use.
            </p>
            <p className={styles.proseP}>
              The people most often targeted — parents, grandparents, students taking a first
              internship offer — do not need another verdict to trust. They need to understand what
              they are looking at, so they recognise the next one without help.
            </p>
          </section>

          <section className={styles.proseBlock} data-reveal>
            <h2 className={styles.proseH}>Why rules and AI, not AI alone</h2>
            <p className={styles.proseP}>
              An AI asked &ldquo;is this a scam?&rdquo; will answer confidently either way, and you
              have no way to check it. So ScamShield runs a deterministic engine first: explicit
              rules for the mechanics scams depend on, and structural analysis of any link. That
              engine produces a complete report on its own.
            </p>
            <p className={styles.proseP}>
              The AI layer adds what pattern matching cannot judge — the pressure being applied and
              what the sender is actually trying to achieve. If it is unavailable, ScamShield says
              so on the report and falls back to the rules rather than failing. That is an
              architectural property, and it is covered by the test suite.
            </p>
          </section>

          <section className={styles.proseBlock} data-reveal>
            <h2 className={styles.proseH}>The architecture</h2>
            <div style={{ marginTop: 20, maxWidth: 720 }}>
              {ARCHITECTURE.map((stage, i) => (
                <div key={stage.idx}>
                  <div className={stage.accent ? `${styles.archStep} ${styles.archAccent}` : styles.archStep}>
                    <span className={styles.archIdx}>{stage.idx}</span>
                    <div>
                      <p className={styles.archName}>{stage.name}</p>
                      <p className={styles.archText}>{stage.text}</p>
                    </div>
                  </div>
                  {i < ARCHITECTURE.length - 1 && <div className={styles.archArrow} aria-hidden="true" />}
                </div>
              ))}
            </div>
          </section>

          <section className={styles.proseBlock} data-reveal>
            <h2 className={styles.proseH}>Privacy and safety</h2>
            <p className={styles.proseP}>
              Submitted messages are never written to application logs — errors record a reason code
              only. Nothing is stored unless you explicitly save a report, and saved reports live in
              your own browser, not on a server.
            </p>
            <p className={styles.proseP}>
              Links are parsed as text. ScamShield never opens, resolves, crawls or expands a
              submitted URL, including shortened ones, which are reported as unexpanded rather than
              followed. The AI key is read only in server-side code and is never sent to the browser.
            </p>
          </section>

          <section className={styles.proseBlock} data-reveal>
            <h2 className={styles.proseH}>What it will not claim</h2>
            <p className={styles.proseP}>
              ScamShield reports risk, not certainty. It never states that a domain or sender is
              definitively malicious, and it fabricates nothing — no reputation scores, no malware
              scans, no domain ownership records. It has access to none of those.
            </p>
            <p className={styles.proseP}>
              A low score means no known patterns matched the text you provided. It is not
              confirmation that a sender is genuine. Where a capability is missing, ScamShield says
              so rather than faking it.
            </p>
          </section>

          <div className={styles.actions} style={{ marginTop: 40 }}>
            <Link href="/analyze" className={styles.btnPrimary}>Check a message</Link>
            <Link href="/scams" className={styles.btnGhost}>Browse the scam library</Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
