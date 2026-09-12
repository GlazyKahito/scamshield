"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreatReport } from "../../types/analysis";
import { saveReport } from "../../lib/storage/history";
import { ReportView } from "../report/report-view";
import styles from "../ui/pages.module.css";

/**
 * The analyzer.
 *
 * Every result on this page comes from the existing API routes — /api/analyze,
 * /api/analyze-url and /api/analyze-image. There is no client-side scoring, no
 * mock response, and no API key anywhere in this file. The browser sends the
 * user's input to our own server route; the Gemini key stays server-side.
 */

type Mode = "MESSAGE" | "URL" | "SCREENSHOT";

const MAX_TEXT = 8000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Progress stages.
 *
 * These name real steps in the server pipeline rather than inventing reassuring
 * filler. We advance through them on a timer because the server returns one
 * response, so this is presentation — it never claims a step finished that did
 * not run, and the last stage holds until the real response lands.
 */
const STAGES = [
  "Extracting text and links",
  "Running pattern checks",
  "Analysing intent with AI",
  "Building your report",
];

/** Fictional demo specimens. `.example` is reserved and cannot resolve. */
const EXAMPLES = [
  {
    id: "banking",
    label: "Bank KYC warning",
    text: "URGENT: Your SBI account will be blocked today.\nComplete KYC immediately at:\nhttps://sbi-secure-login.example",
  },
  {
    id: "internship",
    label: "Internship offer",
    text: "Congratulations! You have been selected for a ₹60,000/month work-from-home internship with no experience required. Pay ₹1,999 registration fee to confirm your position before 6 PM today.",
  },
  {
    id: "upi",
    label: "Refund request",
    text: "Sir your refund of ₹5,000 is approved. Please scan this QR code and enter your UPI PIN to receive the amount in your account.",
  },
  {
    id: "ordinary",
    label: "An ordinary message",
    text: "Hi Ma, reaching home by 8 tonight. Do you need anything from the market? Also Priya called, she said she'll come over on Sunday.",
  },
];

export function Analyzer() {
  const [mode, setMode] = useState<Mode>("MESSAGE");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ThreatReport | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [visionAvailable, setVisionAvailable] = useState<boolean | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ask the server whether the configured model supports vision, so the
  // screenshot tab can explain itself before the user uploads anything.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/analyze-image")
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((data: { available?: boolean }) => {
        if (!cancelled) setVisionAvailable(Boolean(data.available));
      })
      .catch(() => {
        if (!cancelled) setVisionAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, []);

  const startStages = useCallback(() => {
    setStage(0);
    if (stageTimer.current) clearInterval(stageTimer.current);
    stageTimer.current = setInterval(() => {
      // Hold on the final stage until the real response arrives.
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, 900);
  }, []);

  const stopStages = useCallback(() => {
    if (stageTimer.current) {
      clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setText("");
    setUrl("");
    setImageData(null);
    setReport(null);
    setError(null);
    setSaved(false);
    setSaveFailed(false);
  }, []);

  const handleFile = useCallback((file: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Screenshots must be PNG, JPEG or WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That screenshot is over 4MB. Try cropping it to just the message.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1] ?? "";
      if (!base64) {
        setError("That file could not be read. Try a different screenshot.");
        return;
      }
      setImageData({ base64, mimeType: file.type, preview: result });
    };
    reader.onerror = () => setError("That file could not be read. Try a different screenshot.");
    reader.readAsDataURL(file);
  }, []);

  const analyze = useCallback(async () => {
    setError(null);
    setReport(null);
    setSaved(false);
    setSaveFailed(false);
    setLoading(true);
    startStages();

    const endpoint =
      mode === "MESSAGE" ? "/api/analyze" : mode === "URL" ? "/api/analyze-url" : "/api/analyze-image";

    const payload =
      mode === "MESSAGE"
        ? { text }
        : mode === "URL"
          ? { url }
          : { base64Data: imageData?.base64 ?? "", mimeType: imageData?.mimeType ?? "" };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: { success?: boolean; analysis?: ThreatReport; error?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.success || !data.analysis) {
        // Prefer the server's message — it explains validation and rate limits
        // far better than a generic failure string would.
        setError(data.error ?? "Analysis failed. Please try again in a moment.");
        return;
      }

      setReport(data.analysis);
      // Move focus to the result so keyboard and screen reader users are taken
      // to the thing they just asked for.
      window.requestAnimationFrame(() => {
        resultRef.current?.focus();
        resultRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    } catch {
      setError("Could not reach the analyzer. Check your connection and try again.");
    } finally {
      setLoading(false);
      stopStages();
    }
  }, [mode, text, url, imageData, startStages, stopStages]);

  const handleSave = useCallback(() => {
    if (!report) return;
    const ok = saveReport(report);
    if (ok) {
      setSaved(true);
      setSaveFailed(false);
    } else {
      setSaveFailed(true);
    }
  }, [report]);

  const canSubmit =
    !loading &&
    ((mode === "MESSAGE" && text.trim().length >= 3 && text.length <= MAX_TEXT) ||
      (mode === "URL" && url.trim().length >= 4) ||
      (mode === "SCREENSHOT" && imageData !== null));

  return (
    <>
      <div className={styles.card} style={{ padding: 24 }}>
        <div className={styles.tabs} role="tablist" aria-label="What do you want to check?">
          {(["MESSAGE", "URL", "SCREENSHOT"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
            >
              {m === "MESSAGE" ? "Message" : m === "URL" ? "Link" : "Screenshot"}
            </button>
          ))}
        </div>

        {mode === "MESSAGE" && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="message-input">
              Paste the message you received
            </label>
            <textarea
              id="message-input"
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full message here, including any links..."
              maxLength={MAX_TEXT + 500}
            />
            <div className={styles.metaRow}>
              <span>Nothing is stored unless you choose to save the report.</span>
              <span className={text.length > MAX_TEXT ? styles.countOver : undefined}>
                {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {mode === "URL" && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="url-input">
              Paste the link
            </label>
            <input
              id="url-input"
              type="text"
              inputMode="url"
              className={styles.input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="sbi-secure-login.example/kyc"
            />
            <div className={styles.metaRow}>
              <span>The link is read as text. ScamShield never opens or expands it.</span>
            </div>
          </div>
        )}

        {mode === "SCREENSHOT" && (
          <div className={styles.field}>
            {visionAvailable === false && (
              <p className={`${styles.notice} ${styles.noticeWarn}`} style={{ marginTop: 0 }}>
                Screenshot analysis requires a vision-capable Gemini model, which is not configured
                right now. Paste the message text instead &mdash; it gets the same analysis.
              </p>
            )}

            <div
              className={dragging ? `${styles.drop} ${styles.dropActive}` : styles.drop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              <label className={styles.btnGhost} htmlFor="file-input" style={{ cursor: "pointer" }}>
                Choose a screenshot
              </label>
              <input
                id="file-input"
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <p className={styles.dropHint}>or drag one here &middot; PNG, JPEG or WebP, up to 4MB</p>

              {imageData && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageData.preview} alt="Screenshot preview" className={styles.preview} />
              )}
            </div>
          </div>
        )}

        {error && <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</p>}

        {loading && (
          <div className={styles.stages} aria-live="polite">
            {STAGES.map((label, i) => (
              <div key={label} className={i <= stage ? `${styles.stage} ${styles.stageOn}` : styles.stage}>
                <span className={i === stage ? `${styles.stageDot} ${styles.stageDotOn}` : styles.stageDot} />
                {label}
              </div>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimary} onClick={analyze} disabled={!canSubmit}>
            {loading ? "Analysing…" : "Analyze threat"}
          </button>
          <button type="button" className={styles.btnGhost} onClick={reset} disabled={loading}>
            Clear
          </button>
        </div>

        {mode === "MESSAGE" && !report && (
          <div className={styles.examples}>
            <p className={styles.examplesTitle}>
              Or try a fictional example. These are made up, and the domains cannot resolve.
            </p>
            <div className={styles.exampleRow}>
              {EXAMPLES.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  className={styles.exampleBtn}
                  onClick={() => {
                    setText(example.text);
                    setError(null);
                  }}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div ref={resultRef} tabIndex={-1} style={{ outline: "none" }}>
        {report && (
          <div style={{ marginTop: 40 }}>
            <ReportView report={report} onSave={handleSave} saved={saved} />
            {saveFailed && (
              <p className={`${styles.notice} ${styles.noticeWarn}`}>
                This report could not be saved. Your browser may be blocking storage, or private
                browsing may be on.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default Analyzer;
