/**
 * POST /api/analyze — message analysis.
 *
 * Privacy note: the submitted message is never written to application logs.
 * Errors log a reason code and never the content that produced them, so an
 * operator reading logs cannot reconstruct what users pasted.
 */

import { NextResponse } from "next/server";
import { analyzeTextSchema, MAX_TEXT_BODY_BYTES } from "../../../lib/validation/schemas";
import { analyzeTextInput } from "../../../lib/security/pipeline";
import { checkRateLimit, clientKey } from "../../../lib/utils/rate-limit";
import { readJsonBody } from "../../../lib/utils/request";

export const runtime = "nodejs";
/** Never cache an analysis response. */
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
      { success: false, error: read.status === 413 ? "That message is too large to analyse." : "Invalid request body." },
      { status: read.status },
    );
  }

  const parsed = analyzeTextSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Please paste a message or valid URL." },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyzeTextInput(parsed.data.text);
    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    // Log the failure type only — never the submitted text.
    console.error("[api/analyze] pipeline failure:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, error: "Analysis failed unexpectedly. Please try again." },
      { status: 500 },
    );
  }
}
