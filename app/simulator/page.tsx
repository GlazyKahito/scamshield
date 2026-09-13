"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SCENARIOS } from "../../lib/content/scenarios";
import { saveSimulatorAnswer } from "../../lib/storage/history";
import { SiteNav } from "../../components/ui/site-nav";
import { SiteFooter } from "../../components/ui/site-footer";
import styles from "../../components/ui/pages.module.css";

/**
 * /simulator — an interactive educational experience.
 *
 * All scenarios are fictional and labelled as such in the UI. The explanation
 * after each answer is the point: being told you were wrong teaches nothing
 * without the mechanic behind it.
 *
 * Keyboard: 1–4 choose an answer, Enter moves on once answered.
 */

type Answer = { scenarioId: string; optionId: string; correct: boolean };

export default function SimulatorPage() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [finished, setFinished] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS[index];
  const current = answers.find((a) => a.scenarioId === scenario.id);
  const choice = current?.optionId ?? null;
  const answered = choice !== null;
  const isCorrect = Boolean(current?.correct);
  const correctCount = answers.filter((a) => a.correct).length;
  const isLast = index + 1 >= SCENARIOS.length;

  const answer = useCallback(
    (optionId: string) => {
      if (answered) return;
      const correct = optionId === scenario.correctOptionId;
      setAnswers((list) => [...list, { scenarioId: scenario.id, optionId, correct }]);
      saveSimulatorAnswer({ scenarioId: scenario.id, correct, at: new Date().toISOString() });
      window.requestAnimationFrame(() => {
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
      });
    },
    [answered, scenario],
  );

  const next = useCallback(() => {
    if (isLast) {
      setFinished(true);
      window.requestAnimationFrame(() => resultRef.current?.focus());
      return;
    }
    setIndex((i) => i + 1);
    window.requestAnimationFrame(() => questionRef.current?.focus());
  }, [isLast]);

  const restart = useCallback(() => {
    setIndex(0);
    setAnswers([]);
    setFinished(false);
    // The "Try again" button unmounts; move focus to the first question.
    window.requestAnimationFrame(() => questionRef.current?.focus());
  }, []);

  useEffect(() => {
    if (finished) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const n = Number.parseInt(event.key, 10);
      if (!answered && n >= 1 && n <= scenario.options.length) {
        event.preventDefault();
        answer(scenario.options[n - 1].id);
      } else if (answered && event.key === "Enter" && target?.tagName !== "BUTTON" && target?.tagName !== "A") {
        event.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, answered, scenario, answer, next]);

  const scorePct = useMemo(() => Math.round((correctCount / SCENARIOS.length) * 100), [correctCount]);

  const resultCopy =
    scorePct >= 80
      ? { title: "Sharp instincts.", color: "var(--sev-low)" }
      : scorePct >= 50
        ? { title: "Good — with a few gaps.", color: "var(--sev-moderate)" }
        : { title: "These are built to fool people.", color: "var(--signal)" };

  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shell} data-reveal-stagger>
          <p className={styles.eyebrow}>SCAM SIMULATOR</p>
          <h1 className={styles.title}>Would you have spotted it?</h1>
          <p className={styles.lead}>
            {SCENARIOS.length} realistic scenarios. Every message here is invented for training
            &mdash; no real links, numbers or accounts appear anywhere in this simulator.
          </p>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shell}>
          {finished ? (
            <div
              ref={resultRef}
              tabIndex={-1}
              className={styles.result}
              style={{ maxWidth: 720, margin: "0 auto", outline: "none" }}
            >
              <p className={styles.eyebrow} style={{ marginBottom: 0 }}>YOUR RESULT</p>
              <p className={styles.resultScore} style={{ color: resultCopy.color }}>{scorePct}%</p>
              <p className={styles.resultTitle}>{resultCopy.title}</p>
              <p className={styles.resultText}>
                You identified {correctCount} of {SCENARIOS.length} correctly. The pattern worth
                carrying out of this: every one of these scams needed you to act before checking.
                Slowing down defeats all of them.
              </p>

              <ul className={styles.review}>
                {SCENARIOS.map((s, i) => {
                  const a = answers.find((x) => x.scenarioId === s.id);
                  const ok = Boolean(a?.correct);
                  return (
                    <li key={s.id} className={styles.reviewItem}>
                      <span
                        className={styles.reviewMark}
                        style={{
                          color: ok ? "var(--sev-low)" : "var(--signal)",
                          borderColor: ok ? "var(--sev-low)" : "var(--signal)",
                        }}
                        aria-hidden="true"
                      >
                        {ok ? "✓" : "✕"}
                      </span>
                      <span>
                        <span className="sr-only">{ok ? "Correct: " : "Missed: "}</span>
                        Scenario {i + 1} &middot; {s.sender}
                      </span>
                      <span className={styles.reviewCat}>{s.category}</span>
                    </li>
                  );
                })}
              </ul>

              <div className={styles.actions} style={{ justifyContent: "center", marginTop: 28 }}>
                <button type="button" className={styles.btnPrimary} onClick={restart}>
                  Try again
                </button>
                <Link href="/scams" className={styles.btnGhost}>Read the scam library</Link>
                <Link href="/dashboard" className={styles.btnGhost}>See your dashboard</Link>
              </div>
            </div>
          ) : (
            <div className={styles.simLayout}>
              {/* Phone */}
              <div>
                <div className={styles.device} aria-label={`Fictional ${scenario.channel} message`} role="figure">
                  <div className={styles.deviceScreen}>
                    <div className={styles.deviceStatus} aria-hidden="true">
                      <span>9:41</span>
                      <span>{scenario.channel.toUpperCase()}</span>
                    </div>
                    <div className={styles.deviceHeader}>
                      <span className={styles.avatar} aria-hidden="true">
                        {scenario.sender.replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase() || "?"}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className={styles.simSender}>{scenario.sender}</span>
                        <span className={styles.simChannel}>{scenario.channel}</span>
                      </span>
                      <span className={styles.simDemoTag}>FICTIONAL</span>
                    </div>
                    <div className={styles.deviceThread}>
                      <p key={scenario.id} className={styles.bubble}>{scenario.message}</p>
                      <span className={styles.bubbleTime} aria-hidden="true">Today &middot; just now</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Question */}
              <div>
                <div className={styles.progressRow}>
                  <span className={styles.progressText}>
                    SCENARIO {index + 1} / {SCENARIOS.length} &middot; {scenario.category.toUpperCase()}
                  </span>
                  <span className={styles.scorePill}>{correctCount} correct</span>
                </div>

                <div
                  className={styles.segments}
                  role="progressbar"
                  aria-valuemin={1}
                  aria-valuemax={SCENARIOS.length}
                  aria-valuenow={index + 1}
                  aria-label="Simulator progress"
                >
                  {SCENARIOS.map((s, i) => {
                    const a = answers.find((x) => x.scenarioId === s.id);
                    const cls = a
                      ? a.correct
                        ? styles.segmentRight
                        : styles.segmentWrong
                      : i === index
                        ? styles.segmentCurrent
                        : "";
                    return <span key={s.id} className={`${styles.segment} ${cls}`} />;
                  })}
                </div>

                <h2 ref={questionRef} tabIndex={-1} className={styles.question} style={{ outline: "none" }}>
                  {scenario.question}
                </h2>

                <div className={styles.optionList} role="group" aria-label={scenario.question}>
                  {scenario.options.map((option, i) => {
                    const chosen = choice === option.id;
                    const right = option.id === scenario.correctOptionId;

                    let cls = styles.option;
                    let tag = "";
                    if (answered && right) {
                      cls = `${styles.option} ${styles.optionRight}`;
                      tag = "SAFE";
                    } else if (answered && chosen) {
                      cls = `${styles.option} ${styles.optionWrong}`;
                      tag = "RISKY";
                    } else if (answered) {
                      cls = `${styles.option} ${styles.optionDim}`;
                    }

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={cls}
                        onClick={() => answer(option.id)}
                        disabled={answered}
                        aria-keyshortcuts={String(i + 1)}
                      >
                        <span className={styles.optionKey} aria-hidden="true">{i + 1}</span>
                        <span>{option.text}</span>
                        {tag && (
                          <span
                            className={styles.optionResult}
                            style={{ color: tag === "SAFE" ? "var(--sev-low)" : "var(--signal)" }}
                          >
                            {chosen ? `YOUR PICK · ${tag}` : tag}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {!answered && (
                  <p className={styles.progressText} style={{ marginTop: 14, letterSpacing: 0 }}>
                    Tip: press <kbd className={styles.kbd}>1</kbd>&ndash;<kbd className={styles.kbd}>{scenario.options.length}</kbd> to answer.
                  </p>
                )}

                {answered && (
                  <div ref={feedbackRef} className={styles.feedback} aria-live="polite" style={{ scrollMarginBottom: 24 }}>
                    <p
                      className={styles.feedbackVerdict}
                      style={{ color: isCorrect ? "var(--sev-low)" : "var(--signal)" }}
                    >
                      {isCorrect ? "That’s the safe choice." : "That one would have cost you."}
                    </p>

                    <div className={styles.feedbackGrid}>
                      <div className={styles.feedbackBlock}>
                        <p className={styles.feedbackLabel}>THE TECHNIQUE</p>
                        <p className={styles.feedbackText}>{scenario.technique}</p>
                      </div>
                      <div className={styles.feedbackBlock}>
                        <p className={styles.feedbackLabel}>WHAT WOULD HAVE HAPPENED</p>
                        <p className={styles.feedbackText}>{scenario.outcome}</p>
                      </div>
                      <div className={styles.feedbackBlock}>
                        <p className={styles.feedbackLabel}>THE WARNING SIGNS</p>
                        <p className={styles.feedbackText}>{scenario.redFlags}</p>
                      </div>
                      <div className={styles.feedbackBlock}>
                        <p className={styles.feedbackLabel}>THE SAFE ACTION</p>
                        <p className={styles.feedbackText}>{scenario.correctAction}</p>
                      </div>
                    </div>

                    <div className={styles.feedbackActions}>
                      <span className={styles.progressText} style={{ letterSpacing: 0 }}>
                        Press <kbd className={styles.kbd}>Enter</kbd> to continue
                      </span>
                      <button type="button" className={styles.btnPrimary} onClick={next}>
                        {isLast ? "See your result" : "Next scenario"} &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
