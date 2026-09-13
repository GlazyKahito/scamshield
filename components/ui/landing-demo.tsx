"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { MESSAGE_EXAMPLES } from "../../lib/content/examples";
import { analyzeMessage } from "../../lib/security/message-analyzer";
import { analyzeUrl } from "../../lib/security/url-analyzer";
import { scoreSignals, severityFromScore } from "../../lib/security/risk-engine";
import { setAnalyzerDraft } from "../../lib/storage/draft";
import type { SecuritySignal } from "../../types/analysis";
import { SEVERITY_COLOR, SEVERITY_LABEL, tint } from "../report/severity";
import styles from "./scamshield.module.css";

/**
 * Interactive landing demo.
 *
 * This runs ScamShield's real deterministic engine — the same pattern and URL
 * checks the server runs first on every request — directly in the browser.
 * Nothing is mocked and nothing is sent anywhere while you type. The AI layer
 * is not involved here; "Run full analysis" hands the text to /analyze, which
 * calls the existing API route.
 */

const SEVERITY_TONE: Record<SecuritySignal["severity"], string> = {
  HIGH: "#ef4444",
  MEDIUM: "#fbbf24",
  LOW: "rgba(255,255,255,0.52)",
};

export function LandingDemo() {
  const router = useRouter();
  const [specimen, setSpecimen] = useState(MESSAGE_EXAMPLES[0].id);
  const [text, setText] = useState(MESSAGE_EXAMPLES[0].text);
  const deferred = useDeferredValue(text);

  const result = useMemo(() => {
    const input = deferred.slice(0, 8000);
    if (input.trim().length < 3) return null;
    const message = analyzeMessage(input);
    const urlSignals = message.extractedUrls.map(analyzeUrl).flatMap((u) => u.signals);
    const signals = [...message.signals, ...urlSignals];

    // One row per distinct finding; the score itself already dedupes by group.
    const seen = new Set<string>();
    const unique = signals
      .sort((a, b) => b.weight - a.weight)
      .filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)));

    const score = scoreSignals(signals);
    return { score, severity: severityFromScore(score), signals: unique.slice(0, 5), total: unique.length };
  }, [deferred]);

  const color = result ? SEVERITY_COLOR[result.severity] : "rgba(255,255,255,0.3)";

  const runFull = () => {
    setAnalyzerDraft({ mode: "MESSAGE", value: text });
    router.push("/analyze");
  };

  return (
    <div className={styles.demo}>
      <div className={styles.demoPanel}>
        <div className={styles.demoBar}>
          <span>INPUT &middot; EDITABLE</span>
          <span>FICTIONAL SPECIMENS</span>
        </div>

        <div className={styles.demoSpecimens} role="group" aria-label="Load an example">
          {MESSAGE_EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              aria-pressed={specimen === example.id}
              className={
                specimen === example.id ? `${styles.demoSpecimen} ${styles.demoSpecimenOn}` : styles.demoSpecimen
              }
              onClick={() => {
                setSpecimen(example.id);
                setText(example.text);
              }}
            >
              {example.label}
            </button>
          ))}
        </div>

        <label htmlFor="demo-input" className="sr-only">
          Message to check
        </label>
        <textarea
          id="demo-input"
          className={styles.demoInput}
          value={text}
          maxLength={8000}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setSpecimen("");
          }}
          placeholder="Type or paste any message…"
        />

        <div className={styles.demoFoot}>
          <span>Runs locally &middot; nothing sent</span>
          <span>{text.length.toLocaleString()} chars</span>
        </div>
      </div>

      <div className={styles.demoPanel} aria-live="polite">
        <div className={styles.demoBar}>
          <span>PATTERN ENGINE &middot; LIVE</span>
          <span>{result ? `${result.total} SIGNAL${result.total === 1 ? "" : "S"}` : "WAITING"}</span>
        </div>

        <div className={styles.demoResult}>
          <div className={styles.demoScoreRow}>
            <span>
              <span className={styles.demoScore} style={{ color }}>
                {result ? result.score : "—"}
              </span>
              <span className={styles.demoScoreOut}>/ 100</span>
            </span>
            {result && (
              <span
                className={styles.demoLevel}
                style={{ color, borderColor: tint(SEVERITY_COLOR[result.severity], 0.4), background: tint(SEVERITY_COLOR[result.severity], 0.1) }}
              >
                {SEVERITY_LABEL[result.severity].toUpperCase()}
              </span>
            )}
          </div>

          <div className={styles.demoMeter} aria-hidden="true">
            <div className={styles.demoMeterFill} style={{ width: `${result?.score ?? 0}%`, background: color }} />
          </div>

          <ul className={styles.demoSignals}>
            {!result && <li className={styles.demoEmpty}>Start typing and the pattern checks run as you go.</li>}
            {result && result.signals.length === 0 && (
              <li className={styles.demoEmpty}>
                No known scam patterns matched. That is not proof a message is genuine &mdash; the
                full analysis also reads intent.
              </li>
            )}
            {result?.signals.map((signal) => (
              <li key={signal.name} className={styles.demoSignal}>
                <span>{signal.name}</span>
                <span className={styles.demoSignalSev} style={{ color: SEVERITY_TONE[signal.severity] }}>
                  {signal.severity}
                </span>
              </li>
            ))}
          </ul>

          <p className={styles.demoNote}>
            This is the deterministic layer only. The full analysis adds AI reasoning, an attack
            path and specific next steps.
          </p>

          <div className={styles.demoActions}>
            <button
              type="button"
              className={styles.ctaPrimary}
              onClick={runFull}
              disabled={text.trim().length < 3}
              style={{ border: 0, cursor: "pointer", font: "inherit", fontWeight: 700 }}
            >
              Run full analysis
              <span className={styles.ctaArrow} aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingDemo;
