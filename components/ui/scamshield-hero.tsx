"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./scamshield.module.css";

/**
 * ScamShield hero.
 *
 * Interaction notes:
 * - Pointer tilt is written to CSS custom properties (--px/--py) and applied by
 *   CSS transforms. JS never touches style.transform directly, so the reduced
 *   motion rules in the stylesheet can override everything in one place.
 * - Updates are throttled to one per animation frame.
 * - Tilt is skipped entirely on coarse pointers (touch) and reduced motion.
 */

/**
 * Illustrative data for the hero visual.
 *
 * This is a fixed example used to show what a report looks like — it is NOT a
 * live analysis and is labelled as an example in the UI. Real analysis happens
 * on /analyze through the existing API routes.
 */
const EXAMPLE_SIGNALS = ["URGENCY", "BRAND IMPERSONATION", "SUSPICIOUS URL", "CREDENTIAL REQUEST"] as const;

const EXAMPLE_PATH = ["Fake message", "Lookalike link", "Fake login", "Credential theft"] as const;

const EXAMPLE_SCORE = 92;

export function ScamShieldHero({ howItWorksId = "how-it-works" }: { howItWorksId?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const [tiltEnabled, setTiltEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => setTiltEnabled(fine.matches && !calm.matches);
    sync();

    fine.addEventListener("change", sync);
    calm.addEventListener("change", sync);
    return () => {
      fine.removeEventListener("change", sync);
      calm.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const applyPointer = useCallback(() => {
    frameRef.current = null;
    const stage = stageRef.current;
    const next = pendingRef.current;
    if (!stage || !next) return;
    stage.style.setProperty("--px", next.x.toFixed(3));
    stage.style.setProperty("--py", next.y.toFixed(3));
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!tiltEnabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      pendingRef.current = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
      };
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(applyPointer);
      }
    },
    [applyPointer, tiltEnabled],
  );

  const resetPointer = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    pendingRef.current = { x: 0, y: 0 };
    stage.style.setProperty("--px", "0");
    stage.style.setProperty("--py", "0");
  }, []);

  const scrollToExplanation = useCallback(() => {
    const target = document.getElementById(howItWorksId);
    if (!target) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    // Move focus so keyboard users land where the page just scrolled.
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }, [howItWorksId]);

  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      {/* Copy column */}
      <div>
        <p className={styles.capStrip}>
          <span className={styles.capLive}>
            <span className={styles.statusDot} aria-hidden="true" />
            ANALYZES
          </span>
          <span className={styles.capItem}>TEXT</span>
          <span className={styles.capSep} aria-hidden="true">&bull;</span>
          <span className={styles.capItem}>URL</span>
          <span className={styles.capSep} aria-hidden="true">&bull;</span>
          <span className={styles.capItem}>IMAGE</span>
        </p>

        <h1 id="hero-heading" className={styles.headline}>
          Think it&rsquo;s a scam?
          <span className={styles.headlineProve}>Let&rsquo;s prove it.</span>
        </h1>

        <p className={styles.sub}>
          <strong>ScamShield helps people detect scams before they become victims.</strong> Paste a
          message, a link or a screenshot and get a risk score, the evidence behind it, and exactly
          what to do next.
        </p>

        <div className={styles.ctaRow}>
          <Link href="/analyze" className={styles.ctaPrimary}>
            Analyze Something Suspicious
            <span className={styles.ctaArrow} aria-hidden="true">&rarr;</span>
          </Link>

          <button type="button" onClick={scrollToExplanation} className={styles.ctaSecondary}>
            See How It Works
          </button>
        </div>

        <ul className={styles.trustRow}>
          <li>Free, no sign-up</li>
          <li>Links are never opened</li>
          <li>Nothing stored unless you save</li>
        </ul>
      </div>

      {/* Threat analysis visual */}
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
      >
        <div className={styles.stageGlow} aria-hidden="true" />

        <div className={`${styles.chip} ${styles.chipTop}`} aria-hidden="true">
          <span className={styles.chipDotCyan} />
          Link read as text
        </div>

        <div className={`${styles.chip} ${styles.chipBottom}`} aria-hidden="true">
          <span className={styles.chipDotAmber} />
          4 signals &middot; rules + AI
        </div>

        {/*
          Decorative-but-informative: screen readers get a single clear summary
          instead of walking a stack of example widgets.
        */}
        <div
          className={styles.card}
          role="img"
          aria-label={`Example ScamShield report: risk score ${EXAMPLE_SCORE} out of 100, high risk, with urgency, brand impersonation, suspicious URL and credential request detected.`}
        >
          <div className={styles.cardScan} aria-hidden="true" />

          <div className={styles.cardHead} aria-hidden="true">
            <span className={styles.cardDots}>
              <span />
              <span />
              <span />
            </span>
            <span className={styles.cardTitle}>THREAT REPORT</span>
            <span className={styles.cardBadge}>EXAMPLE</span>
          </div>

          <p className={styles.cardInput} aria-hidden="true">
            <mark>URGENT:</mark> Your SBI account will be <mark>blocked today</mark>. Complete KYC
            at <mark>sbi-secure-login.example</mark>
          </p>

          <div className={styles.cardBody} aria-hidden="true">
            <p className={styles.verdict}>
              <span className={styles.verdictDot} />
              HIGH RISK &middot; PHISHING
            </p>

            <div className={styles.scoreRow}>
              <span>
                <span className={styles.scoreValue}>{EXAMPLE_SCORE}</span>
                <span className={styles.scoreOutOf}> / 100</span>
              </span>
              <span className={styles.scoreLabel}>RISK SCORE</span>
            </div>

            <div className={styles.meter}>
              <div className={styles.meterFill} style={{ width: `${EXAMPLE_SCORE}%` }} />
            </div>

            <div className={styles.signals}>
              {EXAMPLE_SIGNALS.map((signal, i) => (
                <div key={signal} className={styles.signal} style={{ animationDelay: `${0.5 + i * 0.12}s` }}>
                  <span className={styles.signalIcon}>&#9650;</span>
                  <span className={styles.signalName}>{signal}</span>
                </div>
              ))}
            </div>

            <p className={styles.pathHead}>ATTACK PATH</p>

            <div className={styles.path}>
              {EXAMPLE_PATH.map((step, i) => (
                <span key={step} className={styles.pathStep}>
                  <span
                    className={
                      i === EXAMPLE_PATH.length - 1 ? `${styles.pathNode} ${styles.pathNodeEnd}` : styles.pathNode
                    }
                  />
                  {step}
                  {i < EXAMPLE_PATH.length - 1 && <span className={styles.pathLink}>&rarr;</span>}
                </span>
              ))}
            </div>
          </div>

          <p className={styles.cardFoot}>Illustrative example. Your own messages are scored by the live engine.</p>
        </div>
      </div>
    </section>
  );
}

export default ScamShieldHero;
