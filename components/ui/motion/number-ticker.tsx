"use client";

import { useInView, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Counts up to a number with a spring once it is on screen.
 *
 * Adapted from Number Ticker (Magic UI, MIT), also listed on 21st.dev. Writes
 * straight to the DOM on each frame instead of re-rendering React.
 */

interface NumberTickerProps {
  value: number;
  /** Text after the number, e.g. "%". */
  suffix?: string;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function NumberTicker({ value, suffix = "", delay = 0, className, style }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 40, stiffness: 110 });
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      motionValue.jump(value);
      spring.jump(value);
      return;
    }
    const timer = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(timer);
  }, [inView, reduce, value, delay, motionValue, spring]);

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (ref.current) ref.current.textContent = `${Math.round(latest)}${suffix}`;
      }),
    [spring, suffix],
  );

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {reduce ? value : 0}
      {suffix}
    </span>
  );
}

export default NumberTicker;
