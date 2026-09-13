"use client";

/**
 * Fluid Particles Background — adapted from the 21st.dev community component.
 * Tailwind/cn removed for this project's CSS Modules. Particles fade their
 * trails to transparency, so the page's own background shows through.
 */

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

interface FluidParticlesBackgroundProps {
  children?: ReactNode;
  /** Upper bound; the actual count scales with the container's area. */
  particleCount?: number;
  noiseIntensity?: number;
  minSize?: number;
  maxSize?: number;
  /** "r, g, b" */
  color?: string;
  className?: string;
  style?: CSSProperties;
}

const PERMUTATION = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240,
  21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88,
  237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83,
  111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80,
  73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
  52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182,
  189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22,
  39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210,
  144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204,
  176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66,
  215, 61, 156, 180,
];

const P = new Uint8Array(512);
for (let i = 0; i < 512; i++) P[i] = PERMUTATION[i & 255];

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (t: number, a: number, b: number) => a + t * (b - a);

function grad(hash: number, x: number, y: number, z: number) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/** Classic 3D Perlin noise, roughly in [-1, 1]. */
function noise3(x: number, y: number, z: number) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = P[X] + Y;
  const AA = P[A] + Z;
  const AB = P[A + 1] + Z;
  const B = P[X + 1] + Y;
  const BA = P[B] + Z;
  const BB = P[B + 1] + Z;
  return lerp(
    w,
    lerp(v, lerp(u, grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z)), lerp(u, grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z))),
    lerp(
      v,
      lerp(u, grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1)),
      lerp(u, grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1)),
    ),
  );
}

interface Particle {
  x: number;
  y: number;
  size: number;
  life: number;
  maxLife: number;
}

export function FluidParticlesBackground({
  children,
  particleCount = 2000,
  noiseIntensity = 0.003,
  minSize = 0.5,
  maxSize = 2,
  color = "22, 24, 27",
  className,
  style,
}: FluidParticlesBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!container || !canvas || !ctx) return;

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let particles: Particle[] = [];
    let frame: number | null = null;
    let visible = false;

    const spawn = (p: Particle) => {
      p.x = Math.random() * canvas.width;
      p.y = Math.random() * canvas.height;
    };

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      // ~1 particle per 650px², capped, so phones don't simulate 2,000 of them.
      const count = Math.min(particleCount, Math.round((canvas.width * canvas.height) / 650));
      particles = Array.from({ length: count }, () => {
        const p: Particle = {
          x: 0,
          y: 0,
          size: Math.random() * (maxSize - minSize) + minSize,
          life: Math.random() * 100,
          maxLife: 100 + Math.random() * 50,
        };
        spawn(p);
        return p;
      });
    };

    const step = () => {
      // Fade previous frames toward transparent rather than painting a colour over them.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";

      const t = Date.now() * 0.0001;
      for (const p of particles) {
        p.life += 1;
        if (p.life > p.maxLife) {
          p.life = 0;
          spawn(p);
        }

        const angle = noise3(p.x * noiseIntensity, p.y * noiseIntensity, t) * Math.PI * 4;
        p.x += Math.cos(angle) * 2;
        p.y += Math.sin(angle) * 2;

        if (p.x < 0) p.x = canvas.width;
        else if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        else if (p.y > canvas.height) p.y = 0;

        const opacity = Math.sin((p.life / p.maxLife) * Math.PI) * 0.15;
        ctx.fillStyle = `rgba(${color}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      step();
      frame = visible ? requestAnimationFrame(loop) : null;
    };

    const start = () => {
      if (calm) {
        // One settled still frame with short trails, no ongoing motion.
        for (let i = 0; i < 40; i++) step();
      } else if (visible && frame === null) {
        frame = requestAnimationFrame(loop);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (calm) start();
    });
    resizeObserver.observe(container);
    resize();

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    });
    intersectionObserver.observe(container);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [particleCount, noiseIntensity, minSize, maxSize, color]);

  return (
    <div ref={containerRef} className={className} style={{ overflow: "hidden", ...style }} aria-hidden={children ? undefined : true}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />
      {children && <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>{children}</div>}
    </div>
  );
}
