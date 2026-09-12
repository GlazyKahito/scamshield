 "use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { ThreatReport } from "../../types/analysis";

const demo = `URGENT: Your SBI account will be blocked today.
Complete KYC immediately at:
https://sbi-secure-login.example`;

export default function AnalyzePage() {
  const [mode, setMode] = useState<"message" | "url">("message");
  const [input, setInput] = useState("");
  const [report, setReport] = useState<ThreatReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "url" ? "/api/analyze-url" : "/api/analyze";
      const body = mode === "url" ? { url: input.trim() } : { text: input.trim() };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Analysis failed.");
      setReport(data.analysis);
      const old = JSON.parse(localStorage.getItem("scamshield_history") || "[]");
      localStorage.setItem("scamshield_history", JSON.stringify([data.analysis, ...old].slice(0, 25)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <div className="shell">
        <header className="header">
          <Link href="/" className="logo">Scam<span>Shield</span></Link>
          <nav><Link href="/analyze">Analyze</Link><Link href="/simulator">Simulator</Link><Link href="/scams">Scam Library</Link><Link href="/dashboard">Dashboard</Link></nav>
        </header>

        <section className="hero">
          <div className="eyebrow">SCAM ANALYZER</div>
          <h1>Show me what looks suspicious.</h1>
          <p>Paste a suspicious message or URL. ScamShield combines deterministic security checks with Gemini analysis when available.</p>
        </section>

        <div className="tabs">
          <button className={mode === "message" ? "active" : ""} onClick={() => setMode("message")}>Message</button>
          <button className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>URL</button>
        </div>

        <form className="card" onSubmit={submit}>
          <textarea
            rows={8}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "message" ? "Paste an SMS, WhatsApp message, email, or social DM..." : "https://example.com/login"}
          />
          <div className="row">
            <button type="button" className="secondary" onClick={() => setInput(demo)}>Load demo</button>
            <button className="primary" disabled={loading || !input.trim()}>{loading ? "Analyzing..." : "Analyze →"}</button>
          </div>
          <small>Submitted URLs are parsed as strings. ScamShield never visits them.</small>
        </form>

        {error && <div className="error">{error}</div>}
        {report && <Report report={report} />}
      </div>
    </main>
  );
}

function Report({ report }: { report: ThreatReport }) {
  const color = report.riskScore >= 75 ? "#fb7185" : report.riskScore >= 50 ? "#f97316" : report.riskScore >= 25 ? "#fbbf24" : "#4ade80";
  return (
    <section className="results">
      <div className="resultTop">
        <div><div className="eyebrow">THREAT REPORT</div><h2>{report.classification.replaceAll("_", " ")}</h2><p>{report.summary}</p></div>
        <div className="score" style={{ borderColor: color }}><strong>{report.riskScore}</strong><span>/100</span><b style={{ color }}>{report.severity}</b></div>
      </div>

      <div className="meta">Confidence: {Math.round(report.confidence * 100)}% · {report.analysisMode === "HYBRID" ? "Hybrid + Gemini" : "Rule-based fallback"}</div>

      <div className="columns">
        <div className="panel"><h3>Why it is risky</h3>
          {report.signals.length === 0 ? <p>No strong signals detected.</p> : report.signals.map((s, i) => (
            <article className="signal" key={i}><strong>{s.name}</strong><em>{s.source}</em><p>{s.explanation}</p>{s.evidence && <code>{s.evidence}</code>}</article>
          ))}
        </div>
        <div className="panel"><h3>Attack path</h3>
          {report.attackChain.map((s) => <div className="step" key={s.step}><b>{s.step}</b><div><strong>{s.title}</strong><p>{s.description}</p></div></div>)}
        </div>
      </div>

      <div className="panel"><h3>What to do next</h3>
        {report.recommendedActions.map((a, i) => <div className={a.type === "DO" ? "action do" : "action dont"} key={i}><b>{a.type === "DO" ? "DO" : "DON'T"}</b>{a.text}</div>)}
        <div className="tip"><b>Security tip:</b> {report.educationalTip}</div>
      </div>
    </section>
  );
}
