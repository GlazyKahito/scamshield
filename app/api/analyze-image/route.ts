/**
 * POST /api/analyze-image — screenshot analysis.
 *
 * Requires a vision-capable Gemini model. When vision is unavailable we return
 * a clear, honest message rather than faking OCR.
 *
 * Uploaded images are held in memory for the duration of the request only.
 * Nothing is written to disk.
 */

import { NextResponse } from "next/server";
import { analyzeImageSchema, MAX_IMAGE_BODY_BYTES } from "../../../lib/validation/schemas";
import { analyzeImageWithGemini, isAiConfigured, supportsVision } from "../../../lib/ai/gemini";
import { buildReport, runRuleEngineOnText } from "../../../lib/security/pipeline";
import { checkRateLimit, clientKey } from "../../../lib/utils/rate-limit";
import { readJsonBody } from "../../../lib/utils/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Lets the analyzer UI disable the screenshot tab before a user uploads.
  return NextResponse.json({ available: isAiConfigured() && supportsVision() });
}

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many analyses in a short time. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const read = await readJsonBody(request, MAX_IMAGE_BODY_BYTES);
  if (!read.ok) {
    return NextResponse.json(
      { success: false, error: read.status === 413 ? "Screenshots must be under 3MB." : "Invalid request body." },
      { status: read.status },
    );
  }

  const parsed = analyzeImageSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Please upload a PNG, JPEG or WebP screenshot." },
      { status: 400 },
    );
  }

  try {
    const aiResult = await analyzeImageWithGemini(parsed.data);

    if (!aiResult.ok) {
      // No text was recovered, so there is nothing for the rule engine to work
      // with. Say so plainly instead of returning an empty-looking report.
      return NextResponse.json(
        { success: false, error: aiResult.message, reason: aiResult.reason },
        { status: aiResult.reason === "VISION_UNSUPPORTED" ? 501 : 503 },
      );
    }

    // Re-run the deterministic engine over the text the model reported seeing,
    // so a screenshot receives the same hybrid scoring as a pasted message.
    const extracted = aiResult.analysis.signals.map((s) => s.evidence).join("\n");
    const rule = runRuleEngineOnText(extracted);

    const analysis = buildReport({
      input: extracted || aiResult.analysis.summary,
      inputType: "IMAGE",
      rule,
      aiResult,
    });

    return NextResponse.json({ success: true, analysis, extractedText: extracted });
  } catch (error) {
    console.error("[api/analyze-image] pipeline failure:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, error: "Screenshot analysis failed unexpectedly. Please try pasting the message instead." },
      { status: 500 },
    );
  }
}
