import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";
import { FluidParticlesBackground } from "../components/ui/fluid-particles-background";
import { ScrollReveal } from "../components/ui/scroll-reveal";
import "./globals.css";

/** Headings: a text serif with optical sizes, so large titles read like print. */
const display = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

/** Body and UI: a sturdy newspaper grotesk, not the default startup sans. */
const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-schibsted",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ScamShield",
  description: "AI-powered scam and phishing detection for everyone.",
};

export const viewport: Viewport = {
  themeColor: "#08090A",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {/* Lives in the layout, so it persists across every route change. */}
        <FluidParticlesBackground className="site-background" />
        <div className="site-content">{children}</div>
        <ScrollReveal />
      </body>
    </html>
  );
}
