/**
 * GET /api/ai-status — is the Gemini layer reachable, and if not, why?
 *
 * Returns Google's status and reason code per model (e.g. 400 API_KEY_INVALID,
 * 403 SERVICE_DISABLED) so a failing deployment can be diagnosed without log
 * access. Never returns the key, its length, or any provider message text.
 */

import { NextResponse } from "next/server";
import { probeGemini } from "../../../lib/ai/gemini";
import { checkRateLimit, clientKey } from "../../../lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Separate bucket from analysis requests; each probe costs up to three model calls.
  const limit = checkRateLimit(`ai-status:${clientKey(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many status checks. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const status = await probeGemini();
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
