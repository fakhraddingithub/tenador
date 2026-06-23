"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  FaArrowRight,
  FaArrowUp,
  FaArrowDown,
  FaTrash,
  FaPlus,
  FaChevronDown,
  FaExternalLinkAlt,
  FaSave,
} from "react-icons/fa";
import FieldEditor from "./FieldEditor";
import { BLOCK_TYPES, BLOCK_TYPE_LIST, createEmptyBlock } from "./blockSchema";

export default function PageEditor({ slug }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [published, setPublished] = useState(true);
  const [sections, setSections] = useState([]);
  const [openBlock, setOpenBlock] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pages?slug=${slug}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const { page } = await res.json();
      setTitle(page.title || "");
      setPublished(page.published !== false);
      // اطمینان از وجود id برای هر بلوک (محتوای پیش‌فرض id دارد، اما برای امنیت)
      setSections(
        (page.sections || []).map((b, i) => ({ id: b.id || `b${i}`, ...b }))
      );
    } catch {
      toast.error("خطا در بارگذاری صفحه");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  /* ─── عملیات روی بلوک‌ها ─── */
  const updateBlock = (idx, patch) =>
    setSections((s) => s.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

  const moveBlock = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    setSections((s) => {
      const next = [...s];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    if (openBlock === idx) setOpenBlock(j);
    else if (openBlock === j) setOpenBlock(idx);
  };

  const removeBlock = (idx) => {
    setSections((s) => s.filter((_, i) => i !== idx));
    setOpenBlock(-1);
  };

  const addBlock = (type) => {
    const block = createEmptyBlock(type);
    if (!block) return;
    setSections((s) => [...s, block]);
    setOpenBlock(sections.length);
    setAddOpen(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug, title, sections, published }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در ذخیره");
      toast.success("تغییرات با موفقیت ذخیره شد");
    } catch (err) {
      toast.error(err.message || "ذخیره ناموفق بود");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400 font-bold">
        در حال بارگذاری…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* هدر */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/p-admin/admin-pages"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-[var(--color-primary)] transition-colors"
          >
            <FaArrowRight size={14} />
          </Link>
          <div>
            <h1 className="text-lg font-black text-gray-800">ویرایش صفحه</h1>
            <p className="text-xs text-gray-400 font-bold">/{slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:text-[var(--color-primary)] transition-colors"
          >
            <FaExternalLinkAlt size={11} /> مشاهده‌ی زنده
          </a>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-black transition-all disabled:opacity-60 hover:brightness-110"
            style={{ background: "var(--color-primary)" }}
          >
            <FaSave size={13} />
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      </div>

      {/* تنظیمات صفحه */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              عنوان صفحه (برای پنل)
            </label>
            <input
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span className="text-sm font-bold text-gray-700">منتشرشده</span>
          </label>
        </div>
      </div>

      {/* بلوک‌ها */}
      <div className="space-y-3">
        {sections.map((block, idx) => {
          const def = BLOCK_TYPES[block.type];
          const isOpen = openBlock === idx;
          return (
            <div
              key={block.id || idx}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  onClick={() => setOpenBlock(isOpen ? -1 : idx)}
                  className="flex-1 flex items-center gap-2 text-right"
                >
                  <span
                    className="text-xs font-black px-2 py-1 rounded-md"
                    style={{
                      background: "rgba(170,71,37,0.1)",
                      color: "var(--color-primary)",
                    }}
                  >
                    {def?.label || block.type}
                  </span>
                  <span className="text-sm font-bold text-gray-700 truncate">
                    {block.title || block.text || ""}
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <Ctrl onClick={() => moveBlock(idx, -1)} disabled={idx === 0}>
                    <FaArrowUp size={11} />
                  </Ctrl>
                  <Ctrl
                    onClick={() => moveBlock(idx, 1)}
                    disabled={idx === sections.length - 1}
                  >
                    <FaArrowDown size={11} />
                  </Ctrl>
                  <Ctrl onClick={() => removeBlock(idx)} danger>
                    <FaTrash size={11} />
                  </Ctrl>
                  <button
                    onClick={() => setOpenBlock(isOpen ? -1 : idx)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
                  >
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
                      <FaChevronDown size={12} />
                    </motion.span>
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-5 pt-1 space-y-3.5 border-t border-gray-100">
                      {(def?.fields || []).map((field) => (
                        <FieldEditor
                          key={field.key}
                          field={field}
                          value={block[field.key]}
                          siblingValues={block}
                          onChange={(v) =>
                            updateBlock(idx, { [field.key]: v })
                          }
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* افزودن بلوک */}
      <div className="relative mt-4">
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-black text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
        >
          <FaPlus size={12} /> افزودن بلوک جدید
        </button>
        <AnimatePresence>
          {addOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute z-20 left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-200 shadow-xl p-2 grid grid-cols-2 gap-1.5"
            >
              {BLOCK_TYPE_LIST.map((bt) => (
                <button
                  key={bt.type}
                  onClick={() => addBlock(bt.type)}
                  className="px-3 py-2.5 rounded-lg text-sm font-bold text-gray-600 hover:bg-[rgba(170,71,37,0.08)] hover:text-[var(--color-primary)] transition-colors text-right"
                >
                  {bt.label}
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Ctrl({ children, onClick, disabled, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
        danger
          ? "text-red-500 hover:bg-red-50"
          : "text-gray-500 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

