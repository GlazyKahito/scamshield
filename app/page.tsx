import Link from "next/link";

const features = [
  {
    title: "Evidence, not guesses",
    text: "Combines security rules with AI analysis to explain why something looks dangerous.",
  },
  {
    title: "See the attack path",
    text: "Understand how a message can lead from a click to credential or payment theft.",
  },
  {
    title: "Know what to do",
    text: "Get practical next steps such as verifying through official channels and avoiding OTP sharing.",
  },
];

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#07090d", color: "#fff" }}>
      <div
        style={{
          maxWidth: 1152,
          minHeight: "100vh",
          margin: "0 auto",
          padding: "32px 24px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 24,
            borderBottom: "1px solid rgba(255,255,255,.1)",
          }}
        >
          <Link
            href="/"
            style={{
              color: "#fff",
              textDecoration: "none",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-.5px",
            }}
          >
            Scam<span style={{ color: "#22d3ee" }}>Shield</span>
          </Link>

          <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
            <NavLink href="/analyze">Analyze</NavLink>
            <NavLink href="/simulator">Simulator</NavLink>
            <NavLink href="/scams">Scam Library</NavLink>
            <NavLink href="/dashboard">Dashboard</NavLink>
          </div>
        </nav>

        <section
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "80px 0",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "9px 16px",
              borderRadius: 999,
              border: "1px solid rgba(34,211,238,.2)",
              background: "rgba(34,211,238,.08)",
              color: "#67e8f9",
              fontSize: 14,
              marginBottom: 24,
            }}
          >
            AI-powered scam & phishing detection
          </div>

          <h1
            style={{
              maxWidth: 850,
              margin: 0,
              fontSize: "clamp(48px, 8vw, 78px)",
              lineHeight: 1.02,
              letterSpacing: "-3px",
              fontWeight: 900,
            }}
          >
            Think it&apos;s a scam?
            <br />
            <span style={{ color: "#22d3ee" }}>Let&apos;s prove it.</span>
          </h1>

          <p
            style={{
              maxWidth: 680,
              margin: "28px auto 0",
              color: "rgba(255,255,255,.62)",
              fontSize: 18,
              lineHeight: 1.7,
            }}
          >
            Paste a suspicious message or URL and ScamShield explains the risk,
            shows the attack path, identifies warning signs, and tells you what
            to do next.
          </p>

          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 40,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Link
              href="/analyze"
              style={{
                display: "inline-block",
                padding: "15px 28px",
                borderRadius: 12,
                background: "#22d3ee",
                color: "#041014",
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Analyze a Scam →
            </Link>

            <Link
              href="/simulator"
              style={{
                display: "inline-block",
                padding: "15px 28px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.15)",
                background: "rgba(255,255,255,.05)",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Try the Simulator
            </Link>
          </div>

          <div
            style={{
              width: "100%",
              maxWidth: 900,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginTop: 80,
              textAlign: "left",
            }}
          >
            {features.map((feature) => (
              <div
                key={feature.title}
                style={{
                  padding: 24,
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,.1)",
                  background: "rgba(255,255,255,.03)",
                }}
              >
                <h2 style={{ margin: 0, fontSize: 17 }}>{feature.title}</h2>
                <p
                  style={{
                    margin: "10px 0 0",
                    color: "rgba(255,255,255,.5)",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {feature.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer
          style={{
            borderTop: "1px solid rgba(255,255,255,.1)",
            paddingTop: 24,
            textAlign: "center",
            color: "rgba(255,255,255,.4)",
            fontSize: 13,
          }}
        >
          ScamShield • Stay skeptical. Stay safe.
        </footer>
      </div>
    </main>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        color: "rgba(255,255,255,.6)",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
