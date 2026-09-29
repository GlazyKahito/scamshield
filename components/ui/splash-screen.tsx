"use client";

import { useEffect, useState } from "react";
import { SPLASH_SEEN_KEY } from "./splash-key";

/**
 * First-visit loading screen. Mounted once in app/layout.tsx.
 *
 * Rendered in the server HTML so it covers the first paint, then faded out
 * once fonts are ready (never sooner than MIN_MS, never later than MAX_MS).
 * Shown once per browser session: on later loads an inline script in the
 * layout hides it before paint, and this component unmounts it.
 * Without JavaScript a CSS animation removes it after a few seconds, so the
 * page is never blocked.
 */

const MIN_MS = 1100;
const MAX_MS = 2600;
const FADE_MS = 600;

export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "gone">("visible");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_SEEN_KEY)) {
        setPhase("gone");
        return;
      }
      sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    } catch {
      // Private mode or blocked storage: the screen simply shows again next load.
    }

    let cancelled = false;
    const minWait = new Promise((resolve) => setTimeout(resolve, MIN_MS));
    const maxWait = new Promise((resolve) => setTimeout(resolve, MAX_MS));
    Promise.race([Promise.all([minWait, document.fonts?.ready]), maxWait]).then(() => {
      if (cancelled) return;
      setPhase("leaving");
      setTimeout(() => !cancelled && setPhase("gone"), FADE_MS);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={phase === "leaving" ? "splash splash-leaving" : "splash"} aria-hidden="true">
      <div className="splash-inner">
        <svg className="splash-mark" width="56" height="56" viewBox="0 0 22 22" fill="none">
          <path
            className="splash-outline"
            d="M11 1.5 3.5 4.6v6.1c0 4.5 3.1 8.3 7.5 9.8 4.4-1.5 7.5-5.3 7.5-9.8V4.6L11 1.5Z"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
            pathLength={1}
          />
          <path className="splash-bar" d="M6.5 10.4h9" stroke="#E5533A" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <p className="splash-word">
          Scam<span>Shield</span>
        </p>
        <div className="splash-track">
          <span className="splash-progress" />
        </div>
        <p className="splash-caption">CHECKING THE SIGNALS</p>
      </div>
    </div>
  );
}

export default SplashScreen;
