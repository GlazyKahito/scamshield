import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { FluidParticlesBackground } from "../components/ui/fluid-particles-background";
import { ScrollReveal } from "../components/ui/scroll-reveal";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
  weight: ["400", "500", "600"],
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
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {/* Lives in the layout, so it persists across every route change. */}
        <FluidParticlesBackground className="site-background" />
        <div className="site-content">{children}</div>
        <ScrollReveal />
      </body>
    </html>
  );
}
