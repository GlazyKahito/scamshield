/**
 * Deterministic URL analyzer.
 *
 * SAFETY CONTRACT: this module performs *string parsing only*. It never issues
 * a network request, never resolves DNS, never follows a redirect, and never
 * expands a shortened link. A suspicious URL that reaches this code is treated
 * as inert text.
 *
 * Consequence worth being honest about in the UI: structural analysis is not a
 * reputation check. A clean structure does not mean a domain is safe, and an
 * odd structure does not mean it is malicious.
 *
 * Zero imports by design — this file is unit-testable without a bundler.
 */

import type { SecuritySignal, UrlAnalysis, UrlFacts } from "../../types/analysis";

/** Multi-part public suffixes we must not mistake for a subdomain level. */
const MULTI_PART_TLDS = [
  "co.uk", "co.in", "org.uk", "ac.uk", "gov.uk", "com.au", "co.nz", "co.za",
  "com.br", "com.sg", "co.jp", "or.jp", "ne.jp", "gov.in", "ac.in", "net.in",
  "org.in", "res.in", "com.mx", "com.tr", "co.kr",
];

/** Well-known link shorteners. Presence is a signal, never proof. */
const SHORTENER_HOSTS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "t.ly", "tiny.cc",
  "lnkd.in", "db.tt", "qr.ae", "adf.ly", "bitly.com", "shorte.st", "bl.ink",
]);

/**
 * TLDs statistically over-represented in abuse reports. Weighted *lightly* and
 * never on their own — the spec is explicit that "weird TLD = scam" is a bad rule.
 */
const ELEVATED_RISK_TLDS = new Set([
  "zip", "mov", "top", "xyz", "tk", "ml", "ga", "cf", "gq", "work", "click",
  "link", "country", "kim", "loan", "download", "rest", "quest", "cam", "sbs",
]);

/** Path or query words typical of credential-harvesting pages. */
const SENSITIVE_PATH_WORDS = [
  "login", "signin", "verify", "verification", "secure", "security", "account",
  "update", "confirm", "kyc", "netbanking", "payment", "billing", "wallet",
  "unlock", "recover", "reset", "authenticate", "validate", "suspended",
];

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * URL extraction from free text.
 *
 * Handles bare hosts (`sbi-secure-login.example/kyc`) as well as full URLs,
 * because scam SMS routinely omit the scheme. Trailing sentence punctuation is
 * stripped so "visit example.com." does not yield a host ending in a period.
 */
const URL_RE =
  /\b((?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?)/gi;

export function extractUrls(text: string): string[] {
  const found = new Set<string>();
  const matches = text.match(URL_RE) ?? [];

  for (const raw of matches) {
    let candidate = raw.replace(/[.,;:!?)\]}'"]+$/, "");
    if (!candidate) continue;

    // Skip bare email domains — the address itself is handled separately.
    const idx = text.indexOf(candidate);
    if (idx > 0 && text[idx - 1] === "@") continue;

    if (!/^https?:\/\//i.test(candidate)) {
      // Require a plausible TLD before assuming a bare host is a link,
      // so "version 2.5" or "Rs.1999" are not treated as URLs.
      const host = candidate.split("/")[0];
      const lastLabel = host.split(".").pop() ?? "";
      if (!/^[a-z]{2,}$/i.test(lastLabel)) continue;
      candidate = "http://" + candidate;
    }
    found.add(candidate);
  }
  return [...found];
}

function splitHost(hostname: string): { tld: string; subdomainCount: number } {
  const labels = hostname.split(".").filter(Boolean);
  if (labels.length < 2) return { tld: "", subdomainCount: 0 };

  const lastTwo = labels.slice(-2).join(".");
  const suffixLabels = MULTI_PART_TLDS.includes(lastTwo) ? 2 : 1;
  const tld = labels.slice(-suffixLabels).join(".");

  // subdomains = everything before the registrable domain + its suffix
  const subdomainCount = Math.max(0, labels.length - suffixLabels - 1);
  return { tld, subdomainCount };
}

export function parseUrl(rawUrl: string): UrlFacts {
  const empty: UrlFacts = {
    url: rawUrl, protocol: "", hostname: "", pathname: "", query: "",
    fragment: "", port: null, hasHttps: false, hostnameLength: 0,
    subdomainCount: 0, pathLength: 0, urlLength: rawUrl.length,
    isIpHost: false, isPunycode: false, hasEncodedChars: false,
    isShortener: false, tld: "", malformed: true,
  };

  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return empty;
  }

  const hostname = u.hostname.toLowerCase();
  const { tld, subdomainCount } = splitHost(hostname);

  return {
    url: rawUrl,
    protocol: u.protocol.replace(":", ""),
    hostname,
    pathname: u.pathname,
    query: u.search,
    fragment: u.hash,
    port: u.port || null,
    hasHttps: u.protocol === "https:",
    hostnameLength: hostname.length,
    subdomainCount,
    pathLength: u.pathname.length,
    urlLength: rawUrl.length,
    isIpHost: IPV4_RE.test(hostname),
    isPunycode: hostname.split(".").some((l) => l.startsWith("xn--")),
    hasEncodedChars: /%[0-9a-f]{2}/i.test(u.pathname + u.search),
    isShortener: SHORTENER_HOSTS.has(hostname),
    tld,
    malformed: false,
  };
}

function signal(
  name: string,
  severity: SecuritySignal["severity"],
  evidence: string,
  explanation: string,
  group: SecuritySignal["group"],
  weight: number,
): SecuritySignal {
  return { name, severity, evidence, explanation, group, weight, source: "RULE" };
}

export function analyzeUrl(rawUrl: string): UrlAnalysis {
  const facts = parseUrl(rawUrl);
  const signals: SecuritySignal[] = [];

  if (facts.malformed) {
    signals.push(
      signal(
        "Malformed link",
        "MEDIUM",
        rawUrl.slice(0, 120),
        "This link could not be parsed as a valid web address. Malformed links are sometimes used to confuse both people and security filters.",
        "url_obfuscation",
        10,
      ),
    );
    return { facts, signals, score: 10 };
  }

  if (!facts.hasHttps) {
    signals.push(
      signal(
        "No HTTPS",
        "MEDIUM",
        `${facts.protocol}://${facts.hostname}`,
        "The link does not use an encrypted connection. Legitimate organisations almost always use HTTPS for anything involving your account.",
        "suspicious_url",
        8,
      ),
    );
  }

  if (facts.isIpHost) {
    signals.push(
      signal(
        "IP address instead of a domain",
        "HIGH",
        facts.hostname,
        "The link points at a raw IP address rather than a named domain. Real companies use their own domain name, not a bare IP.",
        "suspicious_url",
        20,
      ),
    );
  }

  if (facts.isPunycode) {
    signals.push(
      signal(
        "Punycode domain",
        "HIGH",
        facts.hostname,
        "This domain uses encoded international characters, which can make a fake address look almost identical to a real one.",
        "url_obfuscation",
        15,
      ),
    );
  }

  if (facts.subdomainCount >= 3) {
    signals.push(
      signal(
        "Excessive subdomains",
        "MEDIUM",
        facts.hostname,
        `The address stacks ${facts.subdomainCount} subdomains. This is often used to bury a brand name in front of a domain the attacker actually controls.`,
        "url_obfuscation",
        12,
      ),
    );
  }

  if (facts.hostnameLength > 40) {
    signals.push(
      signal(
        "Unusually long hostname",
        "LOW",
        `${facts.hostname} (${facts.hostnameLength} characters)`,
        "Very long hostnames can push the real domain out of view on a phone screen.",
        "url_obfuscation",
        8,
      ),
    );
  }

  if (facts.urlLength > 120) {
    signals.push(
      signal(
        "Unusually long link",
        "LOW",
        `${facts.urlLength} characters`,
        "Long links make it harder to see where you are actually being sent.",
        "url_obfuscation",
        6,
      ),
    );
  }

  if (facts.hasEncodedChars) {
    signals.push(
      signal(
        "Encoded characters in the link",
        "MEDIUM",
        decodeURIComponentSafe(facts.pathname + facts.query).slice(0, 120),
        "Parts of this link are percent-encoded, which is sometimes used to hide the real destination or parameters.",
        "url_obfuscation",
        10,
      ),
    );
  }

  if (facts.isShortener) {
    signals.push(
      signal(
        "Shortened link",
        "MEDIUM",
        facts.hostname,
        "Shortened links hide the true destination until you have already clicked. ScamShield does not expand them, because that would mean contacting the site.",
        "url_obfuscation",
        12,
      ),
    );
  }

  const haystack = (facts.pathname + facts.query).toLowerCase();
  const hitWords = SENSITIVE_PATH_WORDS.filter((w) => haystack.includes(w));
  if (hitWords.length > 0) {
    signals.push(
      signal(
        "Sensitive words in the link path",
        hitWords.length >= 2 ? "HIGH" : "MEDIUM",
        hitWords.join(", "),
        "The link path suggests a login, verification or payment page — the kind of page used to capture credentials.",
        "suspicious_url",
        hitWords.length >= 2 ? 16 : 10,
      ),
    );
  }

  const lastTld = facts.tld.split(".").pop() ?? "";
  if (ELEVATED_RISK_TLDS.has(lastTld)) {
    signals.push(
      signal(
        "Uncommon top-level domain",
        "LOW",
        `.${facts.tld}`,
        "This top-level domain appears more often than average in abuse reports. On its own this means very little, so it is weighted lightly.",
        "suspicious_url",
        6,
      ),
    );
  }

  if (/\d{1,3}-\d{1,3}/.test(facts.hostname) || (facts.hostname.match(/-/g)?.length ?? 0) >= 3) {
    signals.push(
      signal(
        "Unusual hostname structure",
        "LOW",
        facts.hostname,
        "The hostname uses an unusual pattern of hyphens or digits, a common trait of disposable throwaway domains.",
        "suspicious_url",
        8,
      ),
    );
  }

  const score = Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0));
  return { facts, signals, score };
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
