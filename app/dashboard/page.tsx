"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ThreatReport } from "../../types/analysis";

export default function DashboardPage() {
  const [items, setItems] = useState<ThreatReport[]>([]);
  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem("scamshield_history") || "[]")); } catch {}
  }, []);
  const critical = items.filter(x => x.riskScore >= 75).length;
  const high = items.filter(x => x.riskScore >= 50 && x.riskScore < 75).length;
  return <main className="app"><div className="shell">
    <header className="header"><Link href="/" className="logo">Scam<span>Shield</span></Link><nav><Link href="/analyze">Analyze</Link><Link href="/simulator">Simulator</Link><Link href="/scams">Scam Library</Link><Link href="/dashboard">Dashboard</Link></nav></header>
    <section className="hero"><div className="eyebrow">DASHBOARD</div><h1>Your security history.</h1><p>Recent analyses are stored locally in this browser. Nothing is sent to a database by the MVP.</p></section>
    <div className="columns">
      <div className="panel"><h3>Analyses</h3><strong style={{fontSize:36}}>{items.length}</strong></div>
      <div className="panel"><h3>High risk</h3><strong style={{fontSize:36,color:"#fb7185"}}>{high + critical}</strong></div>
      <div className="panel"><h3>Critical</h3><strong style={{fontSize:36,color:"#fb7185"}}>{critical}</strong></div>
    </div>
    <div className="panel"><h3>Recent reports</h3>{items.length === 0 ? <p>No analyses yet. <Link href="/analyze" style={{color:"#22d3ee"}}>Run your first analysis →</Link></p> : items.map((x,i)=><div className="signal" key={i}><strong>{x.title}</strong><span style={{float:"right",color:x.riskScore>=50?"#fb7185":"#4ade80"}}>{x.riskScore}/100</span><p>{x.classification.replaceAll("_"," ")} · {new Date(x.createdAt).toLocaleString()}</p></div>)}</div>
  </div></main>;
}
