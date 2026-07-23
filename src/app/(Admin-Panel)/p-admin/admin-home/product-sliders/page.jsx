"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FiArrowRight, FiTrendingUp, FiZap, FiInfo } from "react-icons/fi";
import AdminLoader from "@/components/admin/AdminLoader";
import ProductSliderManager from "@/components/admin/home/ProductSliderManager";

export default function ProductSlidersPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ bestsellers: [], offers: [] });
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/home-sliders");
        const json = await res.json();
        if (!res.ok) throw new Error();
        setData({
          bestsellers: json.bestsellers || [],
          offers: json.offers || [],
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FiTrendingUp style={{ color: "var(--color-secondary)" }} />
          اسلایدرهای محصول صفحه اصلی
        </h1>
        <p className="text-xs font-bold text-gray-400 mt-0.5">
          محصولات هر اسلایدر را با جستجو اضافه و ترتیب آن‌ها را با کشیدن و رها کردن تنظیم کنید
        </p>
      </div>

      {/* Info note */}
      <div
        className="flex items-start gap-2 text-xs font-bold rounded-xl px-3 py-2.5 mb-5 max-w-5xl"
        style={{ background: "#f6f4f1", color: "#7a6f64" }}
      >
        <FiInfo size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          هر اسلایدر فهرست محصولات مستقل خود را دارد. اگر اسلایدری خالی بماند، صفحه‌ی اصلی
          به‌صورت خودکار جدیدترین/تخفیف‌دار محصولات را نمایش می‌دهد. تغییرات بلافاصله ذخیره می‌شوند.
        </span>
      </div>

      {loading ? (
        <AdminLoader />
      ) : error ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-red-200 py-16 text-center text-sm font-bold text-red-400">
          خطا در بارگذاری اطلاعات — صفحه را تازه‌سازی کنید
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 max-w-6xl">
          <ProductSliderManager
            sliderKey="bestsellers"
            title="پرفروش‌ترین محصولات"
            subtitle="اسلایدر «پرفروش‌ها» در صفحه اصلی"
            initialItems={data.bestsellers}
          />
          <ProductSliderManager
            sliderKey="offers"
            title="پیشنهادهای شگفت‌انگیز"
            subtitle="اسلایدر «شگفت‌انگیزها» در صفحه اصلی"
            initialItems={data.offers}
          />
        </div>
      )}
    </div>
  );
}
