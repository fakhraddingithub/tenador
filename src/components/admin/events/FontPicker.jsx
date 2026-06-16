"use client";

import { useState, useRef, useEffect } from "react";
import { EVENT_FONTS, DEFAULT_FONT } from "@/lib/eventFonts";

/**
 * Font picker that previews each option in its own typeface.
 *
 * Built as a custom dropdown (not a native <select>) because browsers won't
 * reliably render <option> text in a custom font-family. The open panel is
 * absolutely positioned inside a relative wrapper and capped with max-height +
 * internal scroll, so it always stays inside the layout and never overflows.
 */
export default function FontPicker({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected =
    EVENT_FONTS.find((f) => f.value === value) ||
    EVENT_FONTS.find((f) => f.value === DEFAULT_FONT);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="space-y-1" ref={wrapRef}>
      {label && (
        <p className="text-[10px] font-black text-gray-500 uppercase">{label}</p>
      )}

      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 bg-white/5 border border-white/10 text-white text-sm px-3 py-2 rounded-lg hover:border-white/30 focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
        >
          <span
            className="truncate"
            style={{ fontFamily: `'${selected.value}', Vazirmatn, sans-serif` }}
          >
            {selected.label}
          </span>
          <svg
            className={`w-3.5 h-3.5 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Panel — contained: absolute, full-width, capped height with scroll */}
        {open && (
          <ul
            role="listbox"
            className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl py-1"
          >
            {EVENT_FONTS.map((font) => {
              const isActive = font.value === selected.value;
              return (
                <li key={font.value} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(font.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-right transition-colors ${
                      isActive ? "bg-[var(--color-primary)]/10" : "hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className="text-base text-gray-900 truncate"
                      style={{ fontFamily: `'${font.value}', Vazirmatn, sans-serif` }}
                    >
                      {font.sample}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 shrink-0">
                      {font.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
