import Link from "next/link";
import { ScamShieldHero } from "../components/ui/scamshield-hero";
import { SiteNav } from "../components/ui/site-nav";
import styles from "../components/ui/scamshield.module.css";

/**
 * ScamShield landing page.
 *
 * Server component: everything here is static markup and CSS animation. The
 * only client JavaScript on this route is the hero's pointer tilt and the nav's
 * mobile menu, so the page stays light on mobile.
 *
 * This page touches no API route and performs no analysis. Every path to real
 * analysis goes through /analyze and the existing backend.
 */

const IMPOSTORS = [
  { name: "Your bank", text: "KYC deadlines and account-blocked warnings" },
  { name: "Delivery firms", text: "Held parcels and small customs fees" },
  { name: "Employers", text: "Offers that ask you to pay to start" },
  { name: "Payment apps", text: "Refunds that need your PIN to arrive" },
  { name: "Government", text: "Penalties and cases that do not exist" },
];

const STEPS = [
  {
    num: "01",
    name: "Paste",
    text: "Drop in a suspicious message, a link, or a screenshot. Nothing is stored unless you choose to save it.",
  },
  {
    num: "02",
    name: "Analyze",
    text: "A deterministic security engine checks the structure, then AI reads the intent behind the words.",
  },
  {
    num: "03",
    name: "Understand",
    text: "You get a risk score, the exact phrases that triggered it, and the attack path they lead to.",
  },
  {
    num: "04",
    name: "Act",
    text: "Clear, specific next steps for that kind of scam — not a generic warning to be careful.",
  },
];

const DETECTS = [
  {
    name: "URGENT PRESSURE",
    text: "Deadlines, threats and countdowns exist to stop you checking with anyone else. A real organisation will let you call them back.",
    example: "\"Your account will be blocked today\"",
  },
  {
    name: "BRAND IMPERSONATION",
    text: "We compare the brand a message claims against the domain it actually links to, and flag the gap between them.",
    example: "Says SBI → links to sbi-secure-login.example",
  },
  {
    name: "SUSPICIOUS LINKS",
    text: "URLs are parsed as text: raw IP hosts, punycode, buried subdomains, shorteners, login-shaped paths. Never opened.",
    example: "verify.account.secure.xyz/login",
  },
  {
    name: "CREDENTIAL THEFT",
    text: "Requests for passwords, OTPs, card details or a UPI PIN. An incoming payment never needs your PIN.",
    example: "\"Enter your UPI PIN to receive ₹5,000\"",
  },
];

const PIPELINE = [
  { index: "01", name: "User input", text: "Message, URL or screenshot. Validated and size-limited before anything runs.", accent: false },
  { index: "02", name: "Deterministic security engine", text: "Pattern rules and URL structure analysis. No AI involved, and it runs on every request.", accent: true },
  { index: "03", name: "AI analysis", text: "Gemini reads intent and pressure. Submitted content is fenced as untrusted data, never obeyed as instructions.", accent: false },
  { index: "04", name: "Risk engine", text: "Both scores are deduplicated, weighted and combined into one auditable number.", accent: true },
  { index: "05", name: "Structured threat report", text: "Score, evidence, attack path and contextual actions — every claim traceable to a detected signal.", accent: false },
];

export default function Home() {
  return (
    <div className={styles.root}>
      {/* Ambient depth layers */}
      <div className={styles.ambient} aria-hidden="true">
        <div className={`${styles.ambientGlow} ${styles.ambientGlowCyan}`} />
        <div className={`${styles.ambientGlow} ${styles.ambientGlowAmber}`} />
        <div className={styles.ambientGrid} />
        <div className={styles.grain} />
      </div>

      <SiteNav />

      <main>
        <div className={styles.shell}>
          <ScamShieldHero howItWorksId="how-it-works" />
        </div>

        {/* 1 — Problem */}
        <section className={styles.section}>
          <div className={styles.shell}>
            <p className={styles.sectionLabel}>THE PROBLEM</p>
            <h2 className={styles.sectionTitle}>Scams don&rsquo;t look like scams anymore.</h2>
            <p className={styles.sectionLead}>
              The obvious tells are gone. No broken English, no strange formatting. Modern scams
              copy the exact tone, logo and phrasing of organisations you already deal with, and
              they arrive on the same channels those organisations use. The question is no longer
              whether a message looks real &mdash; it is whether the request inside it makes sense.
            </p>

            <div className={styles.impostors}>
              {IMPOSTORS.map((impostor) => (
                <div key={impostor.name} className={styles.impostor}>
                  <p className={styles.impostorName}>{impostor.name}</p>
                  <p className={styles.impostorText}>{impostor.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2 — How it works */}
        <section className={styles.section} id="how-it-works">
          <div className={styles.shell}>
            <p className={styles.sectionLabel}>HOW IT WORKS</p>
            <h2 className={styles.sectionTitle}>Four steps, about ten seconds.</h2>
            <p className={styles.sectionLead}>
              You end up with more than a verdict: you end up understanding the message, which is
              what helps the next time one arrives.
            </p>

            <ol className={styles.steps}>
              {STEPS.map((step) => (
                <li key={step.num} className={styles.step}>
                  <span className={styles.stepNum}>{step.num}</span>
                  <p className={styles.stepName}>{step.name}</p>
                  <p className={styles.stepText}>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3 — What it detects */}
        <section className={styles.section}>
          <div className={styles.shell}>
            <p className={styles.sectionLabel}>WHAT SCAMSHIELD DETECTS</p>
            <h2 className={styles.sectionTitle}>The mechanics behind almost every scam.</h2>
            <p className={styles.sectionLead}>
              Scams vary enormously in story and almost not at all in structure. These four
              mechanics carry most of them.
            </p>

            <div className={styles.detects}>
              {DETECTS.map((detect) => (
                <article key={detect.name} className={styles.detect}>
                  <h3 className={styles.detectName}>{detect.name}</h3>
                  <p className={styles.detectText}>{detect.text}</p>
                  <p className={styles.detectExample}>{detect.example}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4 — Security engine architecture */}
        <section className={styles.section}>
          <div className={styles.shell}>
            <p className={styles.sectionLabel}>UNDER THE HOOD</p>
            <h2 className={styles.sectionTitle}>We don&rsquo;t just ask an AI if it&rsquo;s a scam.</h2>
            <p className={styles.sectionLead}>
              An AI asked &ldquo;is this a scam?&rdquo; will answer confidently either way, and you
              have no way to check it. So the deterministic engine runs first and runs always. If
              the AI layer is unavailable, ScamShield still produces a complete report from pattern
              analysis alone.
            </p>

            <div className={styles.pipeline}>
              {PIPELINE.map((stage, i) => (
                <div key={stage.index}>
                  <div
                    className={
                      stage.accent
                        ? `${styles.pipeStage} ${styles.pipeStageAccent}`
                        : styles.pipeStage
                    }
                  >
                    <span className={styles.pipeIndex}>{stage.index}</span>
                    <div>
                      <p className={styles.pipeName}>{stage.name}</p>
                      <p className={styles.pipeText}>{stage.text}</p>
                    </div>
                  </div>
                  {i < PIPELINE.length - 1 && <div className={styles.pipeArrow} aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5 — Final CTA */}
        <section className={styles.finale}>
          <div className={styles.shell}>
            <h2 className={styles.finaleTitle}>Before you click, check.</h2>
            <p className={styles.finaleText}>Turn suspicious messages into clear answers.</p>
            <div className={styles.finaleCta}>
              <Link href="/analyze" className={styles.ctaPrimary}>
                Analyze Something Suspicious
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footerRow}>
            <span>ScamShield &mdash; stay skeptical, stay safe.</span>
            <nav className={styles.footerLinks} aria-label="Footer">
              <Link href="/analyze" className={styles.footerLink}>Analyze</Link>
              <Link href="/simulator" className={styles.footerLink}>Simulator</Link>
              <Link href="/scams" className={styles.footerLink}>Scam Library</Link>
              <Link href="/dashboard" className={styles.footerLink}>Dashboard</Link>
              <Link href="/about" className={styles.footerLink}>About</Link>
            </nav>
          </div>
          <p className={styles.footerNote}>
            ScamShield reports risk based on the text you provide. It cannot verify who owns a
            domain or who sent a message, so a low score is not a guarantee that something is
            genuine. When money or account access is involved, check through a channel you found
            yourself.
          </p>
        </div>
      </footer>
    </div>
  );
}
