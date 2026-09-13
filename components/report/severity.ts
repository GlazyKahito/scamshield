import type { Severity } from "../../types/analysis";

/**
 * Severity presentation shared by the report, dashboard and landing demo.
 *
 * Hex values mirror the --sev-* tokens in app/globals.css. They are needed as
 * literals because several call sites derive translucent tints from them.
 */

export const SEVERITY_COLOR: Record<Severity, string> = {
  LOW: "#4CAF7D",
  MODERATE: "#D9A032",
  HIGH: "#E5533A",
  CRITICAL: "#FF3B30",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  LOW: "Low risk",
  MODERATE: "Moderate risk",
  HIGH: "High risk",
  CRITICAL: "Critical risk",
};

/**
 * Headlines avoid absolutes. The engine measures indicators, not intent, so
 * "strong signs of" is accurate where "this is a scam" would not be.
 */
export const SEVERITY_HEADLINE: Record<Severity, string> = {
  LOW: "Nothing obviously wrong",
  MODERATE: "Worth a second look",
  HIGH: "Strong signs of a scam",
  CRITICAL: "This looks dangerous",
};

export const CLASSIFICATION_LABEL: Record<string, string> = {
  SAFE: "No threat detected",
  SUSPICIOUS: "Suspicious message",
  PHISHING: "Phishing",
  JOB_SCAM: "Fake job or internship",
  UPI_SCAM: "UPI payment scam",
  INVESTMENT_SCAM: "Investment scam",
  DELIVERY_SCAM: "Delivery scam",
  IMPERSONATION: "Impersonation",
  ACCOUNT_TAKEOVER: "Account takeover attempt",
  OTHER: "Unclassified",
};

export const INPUT_TYPE_LABEL: Record<string, string> = {
  TEXT: "Message",
  URL: "Link",
  IMAGE: "Screenshot",
};

export function toSeverity(value: string): Severity {
  return value === "LOW" || value === "MODERATE" || value === "HIGH" || value === "CRITICAL" ? value : "MODERATE";
}

/** Translucent tint of a severity colour, for pills and backgrounds. */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
