import type { Metadata } from "next";

// The page is a client component (search and filters), so its metadata lives here.
export const metadata: Metadata = {
  title: "Scam library — ScamShield",
  description: "How common scams work, the red flags they share, and what to do when one reaches you.",
};

export default function ScamsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
