/**
 * Risk engine — the only place a number becomes a verdict.
 *
 * Three jobs:
 *   1. Turn deterministic signals into a rule score (with dedup + cap).
 *   2. Fuse the rule score with Gemini's semantic score using a documented,
 *      auditable formula.
 *   3. Produce the fallback attack chain and contextual recommendations used
 *      when Gemini is unavailable.
 *
 * Nothing here is hard-coded to a demo result. Feed it different signals and
 * the score moves.
 *
 * Zero runtime imports by design — unit-testable without a bundler.
 */

import type {
  AttackStep,
  Classification,
  RecommendedAction,
  SecuritySignal,
  Severity,
} from "../../types/analysis";

/** Documented weight of the deterministic layer in the final score. */
export const RULE_WEIGHT = 0.55;
/** Documented weight of the Gemini semantic layer in the final score. */
export const AI_WEIGHT = 0.45;

/**
 * Deduplicate signals by group before scoring.
 *
 * Rationale: "share your OTP" and "6-digit code" describe one underlying
 * weakness. Counting both would let a single idea inflate the score. We keep
 * the highest-weight signal per group at full value and allow each additional
 * signal in the same group to contribute a heavily damped remainder, so a
 * message with genuinely multiple distinct payment asks still scores above one
 * with a single mention.
 */
export function scoreSignals(signals: SecuritySignal[]): number {
  const byGroup = new Map<string, SecuritySignal[]>();
  for (const s of signals) {
    const list = byGroup.get(s.group) ?? [];
    list.push(s);
    byGroup.set(s.group, list);
  }

  let total = 0;
  for (const group of byGroup.values()) {
    const sorted = [...group].sort((a, b) => b.weight - a.weight);
    total += sorted[0].weight;
    // Each extra signal in the same group adds only a quarter of its weight.
    for (const extra of sorted.slice(1)) total += extra.weight * 0.25;
  }

  return Math.min(100, Math.round(total));
}

/** Map a 0–100 score onto the four severity bands from the spec. */
export function severityFromScore(score: number): Severity {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

/**
 * Combine deterministic and semantic scores.
 *
 * finalScore = round(ruleScore * 0.55 + aiScore * 0.45)
 *
 * When Gemini is unavailable, `aiScore` is null and the rule score stands on
 * its own rather than being silently scaled down — a fallback report should not
 * look artificially safe just because the AI layer was missing.
 */
export function combineScores(ruleScore: number, aiScore: number | null): number {
  const rule = clamp(ruleScore);
  if (aiScore === null) return rule;
  return Math.min(100, Math.round(rule * RULE_WEIGHT + clamp(aiScore) * AI_WEIGHT));
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * Confidence derived from how much evidence we actually have.
 *
 * Deliberately conservative: a single weak signal should never be presented as
 * a confident conclusion. Reported as 0–1.
 */
export function deterministicConfidence(signals: SecuritySignal[], score: number): number {
  const distinctGroups = new Set(signals.map((s) => s.group)).size;
  const highSeverity = signals.filter((s) => s.severity === "HIGH").length;

  let confidence = 0.35 + distinctGroups * 0.08 + highSeverity * 0.05;
  if (score < 25 && signals.length === 0) confidence = 0.6; // confident it looks ordinary
  return Math.round(Math.min(0.9, confidence) * 100) / 100;
}

/* ------------------------------------------------------------------ *
 * Fallback narrative — used when Gemini cannot be reached.
 * ------------------------------------------------------------------ */

/**
 * Build a plausible attack path from deterministic signals.
 *
 * Framed throughout as what *could* happen, never as an assertion about what
 * did happen.
 */
export function buildFallbackAttackChain(
  signals: SecuritySignal[],
  classification: Classification,
  hasUrl: boolean,
): AttackStep[] {
  if (classification === "SAFE") return [];

  const groups = new Set(signals.map((s) => s.group));
  const chain: AttackStep[] = [];
  let step = 1;

  chain.push({
    step: step++,
    title: "Message arrives",
    description:
      "A message reaches you through a channel you cannot verify — SMS, WhatsApp, email or a DM — styled to look routine or official.",
    icon: "MessageSquare",
  });

  if (groups.has("impersonation")) {
    chain.push({
      step: step++,
      title: "Trust is borrowed",
      description:
        "The message adopts the name of an organisation you already trust, so you assess the request against your relationship with that brand rather than against the message itself.",
      icon: "BadgeCheck",
    });
  }

  if (groups.has("urgency")) {
    chain.push({
      step: step++,
      title: "Pressure is applied",
      description:
        "A deadline or threat is introduced. The goal is to move you from thinking to reacting before you can verify anything independently.",
      icon: "Clock",
    });
  }

  if (hasUrl) {
    chain.push({
      step: step++,
      title: "You follow the link",
      description:
        "The link leads to a page controlled by the sender. It can be styled to look identical to the real site, because copying a login page requires no special access.",
      icon: "Link2",
    });
  }

  if (groups.has("credential") || groups.has("otp")) {
    chain.push({
      step: step++,
      title: "Details are captured",
      description:
        "Anything typed into that page — username, password, card details, OTP — is delivered straight to whoever built it. An OTP is often requested in real time while the attacker is already logging in as you.",
      icon: "KeyRound",
    });
  }

  if (groups.has("payment")) {
    chain.push({
      step: step++,
      title: "Payment is authorised",
      description:
        "A fee, deposit, collect request or QR scan moves money out of your account. Scanning a QR code authorises a payment; it never receives one.",
      icon: "IndianRupee",
    });
  }

  chain.push({
    step: step++,
    title: "Possible impact",
    description:
      groups.has("payment")
        ? "Funds transferred this way are typically irreversible once authorised, and the receiving account is often emptied within minutes."
        : "Access could be used to take over the account, reach linked services, or contact your circle from an address they already trust.",
    icon: "ShieldAlert",
  });

  return chain;
}

/** Recommendations tailored to the detected category, not a fixed list. */
export function buildFallbackRecommendations(
  classification: Classification,
  signals: SecuritySignal[],
  hasUrl: boolean,
): RecommendedAction[] {
  const groups = new Set(signals.map((s) => s.group));
  const dont: string[] = [];
  const doIt: string[] = [];

  if (classification === "SAFE") {
    return [
      { type: "DO", text: "Stay alert if this message later asks for money, credentials or an OTP." },
      { type: "DO", text: "Verify independently if anything about the sender changes." },
      { type: "DONT", text: "Assume a low risk score guarantees the message is genuine — ScamShield checks the message, not the sender's identity." },
    ];
  }

  if (hasUrl) dont.push("Click the link in this message.");
  if (groups.has("credential")) dont.push("Enter your password, card details or account credentials on any page this message leads to.");
  if (groups.has("otp")) dont.push("Share the OTP with anyone, including someone claiming to be from the bank.");
  if (groups.has("payment")) dont.push("Pay any fee, approve a collect request, or scan a QR code from this message.");
  if (groups.has("social_engineering")) dont.push("Install an app or enable screen sharing because this message asked you to.");
  if (groups.has("secrecy")) dont.push("Keep this to yourself — talk to someone you trust before acting.");
  if (dont.length === 0) dont.push("Act on this message before you have verified it independently.");

  switch (classification) {
    case "UPI_SCAM":
      doIt.push("Open your UPI app directly and check whether any collect request is genuinely pending.");
      doIt.push("Remember that receiving money never requires your UPI PIN.");
      doIt.push("Report the request in-app and block the sender.");
      break;
    case "JOB_SCAM":
      doIt.push("Look up the company's official careers page yourself and apply there.");
      doIt.push("Confirm the recruiter exists through the company's published contact details or LinkedIn presence.");
      doIt.push("Treat any upfront payment as disqualifying — genuine employers do not charge you to be hired.");
      break;
    case "INVESTMENT_SCAM":
      doIt.push("Check whether the firm is registered with the relevant financial regulator.");
      doIt.push("Be sceptical of any guaranteed return — regulated products cannot promise one.");
      doIt.push("Discuss it with someone independent before moving money.");
      break;
    case "DELIVERY_SCAM":
      doIt.push("Track the parcel through the courier's official app or website, typed in yourself.");
      doIt.push("Check whether you are actually expecting a delivery at all.");
      doIt.push("Ignore customs or redelivery fees demanded by SMS link.");
      break;
    case "PHISHING":
    case "ACCOUNT_TAKEOVER":
    case "IMPERSONATION":
      doIt.push("Open the official app or type the website address yourself instead of using this link.");
      doIt.push("Call the organisation using the number printed on your card or official statement, not one from this message.");
      doIt.push("Change your password and enable two-factor authentication if you have already entered anything.");
      break;
    default:
      doIt.push("Verify the claim through an official channel you find yourself.");
      doIt.push("Ask someone you trust for a second opinion before acting.");
  }

  doIt.push("Report and block the sender so the same number cannot reach you again.");

  return [
    ...dont.map((text): RecommendedAction => ({ type: "DONT", text })),
    ...doIt.map((text): RecommendedAction => ({ type: "DO", text })),
  ];
}

/** Plain-language summary for the fallback path. */
export function buildFallbackSummary(
  score: number,
  classification: Classification,
  signals: SecuritySignal[],
): string {
  if (signals.length === 0) {
    return "Local security checks found no recognised scam patterns in this message. That is not the same as confirming the sender is genuine — ScamShield can only assess the text you provided.";
  }

  const severity = severityFromScore(score).toLowerCase();
  const names = [...new Set(signals.map((s) => s.name.toLowerCase()))].slice(0, 3);
  const readable = names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
    : names[0];

  return `Local security checks scored this ${score}/100 (${severity} risk), driven mainly by ${readable}. This assessment is based on detected indicators in the text and is not definitive proof of malicious activity.`;
}
