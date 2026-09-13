"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ClipboardPaste, ImageUp, Link2, MessageSquareText, X } from "lucide-react";
import type { ThreatReport } from "../../types/analysis";
import { saveReport } from "../../lib/storage/history";
import { takeAnalyzerDraft } from "../../lib/storage/draft";
import { MESSAGE_EXAMPLES, URL_EXAMPLES } from "../../lib/content/examples";
import { ReportView } from "../report/report-view";
import {
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LABEL,
  formatBytes,
} from "../../lib/validation/limits";
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
const REQUEST_TIMEOUT_MS = 60_000;
const ACCEPTED_TYPES: readonly string[] = ACCEPTED_IMAGE_TYPES;

const MODES: { id: Mode; label: string; Icon: typeof MessageSquareText }[] = [
  { id: "MESSAGE", label: "Text", Icon: MessageSquareText },
  { id: "URL", label: "URL", Icon: Link2 },
  { id: "SCREENSHOT", label: "Image", Icon: ImageUp },
];

/**
 * Progress stages.
 *
 * These name real steps in the server pipeline. We advance through them on a
 * timer because the server returns one response, so this is presentation — the
 * last stage holds until the real response lands.
 */
const STAGES = [
  "Extracting text and links",
  "Running pattern checks",
  "Analysing intent with AI",
  "Building your report",
];


export function Analyzer() {
  const baseId = useId();
  const [mode, setMode] = useState<Mode>("MESSAGE");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [imageData, setImageData] = useState<
    { base64: string; mimeType: string; preview: string; name: string; size: number } | null
  >(null);
  const [dragging, setDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ThreatReport | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [visionAvailable, setVisionAvailable] = useState<boolean | null>(null);
  const [canPaste, setCanPaste] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ MESSAGE: null, URL: null, SCREENSHOT: null });
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

  // Pick up a draft handed over from the landing demo or scam library.
  useEffect(() => {
    setCanPaste(typeof navigator !== "undefined" && Boolean(navigator.clipboard?.readText));
    const draft = takeAnalyzerDraft();
    if (!draft) return;
    if (draft.mode === "URL") {
      setMode("URL");
      setUrl(draft.value);
    } else {
      setMode("MESSAGE");
      setText(draft.value);
    }
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      abortRef.current?.abort();
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, []);

  const startStages = useCallback(() => {
    setStage(0);
    if (stageTimer.current) clearInterval(stageTimer.current);
    stageTimer.current = setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, 900);
  }, []);

  const stopStages = useCallback(() => {
    if (stageTimer.current) {
      clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  }, []);

  const clearInput = useCallback(() => {
    setText("");
    setUrl("");
    setImageData(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    clearInput();
    setReport(null);
    setSaved(false);
    setSaveFailed(false);
  }, [clearInput]);

  const handleFile = useCallback((file: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`Screenshots must be ${ACCEPTED_IMAGE_LABEL}.`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        `That screenshot is ${formatBytes(file.size)} — the limit is ${MAX_IMAGE_LABEL}. Crop it to just the message, or take a smaller screenshot.`,
      );
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
      setImageData({ base64, mimeType: file.type, preview: result, name: file.name || "Pasted image", size: file.size });
    };
    reader.onerror = () => setError("That file could not be read. Try a different screenshot.");
    reader.readAsDataURL(file);
  }, []);

  // In image mode, a pasted image (Ctrl/Cmd+V) is accepted anywhere on the page.
  useEffect(() => {
    if (mode !== "SCREENSHOT") return;
    const onPaste = (event: ClipboardEvent) => {
      // Swapping the image mid-analysis would show a preview that doesn't match the report.
      if (loading) return;
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        event.preventDefault();
        handleFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [mode, handleFile, loading]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (!value) {
        setError("Your clipboard is empty.");
        return;
      }
      setError(null);
      if (mode === "URL") setUrl(value.trim());
      else setText(value.slice(0, MAX_TEXT + 500));
      inputRef.current?.focus();
    } catch {
      setError("Clipboard access was blocked. Paste with Ctrl+V (or ⌘V) instead.");
    }
  }, [mode]);

  const canSubmit =
    !loading &&
    ((mode === "MESSAGE" && text.trim().length >= 3 && text.length <= MAX_TEXT) ||
      (mode === "URL" && url.trim().length >= 4) ||
      (mode === "SCREENSHOT" && imageData !== null));

  const analyze = useCallback(async () => {
    if (!canSubmit) return;
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

    // A stalled request must not leave the console locked with no way out.
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data: { success?: boolean; analysis?: ThreatReport; error?: string } = await response
        .json()
        .catch(() => ({}));
      if (unmountedRef.current) return;

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
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        resultRef.current?.focus({ preventScroll: true });
        resultRef.current?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
      });
    } catch {
      if (unmountedRef.current) return;
      setError(
        controller.signal.aborted
          ? "The analysis took too long to respond. Please try again."
          : "Could not reach the analyzer. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timeout);
      stopStages();
      if (!unmountedRef.current) setLoading(false);
    }
  }, [canSubmit, mode, text, url, imageData, startStages, stopStages]);

  const handleSave = useCallback(() => {
    if (!report) return;
    const ok = saveReport(report);
    setSaved(ok);
    setSaveFailed(!ok);
  }, [report]);

  const analyzeAnother = useCallback(() => {
    reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
  }, [reset]);

  const selectMode = useCallback((next: Mode, focusTab = false) => {
    setMode(next);
    setError(null);
    if (focusTab) tabRefs.current[next]?.focus();
  }, []);

  // WAI-ARIA tabs: arrow keys move between tabs, Home/End jump to the ends.
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = MODES.findIndex((m) => m.id === mode);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % MODES.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + MODES.length) % MODES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = MODES.length - 1;
    if (next >= 0) {
      event.preventDefault();
      selectMode(MODES[next].id, true);
    }
  };

  // Ctrl/Cmd + Enter submits from anywhere inside the console.
  const onConsoleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void analyze();
    }
  };

  const statusLabel = loading ? "SCANNING" : report ? "COMPLETE" : canSubmit ? "READY" : "AWAITING INPUT";
  const panelId = `${baseId}-panel`;
  const tabId = (m: Mode) => `${baseId}-tab-${m}`;
  const inputEmpty = mode === "MESSAGE" ? text.length === 0 : mode === "URL" ? url.length === 0 : imageData === null;

  return (
    <>
      <div
        className={loading ? `${styles.console} ${styles.consoleBusy}` : styles.console}
        onKeyDown={onConsoleKeyDown}
      >
        <div className={styles.consoleBar}>
          <div className={styles.tabs} role="tablist" aria-label="What do you want to check?">
            {MODES.map(({ id, label, Icon }) => {
              const selected = mode === id;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    tabRefs.current[id] = el;
                  }}
                  id={tabId(id)}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  className={selected ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                  onClick={() => selectMode(id)}
                  onKeyDown={onTabKeyDown}
                  disabled={loading}
                >
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>

          <span className={styles.consoleStatus} aria-live="polite">
            <span
              className={
                loading
                  ? `${styles.statusDot} ${styles.statusDotBusy}`
                  : canSubmit || report
                    ? styles.statusDot
                    : `${styles.statusDot} ${styles.statusDotIdle}`
              }
              aria-hidden="true"
            />
            {statusLabel}
          </span>
        </div>

        <div id={panelId} role="tabpanel" aria-labelledby={tabId(mode)} className={styles.consoleBody}>
          {loading && <div className={styles.consoleScan} aria-hidden="true" />}

          {mode === "MESSAGE" && (
            <>
              <label className={styles.consoleLabel} htmlFor="message-input">
                PASTE THE MESSAGE YOU RECEIVED
              </label>
              <textarea
                id="message-input"
                ref={(el) => {
                  inputRef.current = el;
                }}
                className={styles.consoleTextarea}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. “URGENT: Your account will be blocked today. Verify at…”"
                maxLength={MAX_TEXT + 500}
                readOnly={loading}
                aria-describedby="message-meta"
              />
              <div className={styles.consoleMeta} id="message-meta">
                <span>Include any links &mdash; they are read as text, never opened.</span>
                <span className={`${styles.metaMono} ${text.length > MAX_TEXT ? styles.countOver : ""}`}>
                  {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
                </span>
              </div>
            </>
          )}

          {mode === "URL" && (
            <>
              <label className={styles.consoleLabel} htmlFor="url-input">
                PASTE THE LINK
              </label>
              <input
                id="url-input"
                ref={(el) => {
                  inputRef.current = el;
                }}
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className={styles.consoleInput}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    void analyze();
                  }
                }}
                placeholder="sbi-secure-login.example/kyc"
                readOnly={loading}
                aria-describedby="url-meta"
              />
              <div className={styles.consoleMeta} id="url-meta">
                <span>ScamShield parses the address. It never opens, resolves or expands it.</span>
              </div>
            </>
          )}

          {mode === "SCREENSHOT" && (
            <>
              {visionAvailable === false && (
                <p className={`${styles.notice} ${styles.noticeWarn}`} style={{ margin: "14px 14px 0" }}>
                  <span className={styles.noticeIcon} aria-hidden="true">!</span>
                  <span>
                    Screenshot analysis needs a vision-capable Gemini model, which isn&rsquo;t
                    configured right now. Paste the message as text instead &mdash; it gets the same
                    analysis.
                  </span>
                </p>
              )}

              {imageData ? (
                <div className={styles.previewWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageData.preview} alt="Preview of the screenshot to analyze" className={styles.preview} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className={styles.previewName}>{imageData.name}</p>
                    <p className={styles.previewMeta}>
                      {imageData.mimeType.replace("image/", "").toUpperCase()} &middot; {formatBytes(imageData.size)} of{" "}
                      {MAX_IMAGE_LABEL} max
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => setImageData(null)}
                    aria-label="Remove screenshot"
                    disabled={loading}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div
                  className={[
                    styles.drop,
                    dragging ? styles.dropActive : "",
                    visionAvailable === false ? styles.dropDisabled : "",
                  ].join(" ")}
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
                  <ImageUp size={28} className={styles.dropIcon} aria-hidden="true" />
                  <p className={styles.dropTitle}>Drop a screenshot here</p>
                  <p className={styles.dropHint}>or paste one with Ctrl+V</p>
                  <dl className={styles.dropSpecs} aria-label="Upload requirements">
                    <div>
                      <dt>FORMAT</dt>
                      <dd>{ACCEPTED_IMAGE_LABEL}</dd>
                    </div>
                    <div>
                      <dt>MAX SIZE</dt>
                      <dd>{MAX_IMAGE_LABEL}</dd>
                    </div>
                  </dl>
                  <label className={`${styles.btnGhost} ${styles.btnSm}`} htmlFor="file-input">
                    Choose a file
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.consoleFoot}>
          <div className={styles.consoleFootLeft}>
            {mode !== "SCREENSHOT" && canPaste && (
              <button type="button" className={styles.btnQuiet} onClick={pasteFromClipboard} disabled={loading}>
                <ClipboardPaste size={15} aria-hidden="true" />
                Paste
              </button>
            )}
            <button type="button" className={styles.btnQuiet} onClick={clearInput} disabled={loading || inputEmpty}>
              Clear
            </button>
          </div>

          <div className={styles.consoleFootRight}>
            <span className={styles.shortcutHint} aria-hidden="true">
              <kbd className={styles.kbd}>Ctrl</kbd>+<kbd className={styles.kbd}>Enter</kbd>
            </span>
            <button type="button" className={styles.btnPrimary} onClick={analyze} disabled={!canSubmit}>
              {loading ? "Analyzing…" : "Analyze threat"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
          <span className={styles.noticeIcon} aria-hidden="true">&times;</span>
          <span>{error}</span>
        </p>
      )}

      {loading && (
        <div className={styles.progress} role="status" aria-live="polite">
          <div className={styles.progressTop}>
            <span>ANALYSIS IN PROGRESS</span>
            <span>
              {stage + 1}/{STAGES.length}
            </span>
          </div>
          <div className={styles.progressBar} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${((stage + 1) / (STAGES.length + 0.6)) * 100}%` }} />
          </div>
          <ol className={styles.stages}>
            {STAGES.map((label, i) => {
              const done = i < stage;
              const on = i === stage;
              return (
                <li
                  key={label}
                  className={`${styles.stage} ${on ? styles.stageOn : ""} ${done ? styles.stageDone : ""}`}
                >
                  <span
                    className={`${styles.stageMark} ${on ? styles.stageMarkOn : ""} ${done ? styles.stageMarkDone : ""}`}
                    aria-hidden="true"
                  >
                    {done ? "✓" : ""}
                  </span>
                  {label}
                  {done && <span className="sr-only"> (done)</span>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {!report && !loading && (
        <>
          {mode !== "SCREENSHOT" && (
            <div className={styles.examples}>
              <p className={styles.examplesTitle}>
                No message handy? Try a fictional example &mdash; the domains cannot resolve.
              </p>
              <div className={styles.chipRow}>
                {(mode === "MESSAGE" ? MESSAGE_EXAMPLES : URL_EXAMPLES).map((example) => (
                  <button
                    key={example.id}
                    type="button"
                    className={styles.chip}
                    onClick={() => {
                      if (mode === "URL") setUrl(example.text);
                      else setText(example.text);
                      setError(null);
                      inputRef.current?.focus();
                    }}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.expect} data-reveal-stagger>
            <div className={styles.expectItem}>
              <span className={styles.expectNum}>01 &middot; SCORE</span>
              <p className={styles.expectName}>A risk score out of 100</p>
              <p className={styles.expectText}>Pattern checks and AI, combined into one number you can audit.</p>
            </div>
            <div className={styles.expectItem}>
              <span className={styles.expectNum}>02 &middot; EVIDENCE</span>
              <p className={styles.expectName}>Why it was flagged</p>
              <p className={styles.expectText}>The exact phrases and link details that raised each signal.</p>
            </div>
            <div className={styles.expectItem}>
              <span className={styles.expectNum}>03 &middot; ACTION</span>
              <p className={styles.expectName}>What to do next</p>
              <p className={styles.expectText}>Specific steps for this kind of scam, not a generic warning.</p>
            </div>
          </div>
        </>
      )}

      <div ref={resultRef} tabIndex={-1} style={{ outline: "none", scrollMarginTop: 88 }}>
        {report && (
          <div style={{ marginTop: 40 }}>
            <ReportView report={report} onSave={handleSave} saved={saved} onAnalyzeAnother={analyzeAnother} />
            {saveFailed && (
              <p className={`${styles.notice} ${styles.noticeWarn}`}>
                <span className={styles.noticeIcon} aria-hidden="true">!</span>
                <span>
                  This report could not be saved. Your browser may be blocking storage, or private
                  browsing may be on.
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default Analyzer;
