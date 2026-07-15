"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiX, FiSliders, FiRotateCcw } from "react-icons/fi";
import { COLOR_PALETTE } from "@/lib/colorMatch";

/**
 * نوارِ جستجو و فیلترِ انتخابِ محصول — بالای شبکه‌ی محصولات در مراحلِ
 * «انتخاب از دسته‌بندی» مودالِ فرایند سفارش (CategoryNodeStep).
 *
 * کاملاً presentational است؛ state جستجو/فیلتر و منطقِ فیلترکردن در والد
 * نگه‌داری می‌شود تا هنگام باز/بسته شدنِ پنل چیزی از دست نرود.
 *
 * props:
 *  - searchTerm / onSearchChange   متن جستجو (کنترل‌شده)
 *  - groups          [{ id, label, type: 'chips'|'color', options: [{value,label,count}] }]
 *  - filters         { [groupId]: [value, ...] } — چندانتخابی
 *  - onFiltersChange (nextFilters) => void
 *  - resultCount / totalCount   برای نمایش «X از Y محصول»
 */

const toggleValue = (arr = [], v) =>
  arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

export default function ProductPickerToolbar({
  searchTerm = "",
  onSearchChange,
  groups = [],
  filters = {},
  onFiltersChange,
  resultCount = 0,
  totalCount = 0,
}) {
  const [open, setOpen] = useState(false);

  const activeCount = useMemo(
    () =>
      Object.values(filters).reduce(
        (n, sel) => n + (Array.isArray(sel) ? sel.length : 0),
        0,
      ),
    [filters],
  );

  // چیپ‌های فیلترِ فعال — با برچسبِ خوانا از روی گزینه‌های هر گروه
  const activeChips = useMemo(() => {
    const chips = [];
    for (const g of groups) {
      const sel = filters[g.id];
      if (!Array.isArray(sel)) continue;
      for (const v of sel) {
        const opt = (g.options || []).find((o) => o.value === v);
        chips.push({
          groupId: g.id,
          value: v,
          groupLabel: g.label,
          label: opt?.label || v,
        });
      }
    }
    return chips;
  }, [groups, filters]);

  const setGroupSelection = (groupId, nextSel) => {
    const next = { ...filters };
    if (nextSel.length) next[groupId] = nextSel;
    else delete next[groupId];
    onFiltersChange?.(next);
  };

  const removeChip = (chip) =>
    setGroupSelection(
      chip.groupId,
      (filters[chip.groupId] || []).filter((v) => v !== chip.value),
    );

  const clearAll = () => onFiltersChange?.({});

  const isFiltering = activeCount > 0 || searchTerm.trim() !== "";
  const hasGroups = groups.length > 0;

  return (
    <div className="shrink-0 mb-3 space-y-2">
      {/* ─── ردیف جستجو + دکمه‌ی فیلتر ─── */}
      <div className="flex items-center gap-2">
        <div className="relative grow">
          <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="جستجوی محصول…"
            aria-label="جستجوی محصول"
            className="w-full h-9 rounded-[6px] border border-gray-200 bg-gray-50/60 pr-9 pl-8 text-xs text-[#0d0d0d] placeholder:text-gray-400 focus:outline-none focus:border-[#aa4725] focus:bg-white transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              aria-label="پاک کردن جستجو"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <FiX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {hasGroups && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`relative flex items-center gap-1.5 h-9 px-3 rounded-[6px] border text-xs font-medium transition-colors shrink-0 ${
              open || activeCount > 0
                ? "border-[#aa4725] text-[#aa4725] bg-[#ffbf00]/10"
                : "border-gray-200 text-gray-600 hover:border-[#aa4725]/50 hover:text-[#aa4725]"
            }`}
          >
            <FiSliders className="w-3.5 h-3.5" />
            فیلتر
            {activeCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#aa4725] text-white text-[9px] font-bold flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ─── پنل فیلترها (بازشونده) ─── */}
      <AnimatePresence initial={false}>
        {open && hasGroups && (
          <motion.div
            key="filter-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="rounded-[6px] border border-gray-200 bg-gray-50/60 p-3 space-y-3 max-h-52 overflow-y-auto">
              {groups.map((group) => {
                const selected = filters[group.id] || [];
                return (
                  <div key={group.id} className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
                      <span className="w-1 h-3 bg-[#aa4725] rounded-full" />
                      {group.label}
                      {selected.length > 0 && (
                        <span className="text-[9px] text-[#aa4725]">
                          ({selected.length})
                        </span>
                      )}
                    </span>

                    {group.type === "color" ? (
                      // گریدِ سواچ‌های رنگ — همان پالتِ ثابتِ ۱۶ رنگِ فیلترهای سایت
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {COLOR_PALETTE.map((c) => {
                          const active = selected.includes(c.name);
                          return (
                            <button
                              key={c.name}
                              type="button"
                              title={c.name}
                              aria-label={c.name}
                              aria-pressed={active}
                              onClick={() =>
                                setGroupSelection(
                                  group.id,
                                  toggleValue(selected, c.name),
                                )
                              }
                              className={`w-6 h-6 rounded-full transition-all ${
                                active
                                  ? "ring-2 ring-offset-1 ring-[#aa4725] border border-white"
                                  : "border border-gray-200 hover:scale-110"
                              }`}
                              style={{ background: c.hex }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(group.options || []).map((opt) => {
                          const active = selected.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              title={opt.label}
                              aria-pressed={active}
                              onClick={() =>
                                setGroupSelection(
                                  group.id,
                                  toggleValue(selected, opt.value),
                                )
                              }
                              className={`h-7 px-2.5 rounded-md text-[11px] font-medium border max-w-[140px] truncate transition-colors ${
                                active
                                  ? "bg-[#aa4725] border-[#aa4725] text-white"
                                  : "bg-white border-gray-200 text-gray-600 hover:border-[#aa4725]/50"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── چیپ‌های فیلترِ فعال + شمارنده‌ی نتایج ─── */}
      {isFiltering && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-400 ml-0.5">
            {resultCount} از {totalCount} محصول
          </span>
          {activeChips.map((chip) => (
            <button
              key={`${chip.groupId}:${chip.value}`}
              type="button"
              onClick={() => removeChip(chip)}
              title={`حذف فیلتر ${chip.groupLabel}: ${chip.label}`}
              className="flex items-center gap-1 h-6 px-2 rounded-full bg-[#ffbf00]/10 border border-[#aa4725]/25 text-[10px] font-medium text-[#aa4725] hover:bg-[#ffbf00]/20 transition-colors max-w-[150px]"
            >
              <span className="truncate">{chip.label}</span>
              <FiX className="w-3 h-3 shrink-0" />
            </button>
          ))}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-medium text-gray-400 hover:text-[#aa4725] transition-colors"
            >
              <FiRotateCcw className="w-3 h-3" />
              حذف همه
            </button>
          )}
        </div>
      )}
    </div>
  );
}
