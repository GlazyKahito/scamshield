/**
 * Deterministic message analyzer.
 *
 * Detects social-engineering patterns using explicit rules, independent of any
 * LLM. This is what stops ScamShield from being "paste message → ask AI": if
 * Gemini is unreachable, this file still produces a real, explainable report.
 *
 * Every rule carries the excerpt that triggered it, so the report can quote the
 * user's own message back as evidence rather than asserting a conclusion.
 *
 * Zero runtime imports by design — unit-testable without a bundler.
 */

import type {
  Classification,
  MessageAnalysis,
  SecuritySignal,
  SignalGroup,
  SignalSeverity,
} from "../../types/analysis";
import { detectImpersonation } from "./brand-detector";
import { extractUrls, parseUrl } from "./url-analyzer";

interface Rule {
  name: string;
  group: SignalGroup;
  severity: SignalSeverity;
  weight: number;
  patterns: RegExp[];
  explanation: string;
}

/**
 * Weights follow the specification. They are intentionally visible here rather
 * than buried in the scoring function, so the scoring model can be read and
 * argued with in one place.
 */
const RULES: Rule[] = [
  {
    name: "OTP request",
    group: "otp",
    severity: "HIGH",
    weight: 20,
    patterns: [
      /\botp\b/i,
      /\bone[- ]time (?:password|pin|code)\b/i,
      /\bverification code\b/i,
      /\bshare (?:the )?code\b/i,
      /\b6[- ]digit code\b/i,
    ],
    explanation:
      "The message involves a one-time passcode. No legitimate bank, wallet or delivery company will ever ask you to share an OTP — the OTP exists specifically to stop someone else acting as you.",
  },
  {
    name: "Credential request",
    group: "credential",
    severity: "HIGH",
    weight: 25,
    patterns: [
      /\bpassword\b/i,
      /\bpin\b(?!\s*code\s*of\s*area)/i,
      /\bcredentials?\b/i,
      /\blog\s?in (?:to|at|here|now)\b/i,
      /\bsign\s?in (?:to|at|here|now)\b/i,
      /\bverify your (?:account|identity|details)\b/i,
      /\bre-?activate your account\b/i,
      /\bcomplete (?:your )?kyc\b/i,
      /\bupdate your (?:account|bank|kyc) details\b/i,
    ],
    explanation:
      "The message pushes you toward entering account credentials or completing a verification step. This is the core mechanic of phishing: the page you land on captures whatever you type.",
  },
  {
    name: "Payment request",
    group: "payment",
    severity: "HIGH",
    weight: 20,
    patterns: [
      /\bpay (?:rs\.?|₹|inr|\$)?\s?\d/i,
      /\bregistration fee\b/i,
      /\bprocessing fee\b/i,
      /\bsecurity deposit\b/i,
      /\brefundable (?:fee|amount|deposit)\b/i,
      /\btransfer (?:the )?(?:money|amount|funds)\b/i,
      /\bupi (?:id|pin)\b/i,
      /\bscan (?:this |the )?qr\b/i,
      /\bcollect request\b/i,
      /\bsend (?:rs\.?|₹|inr|\$)\s?\d/i,
    ],
    explanation:
      "The message asks for money or payment authorisation. Requests to pay a fee up front, approve a collect request, or scan a QR code to *receive* money are classic payment traps — scanning a QR code sends money, it never receives it.",
  },
  {
    name: "Urgency pressure",
    group: "urgency",
    severity: "HIGH",
    weight: 18,
    patterns: [
      /\burgent(?:ly)?\b/i,
      /\bimmediate(?:ly)?\b/i,
      /\bwithin \d+ (?:hours?|minutes?|days?)\b/i,
      /\btoday\b.*\b(?:block|suspend|expire|clos)/i,
      /\b(?:block|suspend|expire|clos\w+)\b.*\btoday\b/i,
      /\blast (?:chance|warning|reminder)\b/i,
      /\bact now\b/i,
      /\bexpir(?:es|ing|ed) (?:today|soon|in)\b/i,
      /\bbefore midnight\b/i,
    ],
    explanation:
      "The message creates time pressure. Urgency is used deliberately to stop you checking with anyone else — a real organisation will let you call them back.",
  },
  {
    name: "Account threat",
    group: "urgency",
    severity: "HIGH",
    weight: 18,
    patterns: [
      /\baccount (?:will be |has been )?(?:blocked|suspended|frozen|deactivated|closed)\b/i,
      /\bservices? (?:will be )?(?:suspended|terminated)\b/i,
      /\bpermanently (?:blocked|deleted|disabled)\b/i,
      /\blegal action\b/i,
      /\bpenalty\b/i,
      /\bfir (?:will be |has been )?(?:filed|registered)\b/i,
    ],
    explanation:
      "The message threatens loss of access, money or legal consequences. Fear short-circuits careful thinking, which is exactly the point.",
  },
  {
    name: "Reward or prize bait",
    group: "reward_bait",
    severity: "MEDIUM",
    weight: 12,
    patterns: [
      /\bcongratulations\b/i,
      /\byou (?:have been|are) (?:selected|chosen|shortlisted)\b/i,
      /\byou(?:'ve| have) won\b/i,
      /\blucky (?:winner|draw)\b/i,
      /\bclaim your (?:prize|reward|gift|cashback)\b/i,
      /\bfree (?:gift|prize|voucher|recharge)\b/i,
      /\bcashback of\b/i,
      /\bguaranteed (?:returns?|profit|income)\b/i,
    ],
    explanation:
      "The message opens with an unexpected win, selection or reward. Unsolicited good news is the cheapest way to get someone to keep reading and stop questioning.",
  },
  {
    name: "Unrealistic financial promise",
    group: "social_engineering",
    severity: "MEDIUM",
    weight: 15,
    patterns: [
      /\b(?:daily|weekly|monthly) (?:income|earning|profit)\b/i,
      /\bearn (?:up ?to )?(?:rs\.?|₹|inr|\$)\s?[\d,]+/i,
      /\b(?:double|triple) your (?:money|investment)\b/i,
      /\b\d+\s?% (?:returns?|profit|guaranteed)\b/i,
      // Hyphenated forms ("work-from-home") are at least as common as spaced ones.
      /\bwork[- ]?from[- ]?home\b[\s\S]*(?:rs\.?|₹|\$|\d{4,})/i,
      /\bno experience (?:required|needed)\b/i,
      /\bpart[- ]time job\b[\s\S]*(?:rs\.?|₹|\$|\d{4,})/i,
    ],
    explanation:
      "The message promises returns or pay that are far above what the described effort would normally earn. If the arithmetic looks too good, the offer is usually the product and you are the payment.",
  },
  {
    name: "Upfront fee to be hired or to claim",
    group: "payment",
    severity: "HIGH",
    weight: 22,
    patterns: [
      /\b(?:registration|processing|security|training|joining|refundable)\s+fee\b[\s\S]{0,80}\b(?:job|internship|position|offer|selected|confirm|prize|reward)\b/i,
      /\b(?:job|internship|position|offer|selected|prize|reward)\b[\s\S]{0,80}\b(?:registration|processing|security|training|joining|refundable)\s+fee\b/i,
      /\bpay\b[\s\S]{0,60}\bto (?:confirm|secure|claim|release)\b[\s\S]{0,40}\b(?:position|job|offer|prize|reward|parcel)\b/i,
    ],
    explanation:
      "The message asks you to pay before you receive something — a job, a prize, or a parcel. Money flowing toward you should never require money from you first. Legitimate employers deduct costs from salary; they do not invoice candidates.",
  },
  {
    name: "PIN or QR required to receive money",
    group: "payment",
    severity: "HIGH",
    weight: 25,
    patterns: [
      /\b(?:scan|qr)\b[\s\S]{0,60}\b(?:to )?(?:receive|get|claim|collect)\b/i,
      /\b(?:receive|get|claim|collect)\b[\s\S]{0,60}\b(?:enter|share)\b[\s\S]{0,25}\bpin\b/i,
      /\b(?:enter|share)\b[\s\S]{0,25}\bpin\b[\s\S]{0,60}\bto (?:receive|get|claim|collect)\b/i,
      /\baccept (?:the )?(?:collect )?request\b[\s\S]{0,50}\b(?:receive|credit)\b/i,
    ],
    explanation:
      "The message claims you must enter a PIN or scan a QR code in order to *receive* money. This is backwards: authenticating with your PIN or scanning a QR code authorises money leaving your account. Incoming payments never need either.",
  },
  {
    name: "Secrecy pressure",
    group: "secrecy",
    severity: "MEDIUM",
    weight: 10,
    patterns: [
      /\bdo not (?:tell|inform|share this with|discuss)\b/i,
      /\bkeep this (?:confidential|secret|between us)\b/i,
      /\bdon'?t (?:tell|inform) (?:anyone|your family|the bank|police)\b/i,
      /\bstrictly confidential\b/i,
      /\bwithout informing\b/i,
    ],
    explanation:
      "The message asks you to keep it private. Isolation from people who might talk you out of it is a hallmark of a scam, not of legitimate business.",
  },
  {
    name: "Authority impersonation",
    group: "impersonation",
    severity: "MEDIUM",
    weight: 12,
    patterns: [
      /\b(?:income tax|it) department\b/i,
      /\bcyber ?crime\b/i,
      /\bpolice (?:department|station)\b/i,
      /\bcustoms (?:department|office|duty)\b/i,
      /\b(?:rbi|reserve bank)\b/i,
      /\bgovernment of india\b/i,
      /\btrai\b/i,
      /\bcourier (?:has been )?(?:seized|detained)\b/i,
    ],
    explanation:
      "The message claims to speak for a government body or law-enforcement agency. Real agencies contact people through official written channels, not SMS links.",
  },
  {
    name: "Suspicious call to action",
    group: "social_engineering",
    severity: "MEDIUM",
    weight: 15,
    patterns: [
      /\bclick (?:here|the link|below|this link)\b/i,
      /\btap (?:here|the link|below)\b/i,
      /\bdownload (?:the )?(?:app|apk|attachment|file)\b/i,
      /\binstall (?:this|the) app\b/i,
      /\bopen the (?:link|attachment)\b/i,
      /\benable (?:screen ?share|anydesk|teamviewer)\b/i,
      /\bcall (?:this number |us )?(?:immediately|urgently)\b/i,
    ],
    explanation:
      "The message directs you to a single action — click, install, or call — chosen by the sender. Contacting an organisation through a channel they pushed to you removes every check that would normally protect you.",
  },
  {
    name: "Emotional manipulation",
    group: "social_engineering",
    severity: "LOW",
    weight: 10,
    patterns: [
      /\bhelp me\b.*\b(?:urgent|emergency|money)\b/i,
      /\bi (?:am|'m) (?:stuck|stranded|in trouble)\b/i,
      /\bmedical emergency\b/i,
      /\bdon'?t have (?:anyone|anybody) else\b/i,
      /\bthis is (?:mom|dad|mum|your son|your daughter)\b/i,
      /\bnew number\b.*\b(?:save|whatsapp)\b/i,
    ],
    explanation:
      "The message leans on a personal emergency or family relationship. Impersonating someone you trust bypasses scepticism far more effectively than a fake brand does.",
  },
  {
    name: "Unexpected attachment",
    group: "social_engineering",
    severity: "MEDIUM",
    weight: 12,
    patterns: [
      /\battach(?:ed|ment)\b.*\b(?:invoice|receipt|statement|document|resume)\b/i,
      /\b\.(?:apk|exe|scr|zip|rar)\b/i,
      /\benable (?:macros|editing)\b/i,
    ],
    explanation:
      "The message references a file to open or install. Attachments and app installs are a direct route onto your device, bypassing the browser entirely.",
  },
];

/** Grab a readable excerpt around the match so the report can show evidence. */
function excerpt(text: string, match: RegExpMatchArray): string {
  const idx = match.index ?? 0;
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + match[0].length + 30);
  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

export function normalizeText(input: string): string {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Run the deterministic rule set over a message body. */
export function analyzeMessageText(rawText: string): SecuritySignal[] {
  const text = normalizeText(rawText);
  const signals: SecuritySignal[] = [];

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      signals.push({
        name: rule.name,
        severity: rule.severity,
        evidence: excerpt(text, match),
        explanation: rule.explanation,
        source: "RULE",
        group: rule.group,
        weight: rule.weight,
      });
      break; // one signal per rule; the risk engine dedupes by group as well
    }
  }

  return signals;
}

/**
 * Infer a scam category from deterministic signals alone.
 *
 * Used directly when Gemini is unavailable, and as a sanity check against
 * Gemini's own classification when it is available.
 */
export function classifyFromSignals(
  signals: SecuritySignal[],
  text: string,
  score: number,
): Classification {
  const groups = new Set(signals.map((s) => s.group));
  const lower = text.toLowerCase();

  if (score < 25) return "SAFE";

  const has = (g: SignalGroup) => groups.has(g);

  if (/\bupi\b|\bqr\b|collect request|phonepe|paytm|gpay|google pay/.test(lower) && has("payment")) {
    return "UPI_SCAM";
  }
  if (/internship|job|hiring|recruit|placement|work ?from ?home|salary|position/.test(lower) && has("payment")) {
    return "JOB_SCAM";
  }
  if (/invest|trading|stock|crypto|mutual fund|portfolio|returns?/.test(lower)) {
    return "INVESTMENT_SCAM";
  }
  if (/delivery|parcel|courier|shipment|package|customs|dispatch|tracking/.test(lower)) {
    return "DELIVERY_SCAM";
  }
  if (has("credential") || has("otp")) {
    return has("impersonation") ? "PHISHING" : "ACCOUNT_TAKEOVER";
  }
  if (has("impersonation")) return "IMPERSONATION";
  if (score >= 50) return "SUSPICIOUS";
  return "SUSPICIOUS";
}

/**
 * Full deterministic analysis of a message: rules + extracted URLs +
 * brand impersonation. This is the entry point used by the API route.
 */
export function analyzeMessage(rawText: string): MessageAnalysis {
  const text = normalizeText(rawText);
  const signals = analyzeMessageText(text);
  const extractedUrls = extractUrls(text);

  const hostnames = extractedUrls
    .map((u) => parseUrl(u).hostname)
    .filter(Boolean);

  const { signals: brandSignals, claimedBrands } = detectImpersonation(text, hostnames);
  const all = [...signals, ...brandSignals];

  const score = Math.min(100, all.reduce((sum, s) => sum + s.weight, 0));
  return { signals: all, score, extractedUrls, claimedBrands };
}
