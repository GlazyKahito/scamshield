import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Scam<span className="text-cyan-400">Shield</span>
          </Link>

          <div className="hidden items-center gap-6 text-sm text-white/60 sm:flex">
            <Link href="/analyze" className="transition hover:text-white">
              Analyze
            </Link>
            <Link href="/simulator" className="transition hover:text-white">
              Simulator
            </Link>
            <Link href="/scams" className="transition hover:text-white">
              Scam Library
            </Link>
            <Link href="/dashboard" className="transition hover:text-white">
              Dashboard
            </Link>
          </div>
        </nav>

        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300">
            AI-powered scam & phishing detection
          </div>

          <h1 className="max-w-4xl text-5xl font-black tracking-tight sm:text-7xl">
            Think it&apos;s a scam?
            <br />
            <span className="text-cyan-400">Let&apos;s prove it.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/60">
            Paste a suspicious message or URL and ScamShield explains the risk,
            shows the attack path, identifies warning signs, and tells you what
            to do next.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/analyze"
              className="rounded-xl bg-cyan-400 px-7 py-4 font-bold text-black transition hover:bg-cyan-300"
            >
              Analyze a Scam →
            </Link>

            <Link
              href="/simulator"
              className="rounded-xl border border-white/15 bg-white/5 px-7 py-4 font-semibold transition hover:bg-white/10"
            >
              Try the Simulator
            </Link>
          </div>

          <div className="mt-20 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
            <Feature
              title="Evidence, not guesses"
              text="Combines security rules with AI analysis to explain why something looks dangerous."
            />
            <Feature
              title="See the attack path"
              text="Understand how a message can lead from a click to credential or payment theft."
            />
            <Feature
              title="Know what to do"
              text="Get practical next steps such as verifying through official channels and avoiding OTP sharing."
            />
          </div>
        </div>

        <footer className="border-t border-white/10 pt-6 text-center text-sm text-white/40">
          ScamShield • Stay skeptical. Stay safe.
        </footer>
      </section>
    </main>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/50">{text}</p>
    </div>
  );
}
