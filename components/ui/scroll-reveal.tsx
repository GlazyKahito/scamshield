"use client";

import { useEffect } from "react";

/**
 * Scroll-triggered entrances for the whole site. Mounted once in app/layout.tsx.
 *
 *   data-reveal          the element fades up when it scrolls into view
 *   data-reveal-stagger  its direct children fade up one after another
 *
 * Elements already on screen at first load are shown immediately (no flash of
 * hidden content); anything below the fold, or rendered later — a new route, a
 * finished report — animates in. Hidden states only apply once this script has
 * run, so content stays visible without JavaScript.
 */

const SELECTOR = "[data-reveal], [data-reveal-stagger]";

export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = new WeakSet<Element>();

    const show = (el: Element) => el.classList.add("is-visible");

    const observer = reduce
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              show(entry.target);
              observer?.unobserve(entry.target);
            }
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
        );

    const register = (el: Element, initial: boolean) => {
      if (seen.has(el)) return;
      seen.add(el);

      if (el.hasAttribute("data-reveal-stagger")) {
        Array.from(el.children).forEach((child, i) => {
          (child as HTMLElement).style.setProperty("--reveal-i", String(i));
        });
      }

      if (!observer) return show(el);

      if (initial) {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) return show(el);
      }
      observer.observe(el);
    };

    const scan = (node: ParentNode, initial: boolean) => {
      if (node instanceof Element && node.matches(SELECTOR)) register(node, initial);
      node.querySelectorAll(SELECTOR).forEach((el) => register(el, initial));
    };

    scan(document, true);
    root.classList.add("reveal-ready");

    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node, false);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mutations.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);

  return null;
}

export default ScrollReveal;
