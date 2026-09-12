"use client";

import { useState } from "react";
import type {
  AttackStep,
  RecommendedAction,
  SecuritySignal,
  Severity,
  ThreatReport,
  UrlAnalysis,
} from "../../types/analysis";
import styles from "../ui/pages.module.css";

/**
 * Threat report renderer, shared by /analyze and /report/[id].
 *
 * Every value here comes from the analysis payload. No score, signal, chain
 * step or recommendation is hard-coded — pass a different report and everything
 * changes. All text is rendered as text, never dangerouslySetInnerHTML, so a
 * message crafted to inject markup cannot escape into the page.
 */

const SEVERITY_COLOR: Record<Severity, string> = {
  LOW: "#34d399",
  MODERATE: "#fbbf24",
  HIGH: "#f59e0b",
  CRITICAL: "#ef4444",
};

/**
 * Headlines avoid absolutes. The engine measures indicators, not intent, so
 * "strong signs of" is accurate where "this is a scam" would not be.
 */
const SEVERITY_HEADLINE: Record<Severity, string> = {
  LOW: "Nothing obviously wrong",
  MODERATE: "Worth a second look",
  HIGH: "Strong signs of a scam",
  CRITICAL: "This looks dangerous",
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  SAFE: "NO THREAT DETECTED",
  SUSPICIOUS: "SUSPICIOUS MESSAGE",
  PHISHING: "PHISHING",
  JOB_SCAM: "FAKE JOB OR INTERNSHIP",
  UPI_SCAM: "UPI PAYMENT SCAM",
  INVESTMENT_SCAM: "INVESTMENT SCAM",
  DELIVERY_SCAM: "DELIVERY SCAM",
  IMPERSONATION: "IMPERSONATION",
  ACCOUNT_TAKEOVER: "ACCOUNT TAKEOVER ATTEMPT",
  OTHER: "UNCLASSIFIED",
};

const BANDS = [
  { label: "Low", span: 25, color: "#34d399", key: "LOW" },
  { label: "Moderate", span: 25, color: "#fbbf24", key: "MODERATE" },
  { label: "High", span: 25, color: "#f59e0b", key: "HIGH" },
  { label: "Critical", span: 26, color: "#ef4444", key: "CRITICAL" },
] as const;

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.5) return "Moderate";
  return "Low";
}

function RiskScale({ score, severity }: { score: number; severity: Severity }) {
  const color = SEVERITY_COLOR[severity];

  return (
    <div>
      <div className={styles.scoreRowTop}>
        <span>
          <span className={styles.scoreBig} style={{ color }}>{score}</span>
          <span className={styles.scoreOut}>/ 100</span>
        </span>
        <span
          className={styles.sevPill}
          style={{ color, borderColor: `${color}55`, background: `${color}18` }}
        >
          {severity.charAt(0) + severity.slice(1).toLowerCase()} risk
        </span>
      </div>

      {/*
        A banded scale instead of a dial: seeing where the score falls teaches
        the thresholds, which matters more than watching a gauge fill.
      */}
      <div
        className={styles.bands}
        role="img"
        aria-label={`Risk score ${score} out of 100, in the ${severity.toLowerCase()} band`}
      >
        <div className={styles.bandBar}>
          {BANDS.map((band) => (
            <div
              key={band.key}
              className={styles.bandSeg}
              style={{
                flexGrow: band.span,
                background: band.color,
                opacity: band.key === severity ? 1 : 0.22,
              }}
            />
          ))}
        </div>
        <div className={styles.bandLabels} aria-hidden="true">
          {BANDS.map((band) => (
            <span key={band.key}>{band.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: SecuritySignal }) {
  const toneClass =
    signal.severity === "HIGH"
      ? styles.signalHigh
      : signal.severity === "MEDIUM"
        ? styles.signalMed
        : styles.signalLow;

  const source =
    signal.source === "COMBINED"
      ? { label: "Both checks agree", cls: `${styles.signalTag} ${styles.signalTagBoth}` }
      : signal.source === "AI"
        ? { label: "AI reading", cls: styles.signalTag }
        : { label: "Pattern rule", cls: styles.signalTag };

  return (
    <div className={`${styles.signal} ${toneClass}`}>
      <div className={styles.signalTop}>
        <h3 className={styles.signalName}>{signal.name}</h3>
        <span className={source.cls}>{source.label}</span>
      </div>
      {signal.evidence && <p className={styles.evidence}>{signal.evidence}</p>}
      <p className={styles.signalWhy}>{signal.explanation}</p>
    </div>
  );
}

function AttackChainView({ steps }: { steps: AttackStep[] }) {
  const [open, setOpen] = useState<number | null>(steps[0]?.step ?? null);

  return (
    <>
      <p className={styles.lead} style={{ marginTop: 0, marginBottom: 20 }}>
        One way this message could play out if someone acted on it. This describes a possible path,
        not something that has happened.
      </p>

      <ol className={styles.chain} style={{ listStyle: "none", padding: 0, paddingLeft: 22 }}>
        {steps.map((step) => {
          const isOpen = open === step.step;
          return (
            <li key={step.step} className={styles.chainItem}>
              <span
                className={`${styles.chainDot} ${isOpen ? styles.chainDotOn : ""}`}
                aria-hidden="true"
              />
              <button
                type="button"
                className={styles.chainBtn}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : step.step)}
              >
                <span className={styles.chainRow}>
                  <span className={styles.chainTitle}>{step.title}</span>
                  <span className={styles.chainSign} aria-hidden="true">{isOpen ? "–" : "+"}</span>
                </span>
                {isOpen && <span className={styles.chainText}>{step.description}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Recommendations({ actions }: { actions: RecommendedAction[] }) {
  const donts = actions.filter((a) => a.type === "DONT");
  const dos = actions.filter((a) => a.type === "DO");

  return (
    <div className={styles.recGrid}>
      {donts.length > 0 && (
        <div className={`${styles.recBox} ${styles.recDont}`}>
          <h3 className={styles.recTitle} style={{ color: "#ef4444" }}>Don&rsquo;t</h3>
          <ul className={styles.recList}>
            {donts.map((action, i) => (
              <li key={i} className={styles.recItem}>
                <span className={styles.recMark} style={{ color: "#ef4444" }} aria-hidden="true">✕</span>
                {action.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dos.length > 0 && (
        <div className={`${styles.recBox} ${styles.recDo}`}>
          <h3 className={styles.recTitle} style={{ color: "#34d399" }}>Do this instead</h3>
          <ul className={styles.recList}>
            {dos.map((action, i) => (
              <li key={i} className={styles.recItem}>
                <span className={styles.recMark} style={{ color: "#34d399" }} aria-hidden="true">✓</span>
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
      <p className={styles.lead} style={{ marginTop: 0, marginBottom: 18 }}>
        These links were read as text. ScamShield did not open, resolve or expand any of them, so
        this describes how each address is built &mdash; not what is hosted there.
      </p>

      {analyses.map((analysis, i) => (
        <div key={i} className={styles.urlCard}>
          <p className={styles.urlHead}>{analysis.facts.url}</p>
          <dl className={styles.urlFacts}>
            <div>
              <dt className={styles.statLabel}>Domain</dt>
              <dd className={styles.statValue} style={{ wordBreak: "break-all", fontSize: 13 }}>
                {analysis.facts.hostname || "—"}
              </dd>
            </div>
            <div>
              <dt className={styles.statLabel}>Encrypted</dt>
              <dd className={styles.statValue} style={{ color: analysis.facts.hasHttps ? "#34d399" : "#f59e0b" }}>
                {analysis.facts.hasHttps ? "Yes (HTTPS)" : "No (HTTP)"}
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
}: {
  report: ThreatReport;
  onSave?: () => void;
  saved?: boolean;
}) {
  const severity = report.severity as Severity;

  return (
    <article>
      <div className={styles.verdict}>
        <div className={styles.verdictGrid}>
          <div>
            <p className={styles.classification}>
              {CLASSIFICATION_LABEL[report.classification] ?? report.classification}
            </p>
            <h1 className={styles.verdictTitle}>{SEVERITY_HEADLINE[severity]}</h1>
            <p className={styles.summary}>{report.summary}</p>
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
                <dd className={styles.statValue}>
                  {report.aiScore === null ? "Unavailable" : `${report.aiScore}/100`}
                </dd>
              </div>
              <div>
                <dt className={styles.statLabel}>Confidence</dt>
                <dd className={styles.statValue}>{confidenceLabel(report.confidence)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Shown whenever the AI layer was skipped, so the number is never misread. */}
        {report.analysisMode === "RULE_BASED_FALLBACK" && report.aiUnavailableReason && (
          <p className={`${styles.notice} ${styles.noticeWarn}`}>{report.aiUnavailableReason}</p>
        )}

        {onSave && (
          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={onSave} disabled={saved}>
              {saved ? "Saved to your history" : "Save this report"}
            </button>
          </div>
        )}
      </div>

      <section className={styles.section2}>
        <h2 className={styles.sectionH}>Why ScamShield flagged this</h2>
        {report.signals.length === 0 ? (
          <p className={`${styles.notice} ${styles.noticeInfo}`}>
            No known scam patterns matched this text. That means nothing on our list showed up
            &mdash; it does not confirm who sent the message.
          </p>
        ) : (
          report.signals.map((signal, i) => <SignalCard key={`${signal.name}-${i}`} signal={signal} />)
        )}
      </section>

      {report.attackChain.length > 0 && (
        <section className={styles.section2}>
          <h2 className={styles.sectionH}>How this scam would work</h2>
          <AttackChainView steps={report.attackChain} />
        </section>
      )}

      {report.recommendedActions.length > 0 && (
        <section className={styles.section2}>
          <h2 className={styles.sectionH}>What should I do?</h2>
          <Recommendations actions={report.recommendedActions} />
        </section>
      )}

      {report.urlAnalyses.length > 0 && (
        <section className={styles.section2}>
          <h2 className={styles.sectionH}>The links, broken down</h2>
          <UrlBreakdown analyses={report.urlAnalyses} />
        </section>
      )}

      {report.educationalTip && (
        <section className={styles.section2}>
          <h2 className={styles.sectionH}>Remember this</h2>
          <p className={styles.tip}>{report.educationalTip}</p>
        </section>
      )}
    </article>
  );
}

export default ReportView;
