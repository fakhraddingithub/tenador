"use client";

import { useEffect, useRef, useState } from "react";

const COUNTS = { low: 30, medium: 60, high: 120 };

/** Tracks the user's reduced-motion preference (reactive to OS changes). */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Generates a randomized decoration array on the client only (inside rAF, after
 * mount). This keeps random values out of render — required by the React
 * Compiler and necessary to avoid SSR/client hydration mismatches, since these
 * are client components that still render on the server for the initial HTML.
 */
function useDecorations(factory, intensity) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setItems(factory(COUNTS[intensity] || 60)));
    return () => cancelAnimationFrame(id);
    // factory is stable per component; only re-generate when intensity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensity]);
  return items;
}

// --- Snow ---
function makeFlakes(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: Math.random() * 6 + 2,
    duration: Math.random() * 8 + 5,
    delay: Math.random() * 10,
    opacity: Math.random() * 0.6 + 0.2,
  }));
}

function SnowEffect({ intensity }) {
  const flakes = useDecorations(makeFlakes, intensity);
  if (!flakes) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes snowfall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.8; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
      {flakes.map((f) => (
        <div
          key={f.id}
          style={{
            position: "absolute",
            left: `${f.left}%`,
            top: "-20px",
            width: f.size,
            height: f.size,
            borderRadius: "50%",
            background: "white",
            opacity: f.opacity,
            animation: `snowfall ${f.duration}s ${f.delay}s linear infinite`,
          }}
        />
      ))}
    </div>
  );
}

// --- Leaves ---
const LEAF_COLORS = ["#e85d04", "#f48c06", "#dc2f02", "#faa307", "#d62828"];

function makeLeaves(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 110 - 5,
    color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
    size: Math.random() * 14 + 8,
    duration: Math.random() * 10 + 8,
    delay: Math.random() * 12,
  }));
}

function LeavesEffect({ intensity }) {
  const leaves = useDecorations(makeLeaves, intensity);
  if (!leaves) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes leaffall {
          0% { transform: translateY(-30px) rotate(0deg) translateX(0); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 0.7; }
          100% { transform: translateY(105vh) rotate(720deg) translateX(40px); opacity: 0; }
        }
      `}</style>
      {leaves.map((l) => (
        <div
          key={l.id}
          style={{
            position: "absolute",
            left: `${l.left}%`,
            top: "-30px",
            width: l.size,
            height: l.size,
            borderRadius: "0 50% 50% 50%",
            background: l.color,
            animation: `leaffall ${l.duration}s ${l.delay}s ease-in infinite`,
          }}
        />
      ))}
    </div>
  );
}

// --- Sparkles ---
function makeSparkles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 2 + 1,
    delay: Math.random() * 4,
  }));
}

function SparklesEffect({ intensity }) {
  const sparkles = useDecorations(makeSparkles, intensity);
  if (!sparkles) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      {sparkles.map((s) => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: "white",
            borderRadius: "50%",
            boxShadow: `0 0 ${s.size * 3}px white`,
            animation: `sparkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

// --- Particles ---
function makeParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: Math.random() * 8 + 3,
    duration: Math.random() * 12 + 8,
    delay: Math.random() * 8,
    opacity: Math.random() * 0.4 + 0.1,
  }));
}

function ParticlesEffect({ intensity }) {
  const particles = useDecorations(makeParticles, intensity);
  if (!particles) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes particleRise {
          0% { transform: translateY(110vh) scale(0.5); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-20px) scale(1); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            bottom: "-10px",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "var(--event-primary, #aa4725)",
            opacity: p.opacity,
            animation: `particleRise ${p.duration}s ${p.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

// --- Confetti (canvas) ---
function ConfettiEffect({ intensity }) {
  const canvasRef = useRef(null);
  const count = COUNTS[intensity] || 60;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#aa4725", "#ffbf00", "#ffffff", "#ef4444", "#3b82f6"];
    const pieces = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 3 + 1,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
    }));

    let frame;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        p.y += p.speed;
        p.angle += p.spin;
        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
      });
      frame = requestAnimationFrame(draw);
    }

    draw();

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    />
  );
}

const effectMap = {
  snow: SnowEffect,
  leaves: LeavesEffect,
  sparkles: SparklesEffect,
  particles: ParticlesEffect,
  confetti: ConfettiEffect,
};

export default function EventEffects({ effect = {} }) {
  const reducedMotion = usePrefersReducedMotion();
  const { type = "none", intensity = "medium" } = effect;
  // Ambient decoration is purely aesthetic — never run it for users who asked
  // for reduced motion.
  if (reducedMotion || type === "none" || !effectMap[type]) return null;
  const Component = effectMap[type];
  return <Component intensity={intensity} />;
}
