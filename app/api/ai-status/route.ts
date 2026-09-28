/**
 * GET /api/ai-status — is the Gemini layer reachable, and if not, why?
 *
 * Returns Google's status and reason code per model (e.g. 400 API_KEY_INVALID,
 * 403 SERVICE_DISABLED) so a failing deployment can be diagnosed without log
 * access. Never returns the key, its length, or any provider message text.
 *
 *   ?models=a,b   probe these model names instead of the configured chain
 *   ?list=1       also list the models this key can call
 *   ?full=1       send the real analysis request (schema, settings), not a bare prompt
 */

import { NextResponse } from "next/server";
import { listAvailableModels, probeGemini } from "../../../lib/ai/gemini";
import { checkRateLimit, clientKey } from "../../../lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROBES = 6;
const MODEL_NAME = /^gemini-[a-z0-9.-]{1,60}$/;

export async function GET(request: Request) {
  // Separate bucket from analysis requests; each probe costs several model calls.
  const limit = checkRateLimit(`ai-status:${clientKey(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many status checks. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const params = new URL(request.url).searchParams;
  const requested = (params.get("models") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => MODEL_NAME.test(m))
    .slice(0, MAX_PROBES);

  const status = await probeGemini(requested.length > 0 ? requested : undefined, params.get("full") === "1");
  const available = params.get("list") === "1" ? await listAvailableModels().catch(() => null) : undefined;

  return NextResponse.json({ ...status, available }, { headers: { "Cache-Control": "no-store" } });
}
