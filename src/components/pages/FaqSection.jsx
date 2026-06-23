"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import Reveal from "./Reveal";
import { SectionHeading } from "./sections";

/**
 * FaqSection — آکاردئونِ پرسش‌های متداول با تب دسته‌بندی و جست‌وجوی زنده.
 */
export default function FaqSection({ block, accent }) {
  const items = useMemo(() => block.items || [], [block.items]);
  const categories = useMemo(
    () => (block.categories || []).filter(Boolean),
    [block.categories]
  );

  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const matchCat = active === "all" || it.category === active;
      const matchQ =
        !q ||
        String(it.question || "").toLowerCase().includes(q) ||
        String(it.answer || "").toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [items, active, query]);

  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <Reveal>
          <SectionHeading
            eyebrow={block.eyebrow}
            title={block.title}
            subtitle={block.subtitle}
            accent={accent}
          />
        </Reveal>

        {/* جست‌وجو */}
        <Reveal delay={0.05} className="mb-6">
          <div className="relative">
            <Search
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجو در پرسش‌ها…"
              aria-label="جست‌وجو در پرسش‌های متداول"
              className="w-full rounded-[6px] border-2 border-gray-200 bg-white pr-12 pl-4 py-3.5 text-sm font-medium outline-none transition-all focus:bg-white"
              style={{ "--tw-ring-color": accent }}
              onFocus={(e) => (e.target.style.borderColor = accent)}
              onBlur={(e) => (e.target.style.borderColor = "")}
            />
          </div>
        </Reveal>

        {/* تب‌های دسته‌بندی */}
        {categories.length > 0 ? (
          <Reveal delay={0.1} className="mb-8 flex flex-wrap gap-2">
            <TabButton
              label="همه"
              isActive={active === "all"}
              accent={accent}
              onClick={() => setActive("all")}
            />
            {categories.map((cat) => (
              <TabButton
                key={cat}
                label={cat}
                isActive={active === cat}
                accent={accent}
                onClick={() => setActive(cat)}
              />
            ))}
          </Reveal>
        ) : null}

        {/* لیست آکاردئون */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-12 font-medium">
              پرسشی مطابق جست‌وجوی شما یافت نشد.
            </p>
          ) : (
            filtered.map((it, i) => {
              const id = `${it.question}-${i}`;
              const isOpen = openId === id;
              return (
                <div
                  key={id}
                  className="rounded-[6px] border border-gray-100 bg-white overflow-hidden shadow-sm"
                  style={{ borderColor: isOpen ? accent : "#eee" }}
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-right"
                  >
                    <span className="font-bold text-[var(--color-text)] text-[15px] leading-7">
                      {it.question}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex-shrink-0"
                      style={{ color: isOpen ? accent : "#9ca3af" }}
                    >
                      <ChevronDown size={20} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-gray-500 leading-8">
                          {it.answer}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function TabButton({ label, isActive, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-[6px] text-sm font-bold transition-all"
      style={
        isActive
          ? { background: accent, color: "#fff" }
          : {
              background: `color-mix(in srgb, ${accent} 8%, white)`,
              color: accent,
            }
      }
    >
      {label}
    </button>
  );
}
