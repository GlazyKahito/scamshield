import styles from "./motion.module.css";

/**
 * Letters roll up one after another when the parent link or button is hovered
 * or focused.
 *
 * Adapted from Text Roll (motion-primitives by ibelick, MIT), also listed on
 * 21st.dev. The original is a one-shot Motion animation; this version is pure
 * CSS, so it works in server components and costs no JavaScript. Each letter
 * carries a copy of itself one line below (text-shadow) and slides up to it.
 *
 * Must be a direct child of the <a> or <button> that triggers it.
 */

export function RollText({ children }: { children: string }) {
  return (
    <span className={styles.roll}>
      <span className="sr-only">{children}</span>
      <span className={styles.rollLine} aria-hidden="true">
        {Array.from(children).map((char, i) => (
          <span key={i} className={styles.rollChar} style={{ "--i": i } as React.CSSProperties}>
            {char === " " ? " " : char}
          </span>
        ))}
      </span>
    </span>
  );
}

export default RollText;
