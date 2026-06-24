"use client";

import { memo, useState, useMemo } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Treemap,
} from "recharts";
import { FolderTree, Tag } from "lucide-react";
import { ChartCard, EmptyState } from "./primitives";
import { fa, compactToman, CATEGORICAL } from "./format";

function ShareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload || {};
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-1.5 text-xs" dir="rtl">
      <p className="font-bold text-gray-700">{p.name}</p>
      <p className="text-gray-500">درآمد: <span className="font-bold text-gray-800">{fa(p.revenue ?? p.value)} تومان</span></p>
      {p.share != null && <p className="text-gray-500">سهم: <span className="font-bold">{fa(p.share)}٪</span></p>}
    </div>
  );
}

// محتوای سفارشیِ سلولِ Treemap
function TreemapCell(props) {
  const { x, y, width, height, index, name, share } = props;
  const color = CATEGORICAL[index % CATEGORICAL.length];
  const showLabel = width > 54 && height > 28;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={color} stroke="#fff" strokeWidth={2} />
      {showLabel && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={11} fontWeight={700}>
          <tspan x={x + width / 2} dy="-0.3em">{name}</tspan>
          <tspan x={x + width / 2} dy="1.3em" fontSize={10} fillOpacity={0.85}>{fa(share)}٪</tspan>
        </text>
      )}
    </g>
  );
}

function CategoryCard({ categories = [], loading }) {
  const [view, setView] = useState("treemap");
  const data = useMemo(() => categories.map((c) => ({ name: c.name, value: c.revenue, revenue: c.revenue, share: c.share })), [categories]);
  const empty = !loading && data.length === 0;

  return (
    <ChartCard
      icon={FolderTree}
      title="تحلیل دسته‌بندی‌ها"
      subtitle="سهمِ درآمدِ هر دسته"
      action={
        <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
          {[{ k: "treemap", l: "نقشه" }, { k: "pie", l: "دایره‌ای" }].map((v) => (
            <button key={v.k} onClick={() => setView(v.k)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${view === v.k ? "bg-white text-[#aa4725] shadow-sm" : "text-gray-400"}`}>
              {v.l}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="h-64 animate-pulse bg-gray-50 rounded-xl" />
      ) : empty ? (
        <EmptyState title="فروشی به تفکیک دسته نیست" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          {view === "treemap" ? (
            <Treemap data={data} dataKey="value" nameKey="name" content={<TreemapCell />} isAnimationActive={false}>
              <Tooltip content={<ShareTooltip />} />
            </Treemap>
          ) : (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />)}
              </Pie>
              <Tooltip content={<ShareTooltip />} />
            </PieChart>
          )}
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function BrandCard({ brands = [], loading }) {
  const empty = !loading && brands.length === 0;
  const max = brands[0]?.revenue || 1;

  return (
    <ChartCard icon={Tag} title="تحلیل برندها" subtitle="سهمِ بازار و درآمدِ هر برند">
      {loading ? (
        <div className="h-64 animate-pulse bg-gray-50 rounded-xl" />
      ) : empty ? (
        <EmptyState title="فروشی به تفکیک برند نیست" />
      ) : (
        <div className="space-y-2">
          {brands.slice(0, 8).map((b, i) => (
            <div key={b.name || i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-gray-700 truncate">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CATEGORICAL[i % CATEGORICAL.length] }} />
                  {b.name}
                </span>
                <span className="font-black text-gray-800 flex-shrink-0">{compactToman(b.revenue)} <span className="text-[10px] text-gray-400">({fa(b.share)}٪)</span></span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(b.revenue / max) * 100}%`, background: CATEGORICAL[i % CATEGORICAL.length] }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

function CategoryBrandAnalytics({ categories, brands, loading }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CategoryCard categories={categories} loading={loading} />
      <BrandCard brands={brands} loading={loading} />
    </div>
  );
}

export default memo(CategoryBrandAnalytics);
