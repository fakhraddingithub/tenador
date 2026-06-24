"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

function computeTimeLeft(endDate) {
  if (!endDate) return null;
  const diff = new Date(endDate) - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
  };
}

// Countdown is computed on the client only (starts null) to avoid a server/client
// hydration mismatch — Date.now() differs between the two renders. The initial
// compute is deferred to a microtask so no setState runs synchronously in the effect.
function useLiveCountdown(endDate) {
  const [t, setT] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) setT(computeTimeLeft(endDate));
    };
    Promise.resolve().then(tick);
    const id = setInterval(tick, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [endDate]);

  return t;
}

const statusConfig = {
  active: { label: "در حال برگزاری", dot: "#22c55e" },
  scheduled: { label: "به زودی", dot: "#3b82f6" },
  paused: { label: "موقتاً متوقف", dot: "#f59e0b" },
  ended: { label: "پایان یافت", dot: "#6b7280" },
  draft: { label: "پیش‌نویس", dot: "#9ca3af" },
};

export default function EventCard({ event, index = 0 }) {
  const t = useLiveCountdown(event.endDate);
  const cfg = statusConfig[event.status] || statusConfig.draft;
  const theme = event.theme || {};
  const primaryColor = theme.primaryColor || "#aa4725";
  const secondaryColor = theme.secondaryColor || "#ffbf00";
  const bgColor = theme.backgroundColor || "#0d0d0d";
  // Single header image (fallback to legacy fields for old events)
  const coverImage =
    event.visualIdentity?.headerImage ||
    event.visualIdentity?.heroImage ||
    event.visualIdentity?.coverImage;
  const logo = event.visualIdentity?.icon || event.visualIdentity?.logo;

  const isEnded = event.status === "ended";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
    >
      <Link
        href={`/collection/${event.slug}`}
        className={`group block relative rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] ${isEnded ? "opacity-50 grayscale" : ""}`}
        style={{
          background: bgColor,
          boxShadow: `0 4px 24px ${primaryColor}18`,
        }}
        aria-label={`Collection ${event.name}`}
      >
        {/* Gradient accent bar */}
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
          }}
        />

        {/* Cover Image */}
        <div className="relative h-44 overflow-hidden">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={event.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: theme.gradient || `linear-gradient(135deg, ${bgColor}, ${primaryColor}44)`,
              }}
            />
          )}

          {/* Dark overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Status badge */}
          <div className="absolute top-3 right-3">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full text-white"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: cfg.dot }}
              />
              {cfg.label}
            </span>
          </div>

          {/* Logo */}
          {logo && (
            <div className="absolute bottom-3 left-3 w-10 h-10 rounded-xl overflow-hidden border-2 border-white/20 bg-black/40 backdrop-blur-sm p-1">
              <Image
                src={logo}
                alt={`${event.name} logo`}
                fill
                className="object-contain"
                sizes="40px"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-sm font-black text-white leading-tight mb-1">
            {event.name}
          </h3>
          {event.shortDescription && (
            <p className="text-[11px] opacity-50 text-white leading-5 line-clamp-2 mb-3">
              {event.shortDescription}
            </p>
          )}

          {/* Countdown */}
          {t && event.status === "active" && (
            <div
              className="flex items-center gap-2 text-[11px] font-black py-2 px-3 rounded-lg mb-3"
              style={{ background: `${primaryColor}22`, color: primaryColor }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M12 6v6l4 2" />
              </svg>
              <span>
                {t.days > 0 && `${t.days} روز و `}
                {String(t.hours).padStart(2, "0")}:{String(t.minutes).padStart(2, "0")} باقی‌مانده
              </span>
            </div>
          )}

          {/* CTA */}
          <div
            className="flex items-center justify-between text-xs font-black"
            style={{ color: primaryColor }}
          >
            <span>مشاهده Collection</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 group-hover:-translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>

        {/* Hover glow */}
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ boxShadow: `inset 0 0 40px ${primaryColor}18` }}
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  );
}
