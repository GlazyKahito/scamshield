"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";

/**
 * Route transition. A template remounts on every navigation, so each new page
 * settles in with a short fade and lift. The very first page load is skipped:
 * hiding server-rendered content until hydration would only delay it.
 */

let firstLoad = true;

export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const skip = firstLoad || reduce;

  useEffect(() => {
    firstLoad = false;
  }, []);

  return (
    <motion.div
      initial={skip ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
