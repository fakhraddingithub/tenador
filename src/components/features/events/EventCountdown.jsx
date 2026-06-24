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
        Collection به پایان رسید
      </div>
    );
  }

  // ⚠️ globals.css has a global `* { direction: rtl }` rule that overrides any
  // dir="ltr" attribute (an author `*` rule beats the UA-level dir attribute) —
  // that's why the earlier dir-based fix didn't work. So instead of fighting the
  // direction, we author the segments in RTL visual order: in an RTL flex row the
  // FIRST child sits on the RIGHT. Order [seconds, minutes, hours, days] therefore
  // renders seconds → rightmost and days → leftmost (reads right-to-left:
  // ثانیه، دقیقه، ساعت، روز).
  const units = [
    { label: "ثانیه", value: timeLeft.seconds },
    { label: "دقیقه", value: timeLeft.minutes },
    { label: "ساعت", value: timeLeft.hours },
    { label: "روز", value: timeLeft.days },
  ];

  if (style === "minimal") {
    // Glassy / frosted chips tinted with the campaign's theme colors. Uses the
    // site font (no font-mono) — inherits Vazirmatn from the page.
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {units.map((u) => (
          <div
            key={u.label}
            className="flex flex-col items-center justify-center min-w-[3rem] px-2.5 py-1.5 rounded-xl border"
            style={{
              background: "color-mix(in srgb, var(--event-primary, #aa4725) 16%, transparent)",
              borderColor: "color-mix(in srgb, var(--event-primary, #aa4725) 35%, transparent)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: "var(--event-text, #fff)",
            }}
          >
            <span className="text-lg font-bold leading-none tabular-nums">{pad(u.value)}</span>
            <span className="text-[10px] mt-0.5 opacity-70">{u.label}</span>
          </div>
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
