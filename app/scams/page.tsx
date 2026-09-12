import Link from "next/link";
const scams = [
 ["Banking & KYC","Urgent account-blocking messages, fake KYC pages, and OTP requests."],
 ["Job scams","Fake recruiters, unrealistic salaries, and registration or training fees."],
 ["UPI & payment","QR-code tricks, collect-request scams, refund scams, and fake support."],
 ["Delivery scams","Parcel-fee messages and fake courier tracking pages."],
 ["Investment scams","Guaranteed returns, fake trading platforms, and pressure to deposit."],
 ["Impersonation","Attackers pretending to be banks, employers, police, friends, or support staff."],
];
export default function ScamsPage(){return <main className="app"><div className="shell"><header className="header"><Link href="/" className="logo">Scam<span>Shield</span></Link><nav><Link href="/analyze">Analyze</Link><Link href="/simulator">Simulator</Link><Link href="/scams">Scam Library</Link><Link href="/dashboard">Dashboard</Link></nav></header><section className="hero"><div className="eyebrow">SCAM LIBRARY</div><h1>Know the patterns.</h1><p>Common scam families and the warning signs that show up again and again.</p></section><div className="columns">{scams.map(([title,text])=><article className="panel" key={title}><div className="eyebrow">{title.toUpperCase()}</div><p style={{lineHeight:1.7,color:"#aaa"}}>{text}</p><Link href="/analyze" style={{color:"#22d3ee"}}>Analyze an example →</Link></article>)}</div></div></main>}
