"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreatReport } from "../../types/analysis";
import { MESSAGE_EXAMPLES } from "../../lib/content/examples";
import { saveReport } from "../../lib/storage/history";
import { CLASSIFICATION_LABEL, SEVERITY_COLOR } from "../report/severity";
import { ACCEPTED_IMAGE_LABEL, MAX_IMAGE_LABEL } from "../../lib/validation/limits";
import { CutReveal } from "../ui/motion/cut-reveal";
import { NumberTicker } from "../ui/motion/number-ticker";
import styles from "./threat-scanner.module.css";

/**
 * Home-page threat scanner.
 *
 * Every report shown here comes from POST /api/analyze — the same route and
 * pipeline as the full analyzer. Pipeline rows advance on a timer while the
 * request is in flight (the server returns a single response), and the final
 * stage holds until the real result lands.
 */

const MAX_TEXT = 8000;
const REQUEST_TIMEOUT_MS = 45_000;

const STAGES = ["INPUT RECEIVED", "RULE ENGINE", "URL STRUCTURE", "AI ANALYSIS", "RISK ASSESSMENT"] as const;
/** The AI call is the only slow step, so the animation waits there for the response. */
const AI_STAGE = 3;
const SLOW_AFTER_MS = 6000;

type Phase = "idle" | "running" | "done";

export function ThreatScanner({ exploreId }: { exploreId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState(0);
  const [report, setReport] = useState<ThreatReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [slow, setSlow] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const unmountedRef = useRef(false);

  const stopStages = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    timerRef.current = null;
    slowTimerRef.current = null;
    setSlow(false);
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      stopStages();
      abortRef.current?.abort();
    };
  }, [stopStages]);

  const trimmed = text.trim();
  const busy = phase === "running";
  const canSubmit = !busy && trimmed.length >= 3 && text.length <= MAX_TEXT;

  const analyze = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);
    setReport(null);
    setSaveFailed(false);
    setPhase("running");
    setStage(0);
    stopStages();
    timerRef.current = setInterval(() => {
      setStage((s) => Math.min(s + 1, AI_STAGE));
    }, 520);
    slowTimerRef.current = setTimeout(() => setSlow(true), SLOW_AFTER_MS);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
        signal: controller.signal,
      });
      const data: { success?: boolean; analysis?: ThreatReport; error?: string } = await response
        .json()
        .catch(() => ({}));
      if (unmountedRef.current) return;

      if (!response.ok || !data.success || !data.analysis) {
        setError(data.error ?? "Analysis failed. Please try again in a moment.");
        setPhase("idle");
        return;
      }

      setReport(data.analysis);
      setPhase("done");
      window.requestAnimationFrame(() => {
        const el = reportRef.current;
        if (!el) return;
        el.focus({ preventScroll: true });
        // Only bring the report's start into view when it landed below the fold.
        if (el.getBoundingClientRect().top > window.innerHeight * 0.75) {
          const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          el.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
        }
      });
    } catch {
      if (unmountedRef.current) return;
      setError(
        controller.signal.aborted
          ? "The analysis took too long. Please try again."
          : "Could not reach the analyzer. Check your connection and try again.",
      );
      setPhase("idle");
    } finally {
      clearTimeout(timeout);
      stopStages();
    }
  }, [canSubmit, trimmed, stopStages]);

  const reset = useCallback(() => {
    setReport(null);
    setPhase("idle");
    setError(null);
    setSaveFailed(false);
    setText("");
  }, []);

  const openFullReport = useCallback(() => {
    if (!report) return;
    if (saveReport(report)) router.push(`/report/${report.id}`);
    else setSaveFailed(true);
  }, [report, router]);

  const status = busy ? "PROCESSING" : phase === "done" ? "COMPLETE" : "READY";
  const severityColor = report ? SEVERITY_COLOR[report.severity] : undefined;
  const actions = report
    ? [...report.recommendedActions.filter((a) => a.type === "DONT"), ...report.recommendedActions.filter((a) => a.type === "DO")]
    : [];

  return (
    <section className={styles.scanner} aria-labelledby="scanner-heading">
      <div className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              SCAMSHIELD / THREAT ANALYSIS
            </p>
            <h1 id="scanner-heading" className={styles.headline}>
              <CutReveal delay={0.1}>Don’t get scammed.</CutReveal>
              <span className={styles.headlineMuted}>
                <CutReveal delay={0.32}>Know what you’re looking at.</CutReveal>
              </span>
            </h1>
            <p className={styles.lead}>
              Paste a suspicious message or link. ScamShield breaks down the threat before you act
              &mdash; the score, the evidence behind it, and what to do next.
            </p>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  if (canSubmit) {
                    void analyze();
                    return;
                  }
                  setError(
                    text.length > MAX_TEXT
                      ? `Messages are limited to ${MAX_TEXT.toLocaleString()} characters.`
                      : "Paste a suspicious message or link first — or load the example.",
                  );
                  inputRef.current?.focus();
                }}
                disabled={busy}
              >
                {busy ? "Analyzing…" : "Analyze a message"}
                <Arrow />
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setText(MESSAGE_EXAMPLES[0].text);
                  setError(null);
                }}
                disabled={busy}
              >
                Load example
              </button>
            </div>

            <ul className={styles.trust}>
              <li>LOCAL RULE ENGINE</li>
              <li>AI ANALYSIS</li>
              <li>LINKS NEVER OPENED</li>
            </ul>

            <p className={styles.more}>
              Have a screenshot? <Link href="/analyze" className={styles.moreLink}>Use the full analyzer</Link>
              <span className={styles.moreSpec}>
                {ACCEPTED_IMAGE_LABEL} &middot; up to {MAX_IMAGE_LABEL}
              </span>
            </p>
          </div>

          <div className={busy ? `${styles.instrument} ${styles.instrumentBusy}` : styles.instrument}>
            <header className={styles.top}>
              <div>
                <span className={styles.micro}>LIVE ANALYSIS</span>
                <strong className={styles.topTitle}>THREAT SCANNER</strong>
              </div>
              <span className={styles.status} aria-live="polite">
                <span
                  className={`${styles.statusDot} ${busy ? styles.statusRun : phase === "done" ? styles.statusDone : ""}`}
                  aria-hidden="true"
                />
                {status}
              </span>
            </header>

            <div className={styles.input}>
              <div className={styles.label}>
                <label htmlFor="scanner-input">01 / INPUT</label>
                <span className={text.length > MAX_TEXT ? styles.over : undefined}>
                  {text.length.toLocaleString()}/{MAX_TEXT.toLocaleString()}
                </span>
              </div>
              <textarea
                id="scanner-input"
                ref={inputRef}
                className={styles.textarea}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                  // Plain Enter sends on keyboards; on touch screens Enter stays a new line.
                  const send = e.metaKey || e.ctrlKey || window.matchMedia("(pointer: fine)").matches;
                  if (!send) return;
                  e.preventDefault();
                  void analyze();
                }}
                readOnly={busy}
                maxLength={MAX_TEXT + 500}
                placeholder="Paste a suspicious message, link, or email…"
                aria-describedby="scanner-hint"
              />
              <div className={styles.inputFoot}>
                <span id="scanner-hint" className={styles.hint}>
                  <span className={styles.hintKeys}>SHIFT + ENTER FOR NEW LINE</span>
                </span>
                <div className={styles.inputActions}>
                  <button type="button" className={styles.clear} onClick={() => setText("")} disabled={!text || busy}>
                    CLEAR
                  </button>
                  <button
                    type="button"
                    className={styles.send}
                    onClick={() => void analyze()}
                    disabled={!canSubmit}
                    aria-label="Analyze this message"
                  >
                    {busy ? "ANALYZING…" : "ANALYZE"}
                    <span className={styles.sendKey} aria-hidden="true">&#8629;</span>
                  </button>
                </div>
              </div>
            </div>

            <ol className={styles.pipeline} aria-label="Analysis stages">
              {STAGES.map((label, index) => {
                const active = busy && stage === index;
                const done = phase === "done" || (busy && index < stage);
                return (
                  <li
                    key={label}
                    className={`${styles.row} ${active ? styles.rowActive : ""} ${done ? styles.rowDone : ""}`}
                  >
                    <span aria-hidden="true">{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
                    <span>{label}</span>
                    <em>{active ? (slow ? "STILL RUNNING" : "RUNNING") : done ? "COMPLETE" : "WAITING"}</em>
                  </li>
                );
              })}
            </ol>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            {report ? (
              <div ref={reportRef} tabIndex={-1} className={styles.report} aria-label="Threat report">
                <header className={styles.reportHead}>
                  <div>
                    <span className={styles.micro}>02 / THREAT REPORT</span>
                    <strong className={styles.topTitle}>ANALYSIS COMPLETE</strong>
                  </div>
                  <code className={styles.code}>
                    {report.analysisMode === "HYBRID" ? "RULES + AI" : "RULES ONLY"}
                  </code>
                </header>

                <div className={styles.risk}>
                  <div>
                    <span className={styles.micro}>THREAT LEVEL</span>
                    <strong className={styles.level} style={{ color: severityColor }}>
                      {report.severity}
                    </strong>
                  </div>
                  <div className={styles.scoreWrap}>
                    <strong className={styles.score}>
                      <NumberTicker value={report.riskScore} />
                    </strong>
                    <span>/ 100</span>
                  </div>
                </div>
                <div className={styles.meter} aria-hidden="true">
                  <span style={{ width: `${report.riskScore}%`, background: severityColor }} />
                </div>

                <dl className={styles.facts}>
                  <div>
                    <dt className={styles.micro}>CLASSIFICATION</dt>
                    <dd>{CLASSIFICATION_LABEL[report.classification] ?? report.classification}</dd>
                  </div>
                  <div>
                    <dt className={styles.micro}>CONFIDENCE</dt>
                    <dd>{Math.round(report.confidence * 100)}%</dd>
                  </div>
                </dl>

                {report.analysisMode === "RULE_BASED_FALLBACK" && report.aiUnavailableReason && (
                  <p className={styles.note}>{report.aiUnavailableReason}</p>
                )}

                <p className={styles.summary}>{report.summary}</p>

                {report.signals.length > 0 && (
                  <div className={styles.block}>
                    <span className={styles.micro}>DETECTED SIGNALS</span>
                    <ul className={styles.signals}>
                      {report.signals.slice(0, 4).map((s) => (
                        <li key={s.name}>{s.name}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.attackChain.length > 0 && (
                  <div className={styles.block}>
                    <span className={styles.micro}>ATTACK PATH</span>
                    <ol className={styles.chain}>
                      {report.attackChain.map((step) => (
                        <li key={`${step.step}-${step.title}`}>{step.title}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {actions.length > 0 && (
                  <div className={styles.block}>
                    <span className={styles.micro}>RECOMMENDED ACTIONS</span>
                    <ol className={styles.steps}>
                      {actions.slice(0, 4).map((a) => (
                        <li key={a.text}>{a.text}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className={styles.reportActions}>
                  <button type="button" className={styles.primary} onClick={openFullReport}>
                    Save &amp; open full report
                    <Arrow />
                  </button>
                  <button type="button" className={styles.secondary} onClick={reset}>
                    Analyze another
                  </button>
                </div>
                {saveFailed && (
                  <p className={styles.error} role="alert">
                    This report could not be saved. Your browser may be blocking storage.
                  </p>
                )}
              </div>
            ) : (
              <div className={styles.empty}>
                <span className={styles.emptyMark} aria-hidden="true">SS</span>
                <div>
                  <b>{busy ? "ANALYSIS IN PROGRESS" : "NO THREAT REPORT YET"}</b>
                  <span>
                    {!busy
                      ? "Submit an input to begin analysis."
                      : slow
                        ? "AI analysis is taking longer than usual. Pattern checks are done — hang on a few more seconds."
                        : "Reading the message the way a scammer wrote it."}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <a href={`#${exploreId}`} className={styles.explore}>
          <span className={styles.exploreLine} aria-hidden="true" />
          EXPLORE SCAMSHIELD
          <span aria-hidden="true">&darr;</span>
        </a>
      </div>
    </section>
  );
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 12 12 4M5 4h7v7" />
    </svg>
  );
}

export default ThreatScanner;
