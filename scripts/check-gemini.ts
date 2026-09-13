/**
 * Live smoke test for the Gemini layer: `npm run check:gemini`.
 *
 * Sends one known scam message through the real pipeline and reports whether
 * the report came back HYBRID (Gemini answered) or fell back to the rules.
 * Reads GEMINI_API_KEY / GEMINI_MODEL from .env.local, like `next dev` does.
 */

import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const SAMPLE =
  "URGENT: Your SBI account will be blocked today. Verify your KYC now at http://sbi-kyc-update.xyz/login and share the OTP to avoid suspension.";

async function main(): Promise<void> {
  const { analyzeWithGemini, getModelName, isAiConfigured } = await import("../lib/ai/gemini");
  const { analyzeTextInput } = await import("../lib/security/pipeline");

  console.log(`model: ${getModelName()}`);
  if (!isAiConfigured()) {
    console.error("GEMINI_API_KEY is not set. Add it to .env.local (see .env.example).");
    process.exit(1);
  }

  const started = Date.now();
  const ai = await analyzeWithGemini(SAMPLE);
  console.log(`gemini call: ${Date.now() - started} ms`);
  if (!ai.ok) {
    console.error(`FAILED: ${ai.reason} (${ai.message})`);
    process.exit(1);
  }
  console.log("gemini analysis:", JSON.stringify(ai.analysis, null, 2));

  const report = await analyzeTextInput(SAMPLE);
  console.log(`report mode: ${report.analysisMode}, score: ${report.riskScore}`);
  process.exit(report.analysisMode === "HYBRID" ? 0 : 1);
}

main();
