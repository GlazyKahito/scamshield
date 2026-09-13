"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Check, Copy, RotateCcw, Share2 } from "lucide-react";
import type {
  AttackStep,
  RecommendedAction,
  SecuritySignal,
  Severity,
  ThreatReport,
  UrlAnalysis,
} from "../../types/analysis";
import {
  CLASSIFICATION_LABEL,
  INPUT_TYPE_LABEL,
  SEVERITY_COLOR,
  SEVERITY_HEADLINE,
  SEVERITY_LABEL,
  tint,
  toSeverity,
} from "./severity";
import styles from "../ui/pages.module.css";

/**
 * Threat report renderer, shared by /analyze, /report and /report/[id].
 *
 * Every value here comes from the analysis payload. No score, signal, chain
 * step or recommendation is hard-coded — pass a different report and everything
 * changes. All text is rendered as text, never dangerouslySetInnerHTML, so a
 * message crafted to inject markup cannot escape into the page.
 */

const BANDS = [
  { label: "Low", span: 25, key: "LOW" },
  { label: "Moderate", span: 25, key: "MODERATE" },
  { label: "High", span: 25, key: "HIGH" },
  { label: "Critical", span: 26, key: "CRITICAL" },
] as const;

const SIGNAL_COLOR: Record<SecuritySignal["severity"], string> = {
  HIGH: "#ef4444",
  MEDIUM: "#fbbf24",
  LOW: "#9aa4b2",
};

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.5) return "Moderate";
  return "Low";
}

/** Counts up to the score once. Jumps straight there under reduced motion. */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

/** Plain-text version of the report for Copy and Share. */
function reportToText(report: ThreatReport, severity: Severity): string {
  const lines = [
    `ScamShield report — ${SEVERITY_LABEL[severity]} (${report.riskScore}/100)`,
    CLASSIFICATION_LABEL[report.classification] ?? report.classification,
    "",
    report.summary,
  ];
  if (report.signals.length > 0) {
    lines.push("", "Why it was flagged:");
    for (const s of report.signals) lines.push(`• ${s.name}`);
  }
  const donts = report.recommendedActions.filter((a) => a.type === "DONT");
  const dos = report.recommendedActions.filter((a) => a.type === "DO");
  if (donts.length > 0) {
    lines.push("", "Don't:");
    for (const a of donts) lines.push(`✕ ${a.text}`);
  }
  if (dos.length > 0) {
    lines.push("", "Do:");
    for (const a of dos) lines.push(`✓ ${a.text}`);
  }
  lines.push("", "ScamShield reports risk, not certainty. Verify through a channel you found yourself.");
  return lines.join("\n");
}

function RiskScale({ score, severity }: { score: number; severity: Severity }) {
  const color = SEVERITY_COLOR[severity];
  const shown = useCountUp(score);

  return (
    <div className={styles.scorePanel}>
      <span className={styles.scoreLabel}>RISK SCORE</span>
      <div className={styles.scoreRowTop}>
        <span aria-hidden="true">
          <span className={styles.scoreBig} style={{ color }}>{shown}</span>
          <span className={styles.scoreOut}>/ 100</span>
        </span>
        <span className="sr-only">
          Risk score {score} out of 100.
        </span>
      </div>

      {/*
        A banded scale instead of a dial: seeing where the score falls teaches
        the thresholds, which matters more than watching a gauge fill.
      */}
      <div className={styles.bands} aria-hidden="true">
        <div className={styles.bandTrack}>
          <div className={styles.bandBar}>
            {BANDS.map((band) => (
              <div
                key={band.key}
                className={styles.bandSeg}
                style={{
                  flexGrow: band.span,
                  background: SEVERITY_COLOR[band.key],
                  opacity: band.key === severity ? 1 : 0.2,
                }}
              />
            ))}
          </div>
          <span className={styles.bandMarker} style={{ left: `${Math.min(99.5, shown)}%` }} />
        </div>
        <div className={styles.bandLabels}>
          {BANDS.map((band) => (
            <span key={band.key}>{band.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SourceTag({ source }: { source: SecuritySignal["source"] }) {
  if (source === "COMBINED") {
    return (
      <span className={`${styles.signalTag} ${styles.signalTagBoth}`}>
        <span className={`${styles.tagDot} ${styles.tagBoth}`} aria-hidden="true" />
        Rules + AI agree
      </span>
    );
  }
  if (source === "AI") {
    return (
      <span className={styles.signalTag}>
        <span className={`${styles.tagDot} ${styles.tagAi}`} aria-hidden="true" />
        AI reading
      </span>
    );
  }
  return (
    <span className={styles.signalTag}>
      <span className={`${styles.tagDot} ${styles.tagRule}`} aria-hidden="true" />
      Pattern rule
    </span>
  );
}

function SignalCard({ signal }: { signal: SecuritySignal }) {
  const toneClass =
    signal.severity === "HIGH" ? styles.signalHigh : signal.severity === "MEDIUM" ? styles.signalMed : styles.signalLow;

  return (
    <li className={`${styles.signal} ${toneClass}`}>
      <div className={styles.signalTop}>
        <div className={styles.signalTitleRow}>
          <h3 className={styles.signalName}>{signal.name}</h3>
          <span className={styles.sevText} style={{ color: SIGNAL_COLOR[signal.severity] }}>
            {signal.severity}
          </span>
        </div>
        <SourceTag source={signal.source} />
      </div>
      {signal.evidence && (
        <p className={styles.evidence}>
          <span className={styles.evidenceLabel}>EVIDENCE</span>
          {signal.evidence}
        </p>
      )}
      <p className={styles.signalWhy}>{signal.explanation}</p>
    </li>
  );
}

function AttackTimeline({ steps }: { steps: AttackStep[] }) {
  return (
    <ol className={styles.timeline}>
      {steps.map((step, i) => (
        <li
          key={`${step.step}-${i}`}
          className={i === steps.length - 1 ? `${styles.timelineItem} ${styles.timelineEnd}` : styles.timelineItem}
        >
          <span className={styles.timelineNum} aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className={styles.timelineCard}>
            <h3 className={styles.timelineTitle}>{step.title}</h3>
            <p className={styles.timelineText}>{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Recommendations({ actions }: { actions: RecommendedAction[] }) {
  const donts = actions.filter((a) => a.type === "DONT");
  const dos = actions.filter((a) => a.type === "DO");

  return (
    <div className={styles.recGrid}>
      {dos.length > 0 && (
        <div className={`${styles.recBox} ${styles.recDo}`}>
          <h3 className={styles.recTitle} style={{ color: "#34d399" }}>DO THIS</h3>
          <ul className={styles.recList}>
            {dos.map((action, i) => (
              <li key={i} className={styles.recItem}>
                <span className={styles.recMark} style={{ color: "#34d399", background: tint("#34d399", 0.14) }} aria-hidden="true">
                  ✓
                </span>
                {action.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {donts.length > 0 && (
        <div className={`${styles.recBox} ${styles.recDont}`}>
          <h3 className={styles.recTitle} style={{ color: "#f87171" }}>DON&rsquo;T</h3>
          <ul className={styles.recList}>
            {donts.map((action, i) => (
              <li key={i} className={styles.recItem}>
                <span className={styles.recMark} style={{ color: "#f87171", background: tint("#ef4444", 0.14) }} aria-hidden="true">
                  ✕
                </span>
                {action.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UrlBreakdown({ analyses }: { analyses: UrlAnalysis[] }) {
  return (
    <>
      {analyses.map((analysis, i) => (
        <div key={i} className={styles.urlCard}>
          <p className={styles.urlHead}>{analysis.facts.url}</p>
          <dl className={styles.urlFacts}>
            <div>
              <dt className={styles.statLabel}>Domain</dt>
              <dd className={styles.statValue} style={{ wordBreak: "break-all" }}>
                {analysis.facts.hostname || "—"}
              </dd>
            </div>
            <div>
              <dt className={styles.statLabel}>Encrypted</dt>
              <dd className={styles.statValue} style={{ color: analysis.facts.hasHttps ? "#34d399" : "#f59e0b" }}>
                {analysis.facts.hasHttps ? "Yes · HTTPS" : "No · HTTP"}
              </dd>
            </div>
            <div>
              <dt className={styles.statLabel}>Subdomains</dt>
              <dd className={styles.statValue}>{analysis.facts.subdomainCount}</dd>
            </div>
            <div>
              <dt className={styles.statLabel}>Structure score</dt>
              <dd className={styles.statValue}>{analysis.score}/100</dd>
            </div>
          </dl>
        </div>
      ))}
    </>
  );
}

export function ReportView({
  report,
  onSave,
  saved,
  onAnalyzeAnother,
}: {
  report: ThreatReport;
  onSave?: () => void;
  saved?: boolean;
  /** When omitted, "Analyze another" links to /analyze. */
  onAnalyzeAnother?: () => void;
}) {
  const severity = toSeverity(report.severity);
  const color = SEVERITY_COLOR[severity];
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const flash = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2400);
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportToText(report, severity));
      flash("Copied to clipboard");
    } catch {
      flash("Copy was blocked by the browser");
    }
  }, [report, severity, flash]);

  const share = useCallback(async () => {
    const text = reportToText(report, severity);
    // Share the findings as text. Reports live only in this browser, so a link
    // would open an empty page for anyone else.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "ScamShield report", text });
      } catch {
        // User dismissed the share sheet; nothing to report.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      flash("Sharing isn't supported here — copied instead");
    } catch {
      flash("Sharing isn't supported in this browser");
    }
  }, [report, severity, flash]);

  const created = new Date(report.createdAt);
  const createdLabel = Number.isNaN(created.getTime())
    ? null
    : created.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  const topFlags = report.signals.slice(0, 6);
  let n = 0;
  const idx = () => String(++n).padStart(2, "0");

  return (
    <article className={styles.report} aria-label="Threat report">
      <div className={styles.verdict} style={{ ["--sev" as string]: color }}>
        <div className={styles.verdictGrid}>
          <div>
            <div className={styles.levelRow}>
              <span
                className={styles.levelPill}
                style={{ color, borderColor: tint(color, 0.45), background: tint(color, 0.1) }}
              >
                <span className={styles.levelDot} aria-hidden="true" />
                {SEVERITY_LABEL[severity].toUpperCase()}
              </span>
              <p className={styles.classification}>
                {CLASSIFICATION_LABEL[report.classification] ?? report.classification}
              </p>
            </div>

            <h2 className={styles.verdictTitle}>{SEVERITY_HEADLINE[severity]}</h2>

            <p className={styles.subLabel}>EXPLANATION</p>
            <p className={styles.summary}>{report.summary}</p>

            {topFlags.length > 0 && (
              <>
                <p className={styles.subLabel}>WHY WE FLAGGED THIS</p>
                <ul className={styles.flagList}>
                  {topFlags.map((signal, i) => (
                    <li key={`${signal.name}-${i}`} className={styles.flag}>
                      <span className={styles.flagDot} style={{ background: SIGNAL_COLOR[signal.severity] }} aria-hidden="true" />
                      {signal.name}
                    </li>
                  ))}
                  {report.signals.length > topFlags.length && (
                    <li className={styles.flag} style={{ color: "var(--text-3)" }}>
                      +{report.signals.length - topFlags.length} more
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>

          <div>
            <RiskScale score={report.riskScore} severity={severity} />

            <dl className={styles.statGrid}>
              <div>
                <dt className={styles.statLabel}>Pattern checks</dt>
                <dd className={styles.statValue}>{report.ruleScore}/100</dd>
              </div>
              <div>
                <dt className={styles.statLabel}>AI reading</dt>
                <dd className={styles.statValue}>{report.aiScore === null ? "Unavailable" : `${report.aiScore}/100`}</dd>
              </div>
              <div>
                <dt className={styles.statLabel}>Confidence</dt>
                <dd className={styles.statValue}>{confidenceLabel(report.confidence)}</dd>
              </div>
            </dl>

            <p className={styles.classification} style={{ marginTop: 14, textTransform: "none", letterSpacing: "0.02em" }}>
              {INPUT_TYPE_LABEL[report.inputType] ?? report.inputType}
              {createdLabel ? ` · ${createdLabel}` : ""}
              {report.analysisMode === "HYBRID" ? " · Rules + AI" : " · Rules only"}
            </p>
          </div>
        </div>

        {/* Shown whenever the AI layer was skipped, so the number is never misread. */}
        {report.analysisMode === "RULE_BASED_FALLBACK" && report.aiUnavailableReason && (
          <p className={`${styles.notice} ${styles.noticeWarn}`}>
            <span className={styles.noticeIcon} aria-hidden="true">!</span>
            <span>{report.aiUnavailableReason}</span>
          </p>
        )}

        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            {onSave && (
              <button type="button" className={styles.btnGhost} onClick={onSave} disabled={saved}>
                {saved ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
                {saved ? "Saved" : "Save"}
              </button>
            )}
            <button type="button" className={styles.btnGhost} onClick={copy}>
              {notice === "Copied to clipboard" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              Copy
            </button>
            <button type="button" className={styles.btnGhost} onClick={share}>
              <Share2 size={16} aria-hidden="true" />
              Share
            </button>
          </div>

          <span className={styles.toast} role="status" aria-live="polite">
            {notice ?? (saved ? "Saved to your dashboard" : "")}
          </span>

          {onAnalyzeAnother ? (
            <button type="button" className={styles.btnPrimary} onClick={onAnalyzeAnother}>
              <RotateCcw size={16} aria-hidden="true" />
              Analyze another
            </button>
          ) : (
            <Link href="/analyze" className={styles.btnPrimary}>
              <RotateCcw size={16} aria-hidden="true" />
              Analyze another
            </Link>
          )}
        </div>
      </div>

      <section className={styles.section2} aria-labelledby="signals-heading">
        <div className={styles.sectionHeadRow}>
          <div>
            <span className={styles.sectionIdx}>{idx()} &middot; EVIDENCE</span>
            <h2 id="signals-heading" className={styles.sectionH}>Why ScamShield flagged this</h2>
          </div>
          {report.signals.length > 0 && (
            <div className={styles.legend} aria-label="Signal sources">
              <span className={styles.legendItem}>
                <span className={`${styles.tagDot} ${styles.tagRule}`} aria-hidden="true" /> Pattern rule
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.tagDot} ${styles.tagAi}`} aria-hidden="true" /> AI reading
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.tagDot} ${styles.tagBoth}`} aria-hidden="true" /> Both agree
              </span>
            </div>
          )}
        </div>

        {report.signals.length === 0 ? (
          <p className={`${styles.notice} ${styles.noticeInfo}`}>
            <span className={styles.noticeIcon} aria-hidden="true">i</span>
            <span>
              No known scam patterns matched this content. That means nothing on our list showed up
              &mdash; it does not confirm who sent the message.
            </span>
          </p>
        ) : (
          <ul className={styles.signalList} style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {report.signals.map((signal, i) => (
              <SignalCard key={`${signal.name}-${i}`} signal={signal} />
            ))}
          </ul>
        )}
      </section>

      {report.recommendedActions.length > 0 && (
        <section className={styles.section2} aria-labelledby="actions-heading">
          <div className={styles.sectionHeadRow}>
            <div>
              <span className={styles.sectionIdx}>{idx()} &middot; RECOMMENDED ACTION</span>
              <h2 id="actions-heading" className={styles.sectionH}>What should I do?</h2>
            </div>
          </div>
          <Recommendations actions={report.recommendedActions} />
        </section>
      )}

      {report.attackChain.length > 0 && (
        <section className={styles.section2} aria-labelledby="chain-heading">
          <div className={styles.sectionHeadRow}>
            <div>
              <span className={styles.sectionIdx}>{idx()} &middot; ATTACK PATH</span>
              <h2 id="chain-heading" className={styles.sectionH}>How this scam would work</h2>
              <p className={styles.sectionSub}>
                One way this could play out if someone acted on it. It describes a possible path,
                not something that has happened.
              </p>
            </div>
          </div>
          <AttackTimeline steps={report.attackChain} />
        </section>
      )}

      {report.urlAnalyses.length > 0 && (
        <section className={styles.section2} aria-labelledby="links-heading">
          <div className={styles.sectionHeadRow}>
            <div>
              <span className={styles.sectionIdx}>{idx()} &middot; LINKS</span>
              <h2 id="links-heading" className={styles.sectionH}>The links, broken down</h2>
              <p className={styles.sectionSub}>
                Read as text. ScamShield did not open, resolve or expand any of them, so this
                describes how each address is built &mdash; not what is hosted there.
              </p>
            </div>
          </div>
          <UrlBreakdown analyses={report.urlAnalyses} />
        </section>
      )}

      {report.educationalTip && (
        <section className={styles.section2} aria-labelledby="tip-heading">
          <div className={styles.sectionHeadRow}>
            <div>
              <span className={styles.sectionIdx}>{idx()} &middot; TAKEAWAY</span>
              <h2 id="tip-heading" className={styles.sectionH}>Remember this</h2>
            </div>
          </div>
          <p className={styles.tip}>{report.educationalTip}</p>
        </section>
      )}
    </article>
  );
}

export default ReportView;
