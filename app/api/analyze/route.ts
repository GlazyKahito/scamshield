/**
 * POST /api/analyze — message analysis.
 *
 * Privacy note: the submitted message is never written to application logs.
 * Errors log a reason code and never the content that produced them, so an
 * operator reading logs cannot reconstruct what users pasted.
 */

import { NextResponse } from "next/server";
import { analyzeTextSchema } from "../../../lib/validation/schemas";
import { analyzeTextInput } from "../../../lib/security/pipeline";
import { checkRateLimit, clientKey } from "../../../lib/utils/rate-limit";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const parsed = analyzeTextSchema.safeParse(body);
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
