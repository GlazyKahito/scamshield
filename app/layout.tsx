import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";
import { FluidParticlesBackground } from "../components/ui/fluid-particles-background";
import { ScrollReveal } from "../components/ui/scroll-reveal";
import { SPLASH_SEEN_KEY } from "../components/ui/splash-key";
import { SplashScreen } from "../components/ui/splash-screen";
import "./globals.css";

/**
 * Runs before first paint: on repeat loads in the same session, inject a style
 * rule that hides the loading screen, so it never flashes. A <style> node is
 * used rather than a class on <html>, which React resets while hydrating.
 */
const SPLASH_GATE = `try{if(sessionStorage.getItem(${JSON.stringify(SPLASH_SEEN_KEY)})){var s=document.createElement("style");s.textContent=".splash{display:none!important}";document.head.appendChild(s)}}catch(e){}`;

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
        <script dangerouslySetInnerHTML={{ __html: SPLASH_GATE }} />
        <SplashScreen />
        {/* Lives in the layout, so it persists across every route change. */}
        <FluidParticlesBackground className="site-background" />
        <div className="site-content">{children}</div>
        <ScrollReveal />
      </body>
    </html>
  );
}
