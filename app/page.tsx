import Link from "next/link";
import { ScamShieldHero } from "../components/ui/scamshield-hero";
import { LandingDemo } from "../components/ui/landing-demo";
import { SiteNav } from "../components/ui/site-nav";
import { SiteFooter } from "../components/ui/site-footer";
import { FlickeringGrid } from "../components/ui/flickering-grid";
import styles from "../components/ui/scamshield.module.css";

/**
 * ScamShield landing page.
 *
 * Server component. Client JavaScript on this route is limited to the hero's
 * pointer tilt, the nav's mobile menu and the live demo, which runs the
 * deterministic engine locally.
 *
 * This page calls no API route. Every path to full analysis goes through
 * /analyze and the existing backend.
 */

const IMPOSTORS = ["Your bank", "Delivery firms", "Employers", "Payment apps", "Government offices"];

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
    text: "A risk score, the exact phrases that triggered it, and the attack path they lead to.",
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
      <FlickeringGrid className={styles.backdrop} />

      <SiteNav />

      <main>
        <div className={styles.shell}>
          <ScamShieldHero howItWorksId="how-it-works" />
        </div>

        {/* Who scammers pretend to be */}
        <div className={styles.impostorBar}>
          <div className={styles.shell}>
            <div className={styles.impostorInner}>
              <span className={styles.impostorLabel}>SCAMMERS PRETEND TO BE</span>
              <ul className={styles.impostorList}>
                {IMPOSTORS.map((name) => (
                  <li key={name} className={styles.impostorItem}>{name}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 1 — Capabilities */}
        <section className={styles.section} aria-labelledby="capabilities-heading">
          <div className={styles.shell}>
            <div className={`${styles.sectionHead} ${styles.reveal}`}>
              <p className={styles.sectionLabel}>THREE WAYS IN</p>
              <h2 id="capabilities-heading" className={styles.sectionTitle}>
                Whatever reached you, check it.{" "}
                <span className={styles.sectionTitleMuted}>Scams don&rsquo;t look like scams anymore.</span>
              </h2>
              <p className={styles.sectionLead}>
                The obvious tells are gone. Modern scams copy the exact tone and branding of
                organisations you already trust. So ScamShield looks past the surface to what the
                message is actually asking you to do.
              </p>
            </div>

            <div className={styles.capGrid}>
              <article className={`${styles.capCard} ${styles.reveal}`}>
                <div className={styles.capCopy}>
                  <span className={styles.capIndex}>01 &middot; TEXT</span>
                  <h3 className={styles.capName}>Message analysis</h3>
                  <p className={styles.capText}>
                    SMS, WhatsApp, email. Every phrase that applies pressure or asks for something
                    sensitive is pulled out as evidence.
                  </p>
                </div>
                <div className={styles.capVisual} aria-hidden="true">
                  <p className={styles.capMsg}>
                    Congratulations! Selected for a <mark>₹60,000/month</mark> internship.{" "}
                    <mark>Pay ₹1,999 registration fee</mark> to confirm <mark>before 6 PM today</mark>.
                  </p>
                  <div className={styles.capTags}>
                    <span className={styles.capTag}>REWARD BAIT</span>
                    <span className={styles.capTag}>UPFRONT FEE</span>
                    <span className={styles.capTag}>DEADLINE</span>
                  </div>
                </div>
              </article>

              <article className={`${styles.capCard} ${styles.reveal}`}>
                <div className={styles.capCopy}>
                  <span className={styles.capIndex}>02 &middot; URL</span>
                  <h3 className={styles.capName}>Link analysis</h3>
                  <p className={styles.capText}>
                    Links are taken apart as text &mdash; never opened &mdash; to expose lookalike
                    domains, buried subdomains and login-shaped paths.
                  </p>
                </div>
                <div className={styles.capVisual} aria-hidden="true">
                  <div className={styles.urlParts}>
                    <span className={`${styles.urlPart} ${styles.urlPartBad}`}>
                      <code>http://</code>
                      <span>NO TLS</span>
                    </span>
                    <span className={`${styles.urlPart} ${styles.urlPartBad}`}>
                      <code>sbi-secure-login.example</code>
                      <span>LOOKALIKE</span>
                    </span>
                    <span className={styles.urlPart}>
                      <code>/kyc</code>
                      <span>PATH</span>
                    </span>
                  </div>
                  <dl className={styles.urlFacts}>
                    <dt>Claims to be</dt>
                    <dd>SBI</dd>
                    <dt>Official domain</dt>
                    <dd>No match</dd>
                  </dl>
                </div>
              </article>

              <article className={`${styles.capCard} ${styles.reveal}`}>
                <div className={styles.capCopy}>
                  <span className={styles.capIndex}>03 &middot; IMAGE</span>
                  <h3 className={styles.capName}>Screenshot analysis</h3>
                  <p className={styles.capText}>
                    Upload a screenshot of a chat or email. The text is read from the image, then
                    scored by the same engine as a pasted message.
                  </p>
                </div>
                <div className={styles.capVisual} aria-hidden="true" style={{ paddingBottom: 0 }}>
                  <div className={styles.shot}>
                    <div className={styles.shotScan} />
                    <div className={styles.shotBubble}>
                      <span className={styles.shotLine} style={{ width: "80%" }} />
                      <span className={styles.shotLine} style={{ width: "95%" }} />
                    </div>
                    <div className={styles.shotBubble}>
                      Enter your UPI PIN to receive ₹5,000
                    </div>
                    <div className={styles.shotBubble}>
                      <span className={styles.shotLine} style={{ width: "60%" }} />
                    </div>
                  </div>
                  <span className={styles.shotOut}>text extracted &rarr; scored</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* 2 — Live demo */}
        <section className={`${styles.section} ${styles.sectionRule}`} aria-labelledby="demo-heading">
          <div className={styles.shell}>
            <div className={`${styles.sectionHeadCenter} ${styles.reveal}`}>
              <p className={styles.sectionLabel}>TRY IT HERE</p>
              <h2 id="demo-heading" className={styles.sectionTitle}>Watch the engine think.</h2>
              <p className={styles.sectionLead}>
                Edit the message and see ScamShield&rsquo;s pattern checks respond as you type.
                These are the real rules the server runs first &mdash; running right here in your
                browser.
              </p>
            </div>

            <LandingDemo />
          </div>
        </section>

        {/* 3 — How it works */}
        <section className={`${styles.section} ${styles.sectionRule}`} id="how-it-works" aria-labelledby="how-heading">
          <div className={styles.shell}>
            <div className={`${styles.sectionHead} ${styles.reveal}`}>
              <p className={styles.sectionLabel}>HOW IT WORKS</p>
              <h2 id="how-heading" className={styles.sectionTitle}>
                Four steps. <span className={styles.sectionTitleMuted}>About ten seconds.</span>
              </h2>
              <p className={styles.sectionLead}>
                You end up with more than a verdict &mdash; you end up understanding the message,
                which is what helps the next time one arrives.
              </p>
            </div>

            <ol className={`${styles.steps} ${styles.reveal}`}>
              {STEPS.map((step) => (
                <li key={step.num} className={styles.step}>
                  <span className={styles.stepNum}>{step.num}</span>
                  <p className={styles.stepName}>{step.name}</p>
                  <p className={styles.stepText}>{step.text}</p>
                </li>
              ))}
            </ol>

            <div className={styles.engine}>
              <div className={styles.reveal}>
                <p className={styles.sectionLabel}>UNDER THE HOOD</p>
                <h3 className={styles.engineTitle}>We don&rsquo;t just ask an AI if it&rsquo;s a scam.</h3>
                <p className={styles.engineText}>
                  An AI asked &ldquo;is this a scam?&rdquo; will answer confidently either way, and
                  you have no way to check it. So the deterministic engine runs first and runs
                  always. If the AI layer is unavailable, ScamShield still produces a complete
                  report from pattern analysis alone &mdash; and tells you so.
                </p>
              </div>

              <div className={`${styles.pipeline} ${styles.reveal}`}>
                {PIPELINE.map((stage, i) => (
                  <div key={stage.index}>
                    <div className={stage.accent ? `${styles.pipeStage} ${styles.pipeStageAccent}` : styles.pipeStage}>
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
          </div>
        </section>

        {/* 4 — What it detects */}
        <section className={`${styles.section} ${styles.sectionRule}`} aria-labelledby="detects-heading">
          <div className={styles.shell}>
            <div className={`${styles.sectionHead} ${styles.reveal}`}>
              <p className={styles.sectionLabel}>WHAT SCAMSHIELD DETECTS</p>
              <h2 id="detects-heading" className={styles.sectionTitle}>The mechanics behind almost every scam.</h2>
              <p className={styles.sectionLead}>
                Scams vary enormously in story and almost not at all in structure. These four
                mechanics carry most of them.
              </p>
            </div>

            <div className={styles.detects}>
              {DETECTS.map((detect) => (
                <article key={detect.name} className={`${styles.detect} ${styles.reveal}`}>
                  <h3 className={styles.detectName}>{detect.name}</h3>
                  <p className={styles.detectText}>{detect.text}</p>
                  <p className={styles.detectExample}>{detect.example}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5 — Final CTA */}
        <section className={styles.finale}>
          <div className={styles.shell}>
            <h2 className={`${styles.finaleTitle} ${styles.reveal}`}>Before you click, check.</h2>
            <p className={styles.finaleText}>Turn a suspicious message into a clear answer in seconds.</p>
            <div className={styles.finaleCta}>
              <Link href="/analyze" className={styles.ctaPrimary}>
                Analyze Something Suspicious
                <span className={styles.ctaArrow} aria-hidden="true">&rarr;</span>
              </Link>
              <Link href="/simulator" className={styles.ctaSecondary}>
                Test yourself first
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
