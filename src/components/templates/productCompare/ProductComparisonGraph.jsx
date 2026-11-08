"use client";

import { useState, useEffect, useRef } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { FiSearch, FiPlus, FiTrash2 } from "react-icons/fi";
import Link from "next/link";

/**
 * کامپوننت نمودار مقایسه محصول در صفحه محصول
 * ورودی: technicalStats => { productStats: { ... }, categoryStats: [ {name,label,...}, ... ] }
 *
 * قابلیت‌ها:
 * - نمایش نمودار رادار برای محصول جاری (از technicalStats.productStats)
 * - جستجوی محصول دیگر و افزودنش به نمودار برای مقایسه (تا چند محصول)
 * - استفاده از رنگ محصول اگر موجود باشد (normalizeColor) در غیر این صورت پالت پیش‌فرض
 * - کاهش تعداد تیک‌های پرتردد (tickCount=10)
 * - لیبل پارامترها بیرون از چارت (custom tick)
 */

const PRODUCT_COLORS = ["#aa4725", "#ffbf00", "#0ea5e9", "#10b981", "#8b5cf6", "#ef4444", "#8b5cf6"];

const normalizeColor = (color) => {
  if (!color || typeof color !== "string") return null;
  let c = color.trim();
  if (!c) return null;
  if (/^[0-9A-Fa-f]{6}$/.test(c)) return `#${c}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(c)) return c;
  if (/^rgba?\(/i.test(c)) return c;
  return c;
};

function CustomTick({ x, y, payload, cx, cy, labelOffset }) {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = x + (dx / dist) * labelOffset;
  const ny = y + (dy / dist) * labelOffset;

  let textAnchor = "middle";
  if (Math.abs(dx) > Math.abs(dy)) {
    textAnchor = dx > 0 ? "start" : "end";
  } else {
    textAnchor = "middle";
  }

  return (
    <g>
      <text
        x={nx}
        y={ny}
        textAnchor={textAnchor}
        dominantBaseline="central"
        style={{ fill: "#374151", fontSize: 12, fontWeight: 800, pointerEvents: "none" }}
      >
        {payload.value}
      </text>
    </g>
  );
}

export default function ProductComparisonGraph({ technicalStats = {}, showBars = false }) {
  const [comparisonProducts, setComparisonProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);

  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      return;
    }

    let mounted = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/compare/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        if (!mounted) return;
        setResults(data?.products ?? []);
      } catch (err) {
        console.error("search error", err);
        if (mounted) setResults([]);
      } finally {
        if (mounted) setIsSearching(false);
      }
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const productStats = technicalStats.productStats || {};
  const categoryStats = technicalStats.categoryStats || [];

  const resolveProductColor = (product, fallbackIndex = 0) => {
    const raw =
      product?.color ??
      product?.colour ??
      (product?.meta && (product.meta.color || product.meta.colour)) ??
      null;

    const normalized = normalizeColor(raw);
    if (normalized) return normalized;
    return PRODUCT_COLORS[fallbackIndex % PRODUCT_COLORS.length];
  };

  const buildChartData = () => {
    return categoryStats.map((stat, statIndex) => {
      const subject = stat.label ?? stat.name;
      const curVal = Number(productStats[stat.name] ?? 0);
      const point = { subject, current: curVal, fullMark: stat.max ?? 100 };
      comparisonProducts.forEach((p, idx) => {
        const val = Number(p.productStats?.[stat.name] ?? 0);
        point[`p_${p._id ?? idx}`] = val;
      });
      return point;
    });
  };

  const data = buildChartData();

  const cx = size.width / 2 || 0;
  const cy = size.height / 2 || 0;
  const labelOffset = Math.min(size.width, size.height) * 0.06 || 12;


  const addComparisonProduct = (product) => {
    if (!product) return;
    if (comparisonProducts.find((p) => p._id === product._id)) {
      setSearchQuery("");
      setResults([]);
      return;
    }

    const normalizedProduct = {
      ...product,
      productStats:
        product.productStats ??
        product.technicalStats ??
        (product.technicalStats?.productStats ? product.technicalStats.productStats : undefined) ??
        {},
      color: resolveProductColor(product, comparisonProducts.length + 1),
    };

    setComparisonProducts((prev) => [...prev, normalizedProduct]);
    setSearchQuery("");
    setResults([]);
  };

  const removeComparisonProduct = (id) => {
    setComparisonProducts((prev) => prev.filter((p) => p._id !== id));
  };

  const currentColor = normalizeColor(technicalStats.color) || PRODUCT_COLORS[0];
  
  const renderRadars = () => {
    const items = [];
    items.push(
      <Radar
        key="current"
        name="این محصول"
        dataKey="current"
        stroke={currentColor}
        strokeWidth={2}
        fill={currentColor}
        fillOpacity={0.45}
        dot={{ r: 4, fill: "#ffffff", stroke: currentColor, strokeWidth: 2, fillOpacity: 1 }}
        activeDot={{ r: 6, fill: currentColor, stroke: "#ffffff", strokeWidth: 2 }}
      />
    );

    comparisonProducts.forEach((p, idx) => {
      const key = `p_${p._id ?? idx}`;
      const color = resolveProductColor(p, idx + 1);
      items.push(
        <Radar
          key={key}
          name={p.title ?? p.name ?? `محصول ${idx + 1}`}
          dataKey={key}
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={0.25}
          // اضافه کردن بولت ثابت روی خطوط نمودار مقایسه
          dot={{ r: 4, fill: "#ffffff", stroke: color, strokeWidth: 2, fillOpacity: 1 }}
          activeDot={{ r: 6, fill: color, stroke: "#ffffff", strokeWidth: 2 }}
        />
      );
    });

    return items;
  };

  return (
    <div className="min-w-0 bg-[#fcfcfc] rounded-[6px] p-3 sm:p-6 border border-gray-100 h-full">
      <div className="relative mb-6" ref={searchRef}>
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
          <FiSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="جستجوی محصول برای مقایسه..."
          className="w-full bg-white border border-gray-200 rounded-[6px] py-3 pr-12 pl-4 text-sm font-bold outline-none focus:border-[#aa4725] transition-all"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setResults([]);
            setIsSearching(e.target.value.trim().length >= 2);
          }}
        />

        {searchQuery.trim().length >= 2 && (
          <div className="absolute top-full right-0 w-full mt-2 bg-white border border-neutral-100 rounded-xl shadow-xl z-40 max-h-60 overflow-y-auto">
            {isSearching ? (
              <div className="p-4 text-center text-neutral-400">در حال جستجو...</div>
            ) : results.length > 0 ? (
              <ul className="divide-y">
                {results.map((r) => (
                  <li key={r._id} className="px-3 py-2 hover:bg-neutral-50">
                    <button
                      onClick={() => addComparisonProduct(r)}
                      className="w-full flex items-center gap-3 text-right"
                    >
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-neutral-100 flex-shrink-0">
                        <img src={r.mainImage || r.image || "/placeholder.png"} alt={r.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 text-right">
                        <div className="font-bold text-sm">{r.title || r.name}</div>
                        <div className="text-xs text-neutral-400 mt-1">{r.category?.title}</div>
                      </div>
                      <div className="text-xs text-[var(--color-primary)] font-extrabold">+ افزودن</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-neutral-400">نتیجه‌ای یافت نشد.</div>
            )}
          </div>
        )}
      </div>

      {comparisonProducts.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center mb-4">
          {comparisonProducts.map((p, idx) => (
            <div key={p._id ?? idx} className={`flex items-center gap-2 bg-white border border-neutral-100 px-3 py-2 rounded-xl shadow-sm`}>
              <div className="w-9 h-9 rounded-md overflow-hidden bg-neutral-100 flex-shrink-0">
                <img src={p.mainImage || p.image || "/placeholder.png"} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-bold max-w-[200px] truncate">{p.title || p.name}</div>
              <button onClick={() => removeComparisonProduct(p._id)} className="p-2 rounded-md hover:bg-neutral-50 text-neutral-500">
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={showBars ? "grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2" : "min-w-0"}>
        <div className="min-w-0">
        {showBars && <h3 className="mb-3 text-sm font-bold text-gray-700">نمودار عنکبوتی</h3>}
        <div className="pcg-chart-wrapper h-[360px] sm:h-[420px] w-full min-w-0 bg-white rounded-md">
          <style jsx>{`
            .pcg-chart-wrapper :global(*) {
              outline: none !important;
            }
            .pcg-chart-wrapper :global(*:focus),
            .pcg-chart-wrapper :global(*:focus-visible) {
              outline: none !important;
              box-shadow: none !important;
              border: none !important;
            }
          `}</style>
          <ResponsiveContainer width="100%" height="100%" onResize={(width, height) => setSize({ width, height })}>
            <RadarChart cx="50%" cy="50%" outerRadius={showBars ? "60%" : "78%"} data={data}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={<CustomTick cx={cx} cy={cy} labelOffset={labelOffset} />} tickLine={false} />
              <PolarRadiusAxis angle={90}  ticks={[20, 40, 60, 80, 100]} domain={[0, (categoryStats[0]?.max ?? 100)]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08)",
                  direction: "rtl",
                  fontSize: 13,
                  fontWeight: 800,
                }}
                formatter={(value, name, props) => {
                  const label = props?.payload?.subject ?? "";
                  return [`${value} از ${props?.payload?.fullMark ?? 100}`, label];
                }}
                labelFormatter={(label) => `شاخص: ${label}`}
              />
              {renderRadars()}
              <Legend
                verticalAlign="bottom"
                content={({ payload }) => (
                  <ul
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      flexWrap: "wrap",
                      gap: 16,
                      paddingTop: 12,
                      margin: 0,
                      listStyle: "none",
                    }}
                  >
                    {payload.map((entry, index) => (
                      <li
                        key={`legend-item-${index}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#374151",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: entry.color,
                            flexShrink: 0,
                          }}
                        />
                        {entry.value}
                      </li>
                    ))}
                  </ul>
                )}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        </div>
      {showBars && (
        <div className="min-w-0">
          <h3 className="mb-3 text-sm font-bold text-gray-700">نمودار میله‌ای</h3>
          <div dir="ltr" className="w-full min-w-0 rounded-md bg-white" style={{ height: Math.max(360, data.length * (48 + comparisonProducts.length * 24)) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 16, right: 12, left: 8, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
                <XAxis type="number" domain={[0, categoryStats[0]?.max ?? 100]} tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="subject" width={90} interval={0} tick={{ fill: "#4b5563", fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08)", direction: "rtl", fontSize: 13 }}
                  formatter={(value, name, props) => [`${value} از ${props?.payload?.fullMark ?? 100}`, name]}
                  labelFormatter={(label) => `شاخص: ${label}`}
                />
                <Bar name="این محصول" dataKey="current" fill={currentColor} radius={[0, 4, 4, 0]} maxBarSize={28} />
                {comparisonProducts.map((product, index) => (
                  <Bar key={product._id ?? index} name={product.title ?? product.name ?? `محصول ${index + 1}`} dataKey={`p_${product._id ?? index}`} fill={resolveProductColor(product, index + 1)} radius={[0, 4, 4, 0]} maxBarSize={28} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      </div>

      <div className="mt-6 text-center">
        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tighter">
          تحلیل فنی و مقایسه عملکرد
        </p>
      </div>
    </div>
  );
}
