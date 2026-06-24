"use client";

import { memo } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, AlertTriangle, Crown,
  FolderTree, Tag, Package, Flame,
} from "lucide-react";
import { Skeleton } from "./primitives";

const TONE = {
  success: { bg: "bg-green-50", border: "border-green-100", text: "text-green-700", icon: "text-green-500" },
  info: { bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-700", icon: "text-blue-500" },
  warning: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-700", icon: "text-amber-500" },
  danger: { bg: "bg-red-50", border: "border-red-100", text: "text-red-700", icon: "text-red-500" },
};

const ICON = {
  peak: Flame,
  category: FolderTree,
  customer: Crown,
  receivable: AlertTriangle,
  trend: TrendingUp,
  brand: Tag,
  product: Package,
};

function InsightCards({ insights = [], loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }
  if (!insights.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {insights.map((ins, i) => {
        const tone = TONE[ins.tone] || TONE.info;
        let Icon = ICON[ins.type] || Sparkles;
        if (ins.type === "trend" && ins.tone === "danger") Icon = TrendingDown;
        return (
          <div key={i} className={`flex items-start gap-2.5 rounded-xl border p-3 ${tone.bg} ${tone.border}`}>
            <div className={`w-7 h-7 rounded-lg bg-white/70 flex items-center justify-center flex-shrink-0 ${tone.icon}`}>
              <Icon size={15} />
            </div>
            <p className={`text-[12px] font-medium leading-relaxed ${tone.text}`}>{ins.text}</p>
          </div>
        );
      })}
    </div>
  );
}

export default memo(InsightCards);
