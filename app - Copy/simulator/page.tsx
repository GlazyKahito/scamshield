"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { SCENARIOS } from "../../lib/content/scenarios";
import { saveSimulatorAnswer } from "../../lib/storage/history";
import { SiteNav } from "../../components/ui/site-nav";
import styles from "../../components/ui/pages.module.css";

/**
 * /simulator — an interactive educational experience.
 *
 * All scenarios are fictional and labelled as such in the UI. The explanation
 * after each answer is the point: being told you were wrong teaches nothing
 * without the mechanic behind it.
 */
export default function SimulatorPage() {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const scenario = SCENARIOS[index];
  const answered = choice !== null;
  const isCorrect = answered && choice === scenario.correctOptionId;

  const answer = useCallback(
    (optionId: string) => {
      if (choice !== null) return;
      setChoice(optionId);
      const correct = optionId === scenario.correctOptionId;
      if (correct) setCorrectCount((c) => c + 1);
      saveSimulatorAnswer({
        scenarioId: scenario.id,
        correct,
        at: new Date().toISOString(),
      });
    },
    [choice, scenario],
  );

  const next = useCallback(() => {
    if (index + 1 >= SCENARIOS.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setChoice(null);
  }, [index]);

  const restart = useCallback(() => {
    setIndex(0);
    setChoice(null);
    setCorrectCount(0);
    setFinished(false);
  }, []);

  const scorePct = useMemo(
    () => Math.round((correctCount / SCENARIOS.length) * 100),
    [correctCount],
  );

  return (
    <div className={styles.page}>
      <SiteNav />

      <header className={styles.head}>
        <div className={styles.shellNarrow}>
          <p className={styles.eyebrow}>SCAM RADAR</p>
          <h1 className={styles.title}>Would you have spotted it?</h1>
          <p className={styles.lead}>
            Five realistic scenarios. Every message here is invented for training &mdash; no real
            links, numbers or accounts appear anywhere in this simulator.
          </p>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.shellNarrow}>
          {finished ? (
            <div className={styles.card} style={{ padding: 34, textAlign: "center" }}>
              <p className={styles.eyebrow}>YOUR RESULT</p>
              <p className={styles.statBig} style={{ fontSize: 54, color: "#22d3ee" }}>{scorePct}%</p>
              <p className={styles.emptyText} style={{ marginTop: 16 }}>
                You identified {correctCount} of {SCENARIOS.length} correctly. The pattern worth
                carrying out of this: every one of these scams needed you to act before checking.
                Slowing down defeats all five.
              </p>
              <div className={styles.actions} style={{ justifyContent: "center" }}>
                <button type="button" className={styles.btnPrimary} onClick={restart}>
                  Try again
                </button>
                <Link href="/scams" className={styles.btnGhost}>Read the scam library</Link>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.progressRow}>
                <span className={styles.progressText}>
                  Scenario {index + 1} of {SCENARIOS.length} &middot; {scenario.category}
                </span>
                <span className={styles.scorePill}>
                  {correctCount} correct so far
                </span>
              </div>

              <div className={styles.simMsg}>
                <div className={styles.simMsgHead}>
                  <span>
                    <span className={styles.simSender}>{scenario.sender}</span>
                    <span className={styles.simChannel}> &middot; {scenario.channel}</span>
                  </span>
                  <span className={styles.simDemoTag}>FICTIONAL EXAMPLE</span>
                </div>
                <p className={styles.simText}>{scenario.message}</p>
              </div>

              <h2 className={styles.sectionH} style={{ marginTop: 30, marginBottom: 0 }}>
                {scenario.question}
              </h2>

              <div className={styles.optionList} role="group" aria-label={scenario.question}>
                {scenario.options.map((option) => {
                  const chosen = choice === option.id;
                  const right = option.id === scenario.correctOptionId;

                  let cls = styles.option;
                  if (answered && right) cls = `${styles.option} ${styles.optionRight}`;
                  else if (answered && chosen) cls = `${styles.option} ${styles.optionWrong}`;
                  else if (answered) cls = `${styles.option} ${styles.optionDim}`;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cls}
                      onClick={() => answer(option.id)}
                      disabled={answered}
                    >
                      {option.text}
                    </button>
                  );
                })}
              </div>

              {answered && (
                <div className={styles.feedback} aria-live="polite">
                  <p
                    className={styles.feedbackVerdict}
                    style={{ color: isCorrect ? "#34d399" : "#f59e0b" }}
                  >
                    {isCorrect ? "That's the safe choice." : "That one would have cost you."}
                  </p>

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

                  <div className={styles.actions}>
                    <button type="button" className={styles.btnPrimary} onClick={next}>
                      {index + 1 >= SCENARIOS.length ? "See your result" : "Next scenario"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
