"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import styles from "./motion.module.css";

/**
 * Words rise out of a clipped line when the heading scrolls into view.
 *
 * Adapted from Vertical Cut Reveal (fancycomponents.dev, MIT), also listed on
 * 21st.dev: split by word, clip each word, spring it up from below. Trimmed to
 * word-splitting and an in-view trigger, and rewritten for CSS Modules.
 *
 * Renders inline, so it can sit inside any heading. Screen readers get the
 * plain sentence once; the animated words are aria-hidden.
 */

interface CutRevealProps {
  children: string;
  /** Seconds before the first word moves. */
  delay?: number;
  /** Seconds between words. */
  stagger?: number;
}

export function CutReveal({ children, delay = 0, stagger = 0.055 }: CutRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -6% 0px" });
  const reduce = useReducedMotion();
  const words = children.split(" ");

  return (
    <span ref={ref} className={styles.cut}>
      <span className="sr-only">{children}</span>
      {words.map((word, i) => (
        <span key={i} aria-hidden="true">
          <span className={styles.cutWord}>
            <motion.span
              className={styles.cutInner}
              initial={{ y: "110%" }}
              // Reduced motion still has to move the words into place: the
              // server-rendered markup starts them hidden below the line.
              animate={inView || reduce ? { y: "0%" } : undefined}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 170, damping: 24, mass: 0.9, delay: delay + i * stagger }
              }
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

export default CutReveal;
