/**
 * POST /api/analyze-url — URL analysis.
 *
 * SAFETY: the submitted URL is parsed as a string. This route never issues a
 * request to it, never resolves it, and never expands shorteners.
 */

import { NextResponse } from "next/server";
import { analyzeUrlSchema, MAX_TEXT_BODY_BYTES } from "../../../lib/validation/schemas";
import { analyzeUrlInput } from "../../../lib/security/pipeline";
import { checkRateLimit, clientKey } from "../../../lib/utils/rate-limit";
import { readJsonBody } from "../../../lib/utils/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many analyses in a short time. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const read = await readJsonBody(request, MAX_TEXT_BODY_BYTES);
  if (!read.ok) {
    return NextResponse.json(
      { success: false, error: read.status === 413 ? "That URL is too long to analyse." : "Invalid request body." },
      { status: read.status },
    );
  }

  const parsed = analyzeUrlSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Please paste a valid URL." },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyzeUrlInput(parsed.data.url);
    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error("[api/analyze-url] pipeline failure:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, error: "Analysis failed unexpectedly. Please try again." },
      { status: 500 },
    );
  }
}
