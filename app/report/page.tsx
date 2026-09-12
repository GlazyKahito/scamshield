"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ReportPage(){
 const [report,setReport]=useState<any>(null);
 useEffect(()=>{try{const raw=sessionStorage.getItem("scamshield_report"); if(raw)setReport(JSON.parse(raw));}catch{}},[]);
 return <main className="app"><div className="shell"><header className="header"><Link href="/" className="logo">Scam<span>Shield</span></Link><nav><Link href="/analyze">Analyze</Link><Link href="/dashboard">Dashboard</Link></nav></header><section className="hero"><div className="eyebrow">SAVED REPORT</div><h1>Analysis report.</h1>{report?<div className="panel"><h2>{report.classification?.replaceAll("_"," ")}</h2><p>{report.summary}</p><p><b>Risk score:</b> {report.riskScore}/100 · <b>Severity:</b> {report.severity}</p></div>:<div className="panel"><p>No active report is saved in this browser yet.</p><Link href="/analyze" style={{color:"#22d3ee"}}>Run an analysis →</Link></div>}</section></div></main>
}
