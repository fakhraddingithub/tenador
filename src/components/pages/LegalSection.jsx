"use client";

import { useEffect, useRef, useState } from "react";
import Reveal from "./Reveal";

/**
 * LegalSection — سند حقوقیِ زیبا: بندهای شماره‌دار + فهرستِ چسبانِ کناری (دسکتاپ)
 * با اسکرولِ نرم و هایلایتِ بندِ فعال (scroll-spy).
 */
export default function LegalSection({ block, accent }) {
  const items = block.items || [];
  const [activeIdx, setActiveIdx] = useState(0);
  const refs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.idx);
            if (!Number.isNaN(idx)) setActiveIdx(idx);
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  const scrollTo = (idx) => {
    const el = refs.current[idx];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <section className="py-14 sm:py-20">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        {block.intro ? (
          <Reveal className="max-w-3xl mb-12">
            <p className="text-lg leading-9 text-gray-500">{block.intro}</p>
          </Reveal>
        ) : null}

        <div className="grid lg:grid-cols-[260px_1fr] gap-10">
          {/* TOC — چسبان روی دسکتاپ */}
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <p
                className="text-xs font-black mb-4 tracking-wide"
                style={{ color: accent }}
              >
                فهرست بندها
              </p>
              <nav className="space-y-1 border-r-2 border-gray-100 pr-3">
                {items.map((it, i) => (
                  <button
                    key={i}
                    onClick={() => scrollTo(i)}
                    className="block w-full text-right text-sm py-1.5 transition-all font-medium"
                    style={
                      activeIdx === i
                        ? { color: accent, fontWeight: 800 }
                        : { color: "#9ca3af" }
                    }
                  >
                    {toFa(i + 1)}. {it.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* بندها */}
          <div className="space-y-10 max-w-3xl">
            {items.map((it, i) => (
              <Reveal key={i} y={16}>
                <article
                  data-idx={i}
                  ref={(el) => (refs.current[i] = el)}
                  className="scroll-mt-28"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white"
                      style={{ background: accent }}
                    >
                      {toFa(i + 1)}
                    </span>
                    <h3 className="text-xl font-black text-[var(--color-text)]">
                      {it.title}
                    </h3>
                  </div>
                  <p className="text-gray-500 leading-9 pr-12">{it.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function toFa(n) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
}
