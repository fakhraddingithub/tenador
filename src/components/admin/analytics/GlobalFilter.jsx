"use client";

import { useState, useMemo, useCallback } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { CalendarRange, RefreshCw, Check } from "lucide-react";
import { faDate } from "./format";

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

// محاسبه‌ی بازه‌ی شمسی با fallback میلادی در صورت خطا
function jalali(fn, fallback) {
  try { return fn(); } catch { return fallback(); }
}

function presetRange(key, now = new Date()) {
  switch (key) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now.getTime() - DAY);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "last7":
      return { from: startOfDay(new Date(now.getTime() - 6 * DAY)), to: endOfDay(now) };
    case "last30":
      return { from: startOfDay(new Date(now.getTime() - 29 * DAY)), to: endOfDay(now) };
    case "thisMonth":
      return jalali(
        () => {
          const d = new DateObject({ calendar: persian }).toFirstOfMonth();
          return { from: startOfDay(d.toDate()), to: endOfDay(now) };
        },
        () => ({ from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) })
      );
    case "lastMonth":
      return jalali(
        () => {
          const thisStart = new DateObject({ calendar: persian }).toFirstOfMonth();
          const prevStart = new DateObject(thisStart).add(-1, "month");
          return { from: startOfDay(prevStart.toDate()), to: new Date(startOfDay(thisStart.toDate()).getTime() - 1) };
        },
        () => ({ from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: new Date(startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)).getTime() - 1) })
      );
    case "thisQuarter":
      return jalali(
        () => {
          const d = new DateObject({ calendar: persian });
          const qStart = Math.floor((d.month.number - 1) / 3) * 3 + 1;
          d.month = qStart; d.day = 1;
          return { from: startOfDay(d.toDate()), to: endOfDay(now) };
        },
        () => ({ from: startOfDay(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), to: endOfDay(now) })
      );
    case "lastQuarter":
      return jalali(
        () => {
          const d = new DateObject({ calendar: persian });
          const qStart = Math.floor((d.month.number - 1) / 3) * 3 + 1;
          d.month = qStart; d.day = 1;
          const thisQStart = startOfDay(d.toDate());
          const prev = new DateObject(d).add(-3, "month");
          return { from: startOfDay(prev.toDate()), to: new Date(thisQStart.getTime() - 1) };
        },
        () => {
          const qs = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          return { from: startOfDay(new Date(qs.getFullYear(), qs.getMonth() - 3, 1)), to: new Date(startOfDay(qs).getTime() - 1) };
        }
      );
    case "thisYear":
      return jalali(
        () => {
          const d = new DateObject({ calendar: persian }).toFirstOfYear();
          return { from: startOfDay(d.toDate()), to: endOfDay(now) };
        },
        () => ({ from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(now) })
      );
    case "lastYear":
      return jalali(
        () => {
          const thisStart = new DateObject({ calendar: persian }).toFirstOfYear();
          const prevStart = new DateObject(thisStart).add(-1, "year");
          return { from: startOfDay(prevStart.toDate()), to: new Date(startOfDay(thisStart.toDate()).getTime() - 1) };
        },
        () => ({ from: startOfDay(new Date(now.getFullYear() - 1, 0, 1)), to: new Date(startOfDay(new Date(now.getFullYear(), 0, 1)).getTime() - 1) })
      );
    default:
      return { from: startOfDay(new Date(now.getTime() - 29 * DAY)), to: endOfDay(now) };
  }
}

export { presetRange };

const PRESETS = [
  { key: "today", label: "امروز" },
  { key: "yesterday", label: "دیروز" },
  { key: "last7", label: "۷ روز اخیر" },
  { key: "last30", label: "۳۰ روز اخیر" },
  { key: "thisMonth", label: "این ماه" },
  { key: "lastMonth", label: "ماه گذشته" },
  { key: "thisQuarter", label: "این فصل" },
  { key: "lastQuarter", label: "فصل گذشته" },
  { key: "thisYear", label: "امسال" },
  { key: "lastYear", label: "سال گذشته" },
];

export default function GlobalFilter({ preset, range, onChange, onRefresh, loading }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState(null);

  const selectPreset = useCallback((key) => {
    setCustomOpen(false);
    onChange({ preset: key, range: presetRange(key) });
  }, [onChange]);

  const applyCustom = useCallback((vals) => {
    setCustomValue(vals);
    if (Array.isArray(vals) && vals.length === 2 && vals[0] && vals[1]) {
      const from = startOfDay(vals[0].toDate());
      const to = endOfDay(vals[1].toDate());
      onChange({ preset: "custom", range: { from, to } });
    }
  }, [onChange]);

  const rangeLabel = useMemo(
    () => (range ? `${faDate(range.from)} تا ${faDate(range.to)}` : ""),
    [range]
  );

  return (
    <div className="bg-white rounded-2xl border border-[var(--admin-border,#e8e4df)] p-3 sm:p-4 space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <CalendarRange size={15} className="text-[#aa4725]" />
          <span>{rangeLabel}</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600
            hover:border-[#aa4725] hover:text-[#aa4725] text-xs font-bold px-3 py-1.5 rounded-xl transition disabled:opacity-60"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          بروزرسانی
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition
              ${preset === p.key ? "bg-[#aa4725] text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:border-[#aa4725]/40"}`}
          >
            {p.label}
          </button>
        ))}

        <div className="relative">
          <button
            onClick={() => setCustomOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition
              ${preset === "custom" ? "bg-[#aa4725] text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:border-[#aa4725]/40"}`}
          >
            <CalendarRange size={13} /> بازه دلخواه
          </button>
          {customOpen && (
            <div className="absolute z-50 mt-2 right-0 bg-white rounded-xl border border-gray-200 shadow-xl p-3">
              <DatePicker
                value={customValue}
                onChange={applyCustom}
                range
                calendar={persian}
                locale={persian_fa}
                calendarPosition="bottom-right"
                className="rmdp-prime"
              />
              <button
                onClick={() => setCustomOpen(false)}
                className="mt-2 w-full flex items-center justify-center gap-1.5 bg-[#aa4725] text-white text-xs font-bold py-1.5 rounded-lg"
              >
                <Check size={13} /> تأیید
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
