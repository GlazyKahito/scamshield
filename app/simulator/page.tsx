"use client";
import Link from "next/link";
import { useState } from "react";

const scenarios = [
  { title:"Banking / KYC", text:"Your account will be blocked today. Complete KYC using this link and enter your OTP.", answers:["Click the link now","Open the official banking app yourself","Send the OTP to support"], correct:1 },
  { title:"Fake internship", text:"Congratulations! You are selected for a ₹60,000/month internship. Pay ₹1,999 registration fee to confirm.", answers:["Pay the fee","Ask for a payment receipt and pay","Verify the company independently and never pay upfront"], correct:2 },
  { title:"Delivery scam", text:"Your parcel is held. Pay ₹35 customs fee through this shortened link.", answers:["Pay immediately","Use the courier's official app/site to check the parcel","Share your card OTP"], correct:1 },
];

export default function SimulatorPage(){
 const [i,setI]=useState(0); const [picked,setPicked]=useState<number|null>(null);
 const s=scenarios[i];
 function choose(n:number){ if(picked!==null)return; setPicked(n); }
 function next(){setPicked(null);setI((i+1)%scenarios.length);}
 return <main className="app"><div className="shell">
 <header className="header"><Link href="/" className="logo">Scam<span>Shield</span></Link><nav><Link href="/analyze">Analyze</Link><Link href="/simulator">Simulator</Link><Link href="/scams">Scam Library</Link><Link href="/dashboard">Dashboard</Link></nav></header>
 <section className="hero"><div className="eyebrow">SCAM SIMULATOR</div><h1>Train your scam instincts.</h1><p>Choose the safest response. The goal is to recognize pressure, payment requests, impersonation, and suspicious links.</p></section>
 <div className="panel"><div className="eyebrow">SCENARIO {i+1} / {scenarios.length}</div><h2>{s.title}</h2><p style={{fontSize:18,lineHeight:1.7}}>{s.text}</p>
 {s.answers.map((a,n)=><button key={n} onClick={()=>choose(n)} style={{display:"block",width:"100%",textAlign:"left",padding:16,margin:"10px 0",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:picked===null?"rgba(255,255,255,.04)":n===s.correct?"rgba(74,222,128,.15)":n===picked?"rgba(251,113,133,.15)":"rgba(255,255,255,.03)",color:"#fff",cursor:picked===null?"pointer":"default"}}>{a}</button>)}
 {picked!==null && <div className="tip"><b>{picked===s.correct?"Correct.":"Not quite."}</b> {picked===s.correct?"Good call — verify through a trusted channel and do not surrender credentials or money.":"The safest option is to slow down and verify independently before clicking, paying, or sharing sensitive information."}</div>}
 {picked!==null && <button className="primary" style={{marginTop:14}} onClick={next}>Next scenario →</button>}
 </div></div></main>
}
