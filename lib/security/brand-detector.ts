/**
 * Brand impersonation heuristic.
 *
 * The logic is deliberately conservative and works in one direction only:
 *
 *   "This message says it is from <Brand>, but the link does not go to a
 *    domain that plausibly belongs to <Brand>."
 *
 * That is a *mismatch*, not a malware verdict. We never claim the destination
 * is malicious, and we never claim a domain is fake — only that it does not
 * match what the message claims. Absence of a mismatch is not a clean bill of
 * health either, since we cannot verify domain ownership offline.
 *
 * Zero imports beyond types, so this is unit-testable in isolation.
 */

import type { SecuritySignal } from "../../types/analysis";

export interface BrandProfile {
  /** Display name shown in the report. */
  name: string;
  /** Case-insensitive terms that indicate the message claims this brand. */
  aliases: string[];
  /**
   * Registrable domains the brand legitimately uses. A hostname matches if it
   * equals one of these or is a subdomain of one.
   */
  domains: string[];
  /** Rough sector, used to pick contextual recommendations later. */
  sector: "bank" | "payments" | "tech" | "shopping" | "logistics" | "social" | "media";
}

export const BRANDS: BrandProfile[] = [
  { name: "SBI", aliases: ["sbi", "state bank of india", "yono"], domains: ["sbi.co.in", "onlinesbi.sbi", "onlinesbi.com"], sector: "bank" },
  { name: "HDFC Bank", aliases: ["hdfc"], domains: ["hdfcbank.com"], sector: "bank" },
  { name: "ICICI Bank", aliases: ["icici"], domains: ["icicibank.com"], sector: "bank" },
  { name: "Axis Bank", aliases: ["axis bank", "axisbank"], domains: ["axisbank.com"], sector: "bank" },
  { name: "Paytm", aliases: ["paytm"], domains: ["paytm.com", "paytmbank.com"], sector: "payments" },
  { name: "PhonePe", aliases: ["phonepe", "phone pe"], domains: ["phonepe.com"], sector: "payments" },
  { name: "Google", aliases: ["google", "gmail", "google pay", "gpay"], domains: ["google.com", "gmail.com", "accounts.google.com", "pay.google.com"], sector: "tech" },
  { name: "Microsoft", aliases: ["microsoft", "outlook", "office 365", "onedrive"], domains: ["microsoft.com", "live.com", "outlook.com", "office.com"], sector: "tech" },
  { name: "Apple", aliases: ["apple", "icloud", "apple id"], domains: ["apple.com", "icloud.com"], sector: "tech" },
  { name: "Amazon", aliases: ["amazon"], domains: ["amazon.com", "amazon.in"], sector: "shopping" },
  { name: "Flipkart", aliases: ["flipkart"], domains: ["flipkart.com"], sector: "shopping" },
  { name: "DHL", aliases: ["dhl"], domains: ["dhl.com", "dhl.co.in"], sector: "logistics" },
  { name: "FedEx", aliases: ["fedex"], domains: ["fedex.com"], sector: "logistics" },
  { name: "India Post", aliases: ["india post", "indiapost", "speed post"], domains: ["indiapost.gov.in"], sector: "logistics" },
  { name: "Netflix", aliases: ["netflix"], domains: ["netflix.com"], sector: "media" },
  { name: "Instagram", aliases: ["instagram"], domains: ["instagram.com"], sector: "social" },
  { name: "WhatsApp", aliases: ["whatsapp"], domains: ["whatsapp.com", "wa.me"], sector: "social" },
  { name: "Facebook", aliases: ["facebook", "meta"], domains: ["facebook.com", "fb.com", "meta.com"], sector: "social" },
];

/** Escape a string for safe use inside a RegExp. */
function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Which brands does this text claim to be from? */
export function detectClaimedBrands(text: string): BrandProfile[] {
  const lower = text.toLowerCase();
  return BRANDS.filter((brand) =>
    brand.aliases.some((alias) => {
      // Word-boundary match so "sbi" does not fire inside "sbin" or "business".
      const re = new RegExp(`(^|[^a-z0-9])${escapeRe(alias)}([^a-z0-9]|$)`, "i");
      return re.test(lower);
    }),
  );
}

/** Does `hostname` belong to (or sit under) one of the brand's real domains? */
export function hostMatchesBrand(hostname: string, brand: BrandProfile): boolean {
  const host = hostname.toLowerCase();
  return brand.domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * A hostname "wears" a brand name when the brand string appears in the host but
 * the host is not actually owned by that brand's known domains — e.g.
 * `sbi-secure-login.example`. This is the strongest form of the mismatch.
 */
function hostWearsBrandName(hostname: string, brand: BrandProfile): boolean {
  const host = hostname.toLowerCase().replace(/[^a-z0-9]/g, "");
  return brand.aliases.some((alias) => {
    const flat = alias.replace(/[^a-z0-9]/g, "");
    return flat.length >= 3 && host.includes(flat);
  });
}

/**
 * Compare the brands a message claims against the hostnames it links to.
 *
 * @param text      the raw message
 * @param hostnames hostnames already extracted by the URL analyzer
 */
export function detectImpersonation(
  text: string,
  hostnames: string[],
): { signals: SecuritySignal[]; claimedBrands: string[] } {
  const claimed = detectClaimedBrands(text);
  const signals: SecuritySignal[] = [];

  if (claimed.length === 0 || hostnames.length === 0) {
    return { signals, claimedBrands: claimed.map((b) => b.name) };
  }

  for (const brand of claimed) {
    const matching = hostnames.filter((h) => hostMatchesBrand(h, brand));
    if (matching.length > 0) continue; // link plausibly belongs to the brand

    const mismatched = hostnames.filter((h) => !hostMatchesBrand(h, brand));
    if (mismatched.length === 0) continue;

    const wearing = mismatched.filter((h) => hostWearsBrandName(h, brand));

    if (wearing.length > 0) {
      signals.push({
        name: "Possible brand impersonation",
        severity: "HIGH",
        evidence: `Message mentions ${brand.name}; link points to ${wearing[0]}`,
        explanation:
          `The message presents itself as ${brand.name} and the link carries the ${brand.name} name, but the domain is not one ${brand.name} is known to use. ` +
          `Putting a brand name in front of a domain you control is one of the cheapest ways to make a link look official. ` +
          `ScamShield cannot verify who owns this domain, so treat this as a mismatch worth checking rather than proof of fraud.`,
        source: "RULE",
        group: "impersonation",
        weight: 18,
      });
    } else {
      signals.push({
        name: "Sender and link do not match",
        severity: "MEDIUM",
        evidence: `Message mentions ${brand.name}; link points to ${mismatched[0]}`,
        explanation:
          `The message refers to ${brand.name}, but the link goes somewhere unrelated to ${brand.name}'s known web addresses. ` +
          `That can be innocent — marketing emails often use tracking domains — but it is worth verifying before you act.`,
        source: "RULE",
        group: "impersonation",
        weight: 12,
      });
    }
  }

  return { signals, claimedBrands: claimed.map((b) => b.name) };
}

/** Sector of the first claimed brand, used to tailor recommendations. */
export function primarySector(claimedBrands: string[]): BrandProfile["sector"] | null {
  for (const name of claimedBrands) {
    const brand = BRANDS.find((b) => b.name === name);
    if (brand) return brand.sector;
  }
  return null;
}
