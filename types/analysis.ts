/**
 * ScamShield — core domain types.
 *
 * These types are the contract between four independent layers:
 *   1. the deterministic security engine (lib/security/*)
 *   2. the Gemini semantic layer        (lib/ai/*)
 *   3. the risk engine that fuses them  (lib/security/risk-engine.ts)
 *   4. the UI                            (app/*, components/*)
 *
 * Deliberately dependency-free so the engine can be unit-tested in isolation.
 */

export type Severity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

/** Severity of an individual signal. Coarser than overall report severity. */
export type SignalSeverity = "LOW" | "MEDIUM" | "HIGH";

export type Classification =
  | "SAFE"
  | "SUSPICIOUS"
  | "PHISHING"
  | "JOB_SCAM"
  | "UPI_SCAM"
  | "INVESTMENT_SCAM"
  | "DELIVERY_SCAM"
  | "IMPERSONATION"
  | "ACCOUNT_TAKEOVER"
  | "OTHER";

export const CLASSIFICATIONS: Classification[] = [
  "SAFE",
  "SUSPICIOUS",
  "PHISHING",
  "JOB_SCAM",
  "UPI_SCAM",
  "INVESTMENT_SCAM",
  "DELIVERY_SCAM",
  "IMPERSONATION",
  "ACCOUNT_TAKEOVER",
  "OTHER",
];

export const SEVERITIES: Severity[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

/** Where a signal came from. Surfaced in the UI so users can see the evidence trail. */
export type SignalSource = "RULE" | "AI" | "COMBINED";

/**
 * Stable identifiers for deterministic signals.
 *
 * Signals sharing a `group` are deduplicated by the risk engine so that, for
 * example, three different OTP phrasings cannot stack to 60 points.
 */
export type SignalGroup =
  | "credential"
  | "payment"
  | "otp"
  | "urgency"
  | "impersonation"
  | "suspicious_url"
  | "url_obfuscation"
  | "social_engineering"
  | "reward_bait"
  | "secrecy";

export interface SecuritySignal {
  /** Human-readable name shown on the report card, e.g. "OTP request". */
  name: string;
  severity: SignalSeverity;
  /** The literal excerpt from user input that triggered this. Never invented. */
  evidence: string;
  /** Plain-English explanation for a non-technical reader. */
  explanation: string;
  source: SignalSource;
  group: SignalGroup;
  /** Points this signal contributes before capping/dedup. */
  weight: number;
}

export interface AttackStep {
  step: number;
  title: string;
  description: string;
  /** lucide-react icon name resolved by the UI. */
  icon?: string;
}

export interface RecommendedAction {
  type: "DO" | "DONT";
  text: string;
}

/** Structural facts about a URL, derived purely from parsing the string. */
export interface UrlFacts {
  url: string;
  protocol: string;
  hostname: string;
  pathname: string;
  query: string;
  fragment: string;
  port: string | null;
  hasHttps: boolean;
  hostnameLength: number;
  subdomainCount: number;
  pathLength: number;
  urlLength: number;
  isIpHost: boolean;
  isPunycode: boolean;
  hasEncodedChars: boolean;
  isShortener: boolean;
  tld: string;
  /** True when the URL string could not be parsed at all. */
  malformed: boolean;
}

export interface UrlAnalysis {
  facts: UrlFacts;
  signals: SecuritySignal[];
  /** 0–100, capped. Structural risk only — never a reputation verdict. */
  score: number;
}

export interface MessageAnalysis {
  signals: SecuritySignal[];
  score: number;
  extractedUrls: string[];
  /** Brands the message text claims to represent, if any. */
  claimedBrands: string[];
}

/** Output of the deterministic layer, before Gemini is consulted. */
export interface RuleAnalysis {
  score: number;
  signals: SecuritySignal[];
  extractedUrls: string[];
  urlAnalyses: UrlAnalysis[];
  claimedBrands: string[];
  /** Best-guess category from deterministic signals alone. */
  classification: Classification;
}

/** Shape Gemini is asked to return. Validated with Zod before use. */
export interface AiAnalysis {
  riskScore: number;
  classification: Classification;
  severity: Severity;
  confidence: number;
  summary: string;
  signals: Array<{
    name: string;
    severity: SignalSeverity;
    evidence: string;
    explanation: string;
  }>;
  attackChain: AttackStep[];
  recommendedActions: RecommendedAction[];
  educationalTip: string;
}

export type AnalysisMode = "HYBRID" | "RULE_BASED_FALLBACK";

export type InputType = "TEXT" | "URL" | "IMAGE";

/** The final artifact rendered by the report page and persisted to storage. */
export interface ThreatReport {
  id: string;
  createdAt: string;
  inputType: InputType;
  /** Short label for history lists. Derived, never the full message. */
  title: string;
  /** Kept in memory for the active report; persisted only if the user saves. */
  inputPreview: string;

  riskScore: number;
  ruleScore: number;
  aiScore: number | null;
  severity: Severity;
  classification: Classification;
  confidence: number;
  summary: string;

  signals: SecuritySignal[];
  attackChain: AttackStep[];
  recommendedActions: RecommendedAction[];
  educationalTip: string;

  urlAnalyses: UrlAnalysis[];
  analysisMode: AnalysisMode;
  /** Set when Gemini was skipped or failed, so the UI can explain why. */
  aiUnavailableReason?: string;
}

export interface SimulatorResult {
  id: string;
  scenarioId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  category: Classification;
  createdAt: string;
}
