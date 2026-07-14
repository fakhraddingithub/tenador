"use client";

import { useEffect, useRef, useState } from "react";
import { FiCheck, FiCopy, FiLink, FiSend } from "react-icons/fi";

export default function ArticleReadingTools({ headings = [], title, url }) {
  const progressRef = useRef(null);
  const [active, setActive] = useState(headings[0]?.id || "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const article = document.querySelector("[data-article-body]");
        if (!article) return;
        const rect = article.getBoundingClientRect();
        const distance = Math.max(1, article.offsetHeight - window.innerHeight);
        const progress = Math.min(100, Math.max(0, ((-rect.top + 120) / distance) * 100));
        if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress / 100})`;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  useEffect(() => {
    const nodes = headings.map((heading) => document.getElementById(heading.id)).filter(Boolean);
    if (!nodes.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-15% 0px -70% 0px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [headings]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function share() {
    if (navigator.share) await navigator.share({ title, url });
    else await copyLink();
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[70] h-1 bg-transparent" aria-hidden="true">
        <div ref={progressRef} className="h-full origin-right scale-x-0 bg-[var(--color-primary)] transition-transform duration-100 motion-reduce:transition-none" />
      </div>
      <aside className="space-y-5 lg:sticky lg:top-28">
        {headings.length ? (
          <nav aria-label="فهرست مقاله" className="rounded-[var(--radius)] border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-black text-gray-900">در این مقاله</h2>
            <ol className="space-y-2 border-r border-gray-200 pr-3 text-sm">
              {headings.map((heading) => (
                <li key={heading.id} className={heading.level === "h3" || heading.level === "h4" ? "pr-3" : ""}>
                  <a href={`#${heading.id}`} className={`block leading-6 transition-colors ${active === heading.id ? "font-bold text-[var(--color-primary)]" : "text-gray-500 hover:text-gray-900"}`}>{heading.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="flex gap-2 rounded-[var(--radius)] border border-black/10 bg-white p-3 shadow-sm">
          <button type="button" onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]" aria-label="اشتراک‌گذاری مقاله"><FiSend /> اشتراک</button>
          <button type="button" onClick={copyLink} className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]" aria-label="کپی پیوند مقاله">{copied ? <FiCheck className="text-green-600" /> : <FiCopy />} {copied ? "کپی شد" : "کپی لینک"}</button>
        </div>
        <div className="flex justify-center gap-4 text-sm text-gray-500">
          <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noreferrer" className="hover:text-[var(--color-primary)]"><FiSend aria-hidden="true" /><span className="sr-only">تلگرام</span></a>
          <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noreferrer" className="hover:text-[var(--color-primary)]"><FiLink aria-hidden="true" /><span className="sr-only">ایکس</span></a>
        </div>
      </aside>
    </>
  );
}

