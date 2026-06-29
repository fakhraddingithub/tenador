"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiTrash2, FiLoader, FiCheckCircle, FiPackage } from "react-icons/fi";
import { MdOutlineDragIndicator } from "react-icons/md";
import { showToast } from "@/lib/toast";

/**
 * مدیریتِ یک اسلایدرِ محصولِ صفحه‌ی اصلی:
 *  - جستجوی محصول با نام (autocomplete با debounce؛ از /api/admin/discounts/search)
 *  - افزودن بدون تکرار
 *  - جابه‌جایی با کشیدن و رها کردن (@hello-pangea/dnd)
 *  - ذخیره‌ی خودکار (optimistic + بازگردانی در صورت خطا)
 *
 * @param {"bestsellers"|"offers"} sliderKey
 * @param {Array<{_id,label,sub,image}>} initialItems
 */
export default function ProductSliderManager({
  sliderKey,
  title,
  subtitle,
  initialItems = [],
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const wrapRef = useRef(null);
  const timer = useRef(null);
  const lastSaved = useRef(initialItems); // برای بازگردانی هنگام خطا

  // بستن دراپ‌داون با کلیک بیرون
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ذخیره‌ی فهرستِ مرتب در سرور
  const persist = useCallback(
    async (nextItems) => {
      setSaving(true);
      try {
        const res = await fetch("/api/admin/home-sliders", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slider: sliderKey,
            productIds: nextItems.map((i) => i._id),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "خطا در ذخیره");
        // سرور فهرستِ پاک‌سازی‌شده (بدون محصولاتِ حذف‌شده) را برمی‌گرداند
        const serverItems = Array.isArray(data.items) ? data.items : nextItems;
        lastSaved.current = serverItems;
        setItems(serverItems);
      } catch (err) {
        // بازگردانی به آخرین وضعیتِ ذخیره‌شده
        setItems(lastSaved.current);
        showToast.error(err.message || "ذخیره ناموفق بود");
      } finally {
        setSaving(false);
      }
    },
    [sliderKey]
  );

  const runSearch = useCallback(async (q) => {
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/discounts/search?type=product&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setResults(data.items || []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onQueryChange = (val) => {
    setQuery(val);
    clearTimeout(timer.current);
    if (!val.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => runSearch(val.trim()), 300);
  };

  const addProduct = (item) => {
    const id = String(item._id);
    // جلوگیری از افزودنِ تکراری به همین اسلایدر
    if (items.some((p) => p._id === id)) {
      showToast.info("این محصول قبلاً اضافه شده است");
      return;
    }
    const next = [
      ...items,
      { _id: id, label: item.label, sub: item.sub || "", image: item.image || null },
    ];
    setItems(next);
    setQuery("");
    setResults([]);
    setOpen(false);
    persist(next);
  };

  const removeProduct = (id) => {
    const next = items.filter((p) => p._id !== id);
    setItems(next);
    persist(next);
  };

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const next = Array.from(items);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setItems(next);
    persist(next);
  };

  return (
    <div
      dir="rtl"
      className="bg-white rounded-2xl border shadow-sm overflow-hidden"
      style={{ borderColor: "#e8e4df" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-4 border-b"
        style={{ borderColor: "#f0ede9" }}
      >
        <div className="min-w-0">
          <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
          {subtitle && (
            <p className="text-xs font-bold text-gray-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(170,71,37,0.08)", color: "var(--color-primary)" }}
          >
            {items.length} محصول
          </span>
          <AnimatePresence mode="wait">
            {saving ? (
              <motion.span
                key="saving"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 text-[11px] font-bold text-gray-400"
              >
                <FiLoader className="animate-spin" size={12} /> ذخیره...
              </motion.span>
            ) : (
              <motion.span
                key="saved"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 text-[11px] font-bold text-green-500"
              >
                <FiCheckCircle size={12} /> ذخیره شد
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Search */}
        <div className="relative" ref={wrapRef}>
          <FiSearch
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => query && results.length && setOpen(true)}
            autoComplete="off"
            placeholder="جستجوی محصول با نام..."
            className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl pr-9 pl-3 py-2.5 text-sm font-bold text-gray-800 outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:bg-white transition-all"
          />
          {searching && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
              جستجو...
            </span>
          )}

          {open && (
            <ul className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-2xl">
              {results.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-400 text-center font-bold">
                  موردی یافت نشد
                </li>
              ) : (
                results.map((item) => {
                  const already = items.some((p) => p._id === String(item._id));
                  return (
                    <li key={String(item._id)}>
                      <button
                        type="button"
                        disabled={already}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (!already) addProduct(item);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-50 last:border-none text-right transition-colors ${
                          already
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-gray-50 cursor-pointer"
                        }`}
                      >
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover shrink-0 bg-gray-100"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-gray-300">
                            <FiPackage size={15} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-800 truncate">{item.label}</p>
                          {item.sub && (
                            <p className="text-[11px] text-gray-400 font-bold truncate">{item.sub}</p>
                          )}
                        </div>
                        {already && (
                          <span className="text-[10px] font-bold text-green-500 flex-shrink-0">
                            افزوده‌شده
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>

        {/* Selected products — sortable */}
        {items.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-12 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3 text-gray-300">
              <FiPackage size={22} />
            </div>
            <p className="text-gray-400 font-bold text-xs">
              هنوز محصولی اضافه نشده — با جستجوی بالا محصول اضافه کنید
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId={`slider-${sliderKey}`}>
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {items.map((p, index) => (
                    <Draggable key={p._id} draggableId={p._id} index={index}>
                      {(prov, snapshot) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className={`bg-white rounded-xl border-2 flex items-center gap-3 p-2.5 transition-all ${
                            snapshot.isDragging
                              ? "border-[var(--color-primary)] shadow-2xl"
                              : "border-gray-100 hover:border-gray-200"
                          }`}
                        >
                          <div
                            {...prov.dragHandleProps}
                            className="text-gray-300 hover:text-gray-500 p-0.5 cursor-grab active:cursor-grabbing flex-shrink-0"
                            aria-label="جابه‌جایی"
                          >
                            <MdOutlineDragIndicator size={20} />
                          </div>

                          <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center text-[10px] font-bold text-gray-400">
                            {index + 1}
                          </div>

                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image}
                              alt=""
                              className="w-11 h-11 rounded-lg object-cover flex-shrink-0 bg-gray-100 border border-gray-100"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300">
                              <FiPackage size={16} />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{p.label}</p>
                            {p.sub && (
                              <p className="text-[11px] text-gray-400 font-bold truncate mt-0.5">
                                {p.sub}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeProduct(p._id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex-shrink-0"
                            aria-label={`حذف ${p.label}`}
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}
