"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { FaFileAlt, FaExternalLinkAlt, FaPen } from "react-icons/fa";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export default function PagesList() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/pages", { credentials: "include" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPages(data.pages || []);
      } catch {
        toast.error("خطا در بارگذاری فهرست صفحات");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
          <FaFileAlt className="text-[var(--color-primary)]" /> صفحات سایت
        </h1>
        <p className="text-sm text-gray-400 font-bold mt-1">
          محتوای صفحات اطلاع‌رسانی را ویرایش کنید.
        </p>
      </div>

      {loading ? (
        <div className="py-24 text-center text-gray-400 font-bold">
          در حال بارگذاری…
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {pages.map((p, i) => (
            <motion.div
              key={p.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-black text-gray-800">{p.title}</h2>
                  <p className="text-xs text-gray-400 font-bold mt-0.5">/{p.slug}</p>
                </div>
                <span
                  className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${
                    p.published
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}
                >
                  {p.published ? "منتشرشده" : "پیش‌نویس"}
                </span>
              </div>

              <p className="text-[11px] text-gray-400 font-bold mb-4">
                {p.hasCustomContent
                  ? `آخرین ویرایش: ${formatDate(p.updatedAt)}`
                  : "محتوای پیش‌فرض"}
              </p>

              <div className="flex items-center gap-2">
                <Link
                  href={`/p-admin/admin-pages/${p.slug}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-black transition-all hover:brightness-110"
                  style={{ background: "var(--color-primary)" }}
                >
                  <FaPen size={11} /> ویرایش
                </Link>
                <a
                  href={`/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs font-bold text-gray-600 hover:text-[var(--color-primary)] transition-colors"
                >
                  <FaExternalLinkAlt size={10} /> مشاهده
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
