import type { Metadata } from "next";

// The page is a client component (interactive quiz), so its metadata lives here.
export const metadata: Metadata = {
  title: "Scam simulator — ScamShield",
  description: "Realistic, fictional scam scenarios. Test whether you would have spotted them.",
};

export default function SimulatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
