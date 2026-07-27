"use client";

import useSWR from "swr";
import Link from "next/link";
import { FiArrowRight, FiTrendingUp, FiZap, FiInfo } from "react-icons/fi";
import AdminLoader from "@/components/admin/AdminLoader";
import ProductSliderManager from "@/components/admin/home/ProductSliderManager";

// 🟢 محتوا — پنجره‌ی ۵ دقیقه‌ای
const CONTENT_TTL = { dedupingInterval: 300_000 };

export default function ProductSlidersPage() {
  // 🟢 اسلایدرهای صفحه‌ی اصلی — محتوا. کشِ این کلید تنها منبعِ حقیقت است؛
  // ProductSliderManager کنترل‌شده است و ذخیره از همین‌جا انجام می‌شود تا
  // بعد از هر تغییر، کش هم بلافاصله به‌روز باشد.
  const { data: json, isLoading: loading, error, mutate } = useSWR(
    "/api/admin/home-sliders",
    CONTENT_TTL,
  );

  const data = {
    bestsellers: json?.bestsellers || [],
    offers: json?.offers || [],
  };

  // ذخیره‌ی خوش‌بینانه: لیست بلافاصله جابه‌جا می‌شود و اگر PUT شکست بخورد،
  // rollbackOnError ترتیبِ قبلی را برمی‌گرداند.
  const persistSlider = (sliderKey) => async (nextItems) => {
    await mutate(
      async () => {
        const res = await fetch("/api/admin/home-sliders", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slider: sliderKey,
            productIds: nextItems.map((i) => i._id),
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "خطا در ذخیره");
        // سرور فهرستِ پاک‌سازی‌شده (بدون محصولاتِ حذف‌شده) را برمی‌گرداند
        return Array.isArray(body.items) ? body.items : nextItems;
      },
      {
        optimisticData: (cur) => ({ ...cur, [sliderKey]: nextItems }),
        populateCache: (serverItems, cur) => ({ ...cur, [sliderKey]: serverItems }),
        rollbackOnError: true,
        revalidate: false,
      },
    );
  };

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
            items={data.bestsellers}
            onPersist={persistSlider("bestsellers")}
          />
          <ProductSliderManager
            sliderKey="offers"
            title="پیشنهادهای شگفت‌انگیز"
            subtitle="اسلایدر «شگفت‌انگیزها» در صفحه اصلی"
            items={data.offers}
            onPersist={persistSlider("offers")}
          />
        </div>
      )}
    </div>
  );
}
