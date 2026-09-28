/**
 * GET /api/ai-status — is the Gemini layer reachable, and if not, why?
 *
 * Returns Google's status and reason code per model (e.g. 400 API_KEY_INVALID,
 * 403 SERVICE_DISABLED) so a failing deployment can be diagnosed without log
 * access. Never returns the key or its length.
 *
 * Every call spends real Gemini quota, so the route is off unless
 * AI_STATUS_TOKEN is set, and then needs ?token=<that value>.
 *
 *   ?models=a,b   probe these model names instead of the configured chain
 *   ?list=1       also list the models this key can call
 *   ?full=1       send the real analysis request (schema, settings), not a bare prompt
 *   ?pipeline=1   run the real text analysis on a fixed specimen and trace each model attempt
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { analyzeWithGemini, listAvailableModels, probeGemini } from "../../../lib/ai/gemini";
import { checkRateLimit, clientKey } from "../../../lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROBES = 6;
const MODEL_NAME = /^gemini-[a-z0-9.-]{1,60}$/;
/** Fixed input for ?pipeline=1, so the probe can never be used as an open Gemini proxy. */
const PIPELINE_SPECIMEN =
  "URGENT: Your SBI account will be blocked today. Complete KYC at http://sbi-secure-login.example/kyc and share the OTP.";

/** Constant-time comparison, so the token cannot be guessed byte by byte from timing. */
function tokenMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const expected = process.env.AI_STATUS_TOKEN?.trim();
  if (!expected || !tokenMatches(new URL(request.url).searchParams.get("token"), expected)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Separate bucket from analysis requests; each probe costs several model calls.
  const limit = checkRateLimit(`ai-status:${clientKey(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many status checks. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const params = new URL(request.url).searchParams;

  // Run the real text-analysis path (failover, validation) on a fixed specimen.
  if (params.get("pipeline") === "1") {
    const trace: string[] = [];
    const result = await analyzeWithGemini(PIPELINE_SPECIMEN, {
      ruleFindings: ["Urgency pressure", "Credential request"],
      hostnames: ["sbi-secure-login.example"],
      trace,
    });
    return NextResponse.json(
      { ok: result.ok, model: result.ok ? result.model : undefined, reason: result.ok ? undefined : result.reason, trace },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const requested = (params.get("models") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => MODEL_NAME.test(m))
    .slice(0, MAX_PROBES);

  const status = await probeGemini(requested.length > 0 ? requested : undefined, params.get("full") === "1");
  const available = params.get("list") === "1" ? await listAvailableModels().catch(() => null) : undefined;

  return NextResponse.json({ ...status, available }, { headers: { "Cache-Control": "no-store" } });
}
