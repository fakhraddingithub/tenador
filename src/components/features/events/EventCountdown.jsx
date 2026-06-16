"use client";

import { useState, useEffect } from "react";

function pad(n) {
  return String(n).padStart(2, "0");
}

function calcTimeLeft(endDate) {
  const diff = new Date(endDate) - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export default function EventCountdown({ endDate, style = "cards", className = "" }) {
  // undefined = not computed yet (server + first client render), null = ended,
  // object = live. Computing on the client only avoids a hydration mismatch, and
  // the initial compute is deferred to a microtask so the effect never setState's
  // synchronously.
  const [timeLeft, setTimeLeft] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) setTimeLeft(endDate ? calcTimeLeft(endDate) : null);
    };
    Promise.resolve().then(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [endDate]);

  // Reserve space before the first compute to avoid layout shift.
  if (timeLeft === undefined) {
    return <div className={`h-16 md:h-20 ${className}`} aria-hidden="true" />;
  }

  if (!timeLeft) {
    return (
      <div className={`text-center text-sm font-bold opacity-60 ${className}`}>
        رویداد به پایان رسید
      </div>
    );
  }

  const units = [
    { label: "روز", value: timeLeft.days },
    { label: "ساعت", value: timeLeft.hours },
    { label: "دقیقه", value: timeLeft.minutes },
    { label: "ثانیه", value: timeLeft.seconds },
  ];

  if (style === "minimal") {
    return (
      <div className={`flex items-center gap-2 font-mono text-lg font-bold ${className}`}>
        {units.map((u, i) => (
          <span key={u.label} className="flex items-center gap-1">
            <span style={{ color: "var(--event-primary, #aa4725)" }}>
              {pad(u.value)}
            </span>
            <span className="text-xs opacity-50">{u.label}</span>
            {i < units.length - 1 && <span className="opacity-30 mx-0.5">:</span>}
          </span>
        ))}
      </div>
    );
  }

  if (style === "dramatic") {
    return (
      <div className={`flex justify-center gap-3 ${className}`}>
        {units.map((u) => (
          <div key={u.label} className="text-center">
            <div
              className="text-5xl md:text-7xl font-black leading-none tabular-nums"
              style={{ color: "var(--event-primary, #aa4725)" }}
            >
              {pad(u.value)}
            </div>
            <div className="text-xs mt-1 opacity-50 font-bold uppercase tracking-widest">
              {u.label}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: cards
  return (
    <div className={`flex justify-center gap-3 ${className}`}>
      {units.map((u) => (
        <div
          key={u.label}
          className="flex flex-col items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-xl text-white"
          style={{ background: "var(--event-primary, #aa4725)" }}
        >
          <span className="text-2xl md:text-3xl font-black leading-none tabular-nums">
            {pad(u.value)}
          </span>
          <span className="text-[10px] mt-0.5 opacity-75 font-bold">{u.label}</span>
        </div>
      ))}
    </div>
  );
}
