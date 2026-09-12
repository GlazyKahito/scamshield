"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./scamshield.module.css";

/**
 * ScamShield hero.
 *
 * Adapted from a scroll-locked video hero's visual system: layered depth,
 * glass surfaces, cursor-reactive 3D, cinematic glow. The semantics are
 * entirely rebuilt around threat analysis — there is no media, transport or
 * playlist concept anywhere in here.
 *
 * Interaction notes:
 * - Pointer tilt is written to CSS custom properties (--px/--py) and applied by
 *   CSS transforms. JS never touches style.transform directly, so the reduced
 *   motion rules in the stylesheet can override everything in one place.
 * - Updates are throttled to one per animation frame. Without this, a pointer
 *   move handler writing to the DOM will fire far more often than the screen
 *   can repaint and drop frames on mid-range hardware.
 * - Tilt is skipped entirely on coarse pointers (touch), where there is no
 *   cursor to react to and the effect would only cost battery.
 */

/**
 * Illustrative data for the hero visual.
 *
 * This is a fixed example used to show what a report looks like — it is NOT a
 * live analysis and is labelled as an example in the UI. Real analysis happens
 * on /analyze through the existing API routes.
 */
const EXAMPLE_SIGNALS = [
  { name: "URGENCY", level: "HIGH" },
  { name: "BRAND IMPERSONATION", level: "HIGH" },
  { name: "SUSPICIOUS URL", level: "HIGH" },
  { name: "CREDENTIAL REQUEST", level: "HIGH" },
] as const;

const EXAMPLE_PATH = [
  "Attacker",
  "Fake message",
  "Suspicious link",
  "Fake login page",
  "Credential theft",
] as const;

const EXAMPLE_SCORE = 92;

export function ScamShieldHero({ howItWorksId = "how-it-works" }: { howItWorksId?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const [tiltEnabled, setTiltEnabled] = useState(false);

  useEffect(() => {
    // Enable tilt only where it makes sense: a fine pointer, motion allowed.
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
      // Normalise to -1..1 around the centre of the stage.
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
        <p className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          SECURITY ENGINE ONLINE
        </p>

        <h1 id="hero-heading" className={styles.headline}>
          Think it&rsquo;s a scam?
          <span className={styles.headlineProve}>Let&rsquo;s prove it.</span>
        </h1>

        <p className={styles.sub}>
          Analyze suspicious messages, URLs, and screenshots with AI-powered security analysis.
        </p>

        <div className={styles.ctaRow}>
          <Link href="/analyze" className={styles.ctaPrimary}>
            Analyze Something Suspicious
          </Link>

          <button type="button" onClick={scrollToExplanation} className={styles.ctaSecondary}>
            See How It Works
          </button>
        </div>

        <p className={styles.heroNote}>
          Free and no sign-up. Links are read as text &mdash; ScamShield never opens them.
        </p>
      </div>

      {/* Threat analysis visual */}
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
      >
        <div className={styles.stageGlow} aria-hidden="true" />

        <div className={styles.chip + " " + styles.chipTop} aria-hidden="true">
          <span className={styles.chipDotCyan} />
          Link never opened
        </div>

        <div className={styles.chip + " " + styles.chipBottom} aria-hidden="true">
          <span className={styles.chipDotAmber} />
          4 signals detected
        </div>

        {/*
          The card is decorative-but-informative: screen readers get a single
          clear summary instead of walking a table of fake widget rows.
        */}
        <div
          className={styles.card}
          role="img"
          aria-label={`Example ScamShield report: risk score ${EXAMPLE_SCORE} out of 100, high risk, with urgency, brand impersonation, suspicious URL and credential request detected.`}
        >
          <div className={styles.cardScan} aria-hidden="true" />

          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>SCAMSHIELD SECURITY ANALYSIS</span>
            <span className={styles.cardBadge}>EXAMPLE</span>
          </div>

          <div className={styles.cardBody} aria-hidden="true">
            <p className={styles.verdict}>
              <span className={styles.verdictDot} />
              THREAT DETECTED
            </p>

            <div className={styles.scoreRow}>
              <span className={styles.scoreLabel}>RISK SCORE</span>
              <span>
                <span className={styles.scoreValue}>{EXAMPLE_SCORE}</span>
                <span className={styles.scoreOutOf}> / 100</span>
              </span>
            </div>

            <div className={styles.meter}>
              <div className={styles.meterFill} style={{ width: `${EXAMPLE_SCORE}%` }} />
            </div>

            <div className={styles.signals}>
              {EXAMPLE_SIGNALS.map((signal, i) => (
                <div
                  key={signal.name}
                  className={styles.signal}
                  style={{ animationDelay: `${0.5 + i * 0.13}s` }}
                >
                  <span className={styles.signalIcon}>&#9888;</span>
                  <span className={styles.signalName}>{signal.name}</span>
                  <span className={styles.signalLevel}>{signal.level}</span>
                </div>
              ))}
            </div>

            <p className={styles.pathHead}>ATTACK PATH</p>

            <div className={styles.path}>
              {EXAMPLE_PATH.map((step, i) => (
                <div key={step}>
                  <div className={styles.pathStep}>
                    <span
                      className={
                        i === EXAMPLE_PATH.length - 1
                          ? styles.pathNode + " " + styles.pathNodeEnd
                          : styles.pathNode
                      }
                    />
                    {step}
                  </div>
                  {i < EXAMPLE_PATH.length - 1 && <div className={styles.pathLink} />}
                </div>
              ))}
            </div>
          </div>

          <p className={styles.cardFoot}>
            Illustrative example. Your own messages are scored by the live engine.
          </p>
        </div>
      </div>
    </section>
  );
}

export default ScamShieldHero;
