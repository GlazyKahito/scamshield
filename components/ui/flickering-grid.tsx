"use client";

/**
 * Flickering Grid — adapted from Magic UI (MIT), https://magicui.design
 * Tailwind removed for this project's CSS Modules; pauses off-screen and
 * renders a static frame under prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";

interface FlickeringGridProps {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  maxOpacity?: number;
  className?: string;
}

export function FlickeringGrid({
  squareSize = 3,
  gridGap = 9,
  flickerChance = 0.25,
  color = "22, 24, 27",
  maxOpacity = 0.12,
  className,
}: FlickeringGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!container || !canvas || !ctx) return;

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cell = squareSize + gridGap;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let squares = new Float32Array(0);
    let frame: number | null = null;
    let last = 0;
    let visible = false;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillStyle = `rgba(${color}, ${squares[i * rows + j]})`;
          ctx.fillRect(i * cell * dpr, j * cell * dpr, squareSize * dpr, squareSize * dpr);
        }
      }
    };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      cols = Math.ceil(w / cell);
      rows = Math.ceil(h / cell);
      squares = new Float32Array(cols * rows);
      for (let i = 0; i < squares.length; i++) squares[i] = Math.random() * maxOpacity;
      draw();
    };

    const tick = (time: number) => {
      const dt = last ? (time - last) / 1000 : 0;
      last = time;
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < flickerChance * dt) squares[i] = Math.random() * maxOpacity;
      }
      draw();
      frame = visible ? requestAnimationFrame(tick) : null;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !calm && frame === null) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    });
    intersectionObserver.observe(container);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [squareSize, gridGap, flickerChance, color, maxOpacity]);

  return (
    <div ref={containerRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} style={{ display: "block", pointerEvents: "none" }} />
    </div>
  );
}
