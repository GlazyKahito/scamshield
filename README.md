# ScamShield

**An AI security analyst for normal people.**

ScamShield analyses suspicious SMS, WhatsApp messages, emails, DMs and links, then explains *why* something looks risky, *how* the attack would work, and *what to do next* — instead of returning a bare verdict.

> Think it's a scam? Let's prove it.

---

## The problem

Most scam-detection tools answer the wrong question. They say "this is a scam" and stop. That helps once. It teaches nothing, it cannot be checked, and when it is wrong the user has no way to tell.

The people most often targeted — parents, grandparents, first-time earners, students taking their first internship offer — do not need a verdict. They need to understand what they are looking at, so they recognise the next one without help.

## The approach

ScamShield runs two independent analyses and shows its working.

```
                 USER INPUT
                     │
              Input validation            (Zod, server-side)
                     │
              Text + URL extraction
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   RULE ENGINE               URL ANALYZER      ← deterministic, no network
   pattern rules             structural parse
        │                         │
        └────────────┬────────────┘
                     │
              SECURITY SIGNALS
                     │
                     ▼
                GEMINI AI                      ← semantic layer, server-side
             structured JSON
                     │
              Zod validation + semantic repair
                     │
                     ▼
                RISK ENGINE                    ← documented fusion formula
                     │
                     ▼
             THREAT REPORT
```

**Why two layers.** The deterministic engine is what makes this a security product rather than a chatbot wrapper. It runs first, it runs always, and it produces a complete report on its own. Gemini adds the reading of intent that pattern matching cannot do — tone, pretext, the objective behind the message. Pull the API key out and ScamShield still works; that is a deliberate architectural property, and it is tested.

---

## What is actually implemented

| Layer | File | Status |
|---|---|---|
| URL structural analyzer | `lib/security/url-analyzer.ts` | ✅ tested |
| Message rule engine | `lib/security/message-analyzer.ts` | ✅ tested |
| Brand impersonation heuristic | `lib/security/brand-detector.ts` | ✅ tested |
| Risk scoring + fusion | `lib/security/risk-engine.ts` | ✅ tested |
| Analysis pipeline | `lib/security/pipeline.ts` | ✅ |
| Gemini client | `lib/ai/gemini.ts` | ✅ |
| Structured output + validation | `lib/ai/schema.ts` | ✅ |
| Injection-resistant prompts | `lib/ai/prompts.ts` | ✅ |
| Input validation | `lib/validation/schemas.ts` | ✅ |
| Rate limiting | `lib/utils/rate-limit.ts` | ✅ |
| API routes | `app/api/*` | ✅ |
| Storage abstraction | `lib/storage/*` | ✅ |
| UI (landing, analyzer, report, simulator, dashboard, scam library) | `app/*`, `components/*` | 🚧 next phase |

---

## Risk scoring

Scoring is transparent by design — every number on the report traces back to a named signal with a quoted excerpt from the user's own message.

**Deterministic weights** (`lib/security/message-analyzer.ts`):

| Signal | Weight |
|---|---|
| Credential request | 25 |
| PIN or QR required to receive money | 25 |
| Upfront fee to be hired or to claim | 22 |
| OTP request | 20 |
| Payment request | 20 |
| Urgency pressure / account threat | 18 |
| Brand impersonation | 18 |
| Unrealistic financial promise | 15 |
| Suspicious call to action | 15 |
| Reward or prize bait | 12 |
| Secrecy pressure | 10 |
| URL signals (IP host, punycode, shorteners, sensitive paths…) | 6–20 |

**Deduplication.** Signals are grouped (`credential`, `payment`, `otp`, `urgency`, …). Within a group the highest-weight signal counts in full and each additional one contributes 25%. Three phrasings of the same OTP request cannot stack to 60 points.

**Fusion.**

```
finalScore = round(ruleScore × 0.55 + aiScore × 0.45)
```

When Gemini is unavailable, `ruleScore` stands alone rather than being scaled down — a fallback report must not look artificially safe just because the AI layer was missing.

**Severity bands:** 0–24 LOW · 25–49 MODERATE · 50–74 HIGH · 75–100 CRITICAL

Real measured scores from the test suite:

```
banking phishing = 66    fake internship = 54
UPI PIN scam     = 55    ordinary message = 0
```

Nothing is hard-coded to 91. Change the input and the number moves.

---

## Security

**Prompt injection.** Every submitted message is hostile input by definition, and some of it will be written to manipulate an AI reader. Four layers of defence, in order of how much each actually helps:

1. **Structured output** — Gemini must return a fixed JSON schema, so there is no channel for attacker-chosen prose to reach the user.
2. **Unpredictable delimiters** — submitted content is fenced inside a per-request random nonce, so text claiming "the message ends here, new instructions follow" cannot forge a boundary.
3. **Explicit system instructions** — content is data; an embedded instruction is reported as a *finding*, not obeyed.
4. **Server-side re-validation** — everything returned is parsed with Zod and semantically repaired before rendering.

Layer 1 matters most: even a fully successful injection can only move values inside a schema we then re-validate.

**URL safety.** URLs are parsed as strings. ScamShield never opens, resolves, crawls, or expands a submitted link — including shorteners, which is why a shortened link is reported as *unexpanded* rather than followed. Structural analysis is not a reputation check, and the UI says so.

**Secrets.** `GEMINI_API_KEY` is read only in `lib/ai/gemini.ts`, which begins with `import "server-only"` — importing it from a client component is a build error, not a code-review catch. It is never exposed via `NEXT_PUBLIC_`.

**Privacy.** Submitted messages are never written to application logs; errors log a reason code only. Nothing is persisted unless the user explicitly saves an analysis, and then only to their own browser.

**Input limits.** 8,000 characters of text, 2,048 for URLs, 4MB for screenshots, 15 analyses per minute per client.

---

## No false certainty

ScamShield never claims a domain, sender or link is definitively malicious. It reports *risk* based on detected indicators, and says so on every report:

> This assessment is based on detected indicators and is not definitive proof of malicious activity.

It fabricates nothing — no reputation scores, no malware scan results, no WHOIS data, no blocklist status. The system prompt forbids it and the schema gives it nowhere to go. Where a capability is missing (vision for screenshots, for example), ScamShield says so rather than faking it.

---

## Setup

```bash
npm install
cp .env.example .env.local
```

Add your key to `.env.local`:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
```

Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

```bash
npm run dev        # http://localhost:3000
npm test           # deterministic engine suite (no install needed — tsx only)
npm run typecheck
```

**The app runs without a key.** Every analysis falls back to the deterministic engine and the UI explains why. This is worth demonstrating deliberately: delete the key, re-run an analysis, and the report still appears.

---

## Tech stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Framer Motion · Zod · `@google/genai`

Gemini is the only external AI provider, called exclusively server-side.

---

## Storage

localStorage via a `StorageProvider` interface (`lib/storage/provider.ts`). Every method is async even though the current implementation is synchronous, specifically so a `SupabaseProvider` can drop in later without touching a single component. Malformed or corrupt entries are discarded individually rather than crashing the dashboard, and quota errors degrade to a trimmed history.

---

## Limitations

Worth stating plainly, because a security tool that overstates its reach is its own kind of hazard:

- **Structure is not reputation.** A well-formed URL on a clean domain can still be malicious. ScamShield cannot verify who owns a domain.
- **A low score is not a safety guarantee.** It means no known patterns matched the text provided.
- **Brand detection is heuristic.** It compares a claimed brand against a small list of known domains. An unlisted brand will not be checked.
- **Rate limiting is per-instance.** In-memory counters do not coordinate across a multi-instance deployment.
- **English-centric rules.** The deterministic patterns are tuned for English and Hinglish. Gemini covers more languages; the rule engine does not.

## AI disclosure

Gemini is used as the semantic analysis layer at runtime. This codebase was written with AI assistance; the architecture, scoring model, rule weights and security decisions are documented inline so every one of them can be reviewed and argued with.
