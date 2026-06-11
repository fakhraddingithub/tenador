"use client";
// src/components/admin/discounts/CouponCard.jsx
//
// کارت نمایش کد تخفیف — هم‌خانواده با DiscountRuleCard

import { toast } from "react-toastify";

const APPLICABLE_LABELS = {
  all: "همه محصولات",
  product: "محصولات خاص",
  brand: "برندهای خاص",
  category: "دسته‌بندی‌های خاص",
};

const APPLICABLE_COLORS = {
  all: "bg-green-50 text-green-700 border-green-200",
  product: "bg-blue-50 text-blue-700 border-blue-200",
  brand: "bg-orange-50 text-orange-700 border-orange-200",
  category: "bg-purple-50 text-purple-700 border-purple-200",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" });
}

function isExpired(endAt) {
  return new Date(endAt) < new Date();
}

function isLive(coupon) {
  return coupon.active && !isExpired(coupon.endAt) && new Date(coupon.startAt) <= new Date();
}

export default function CouponCard({ coupon, onEdit, onDelete, onToggle }) {
  const live = isLive(coupon);
  const expired = isExpired(coupon.endAt);
  const capacityFull =
    coupon.usageLimit != null && (coupon.usedCount || 0) >= coupon.usageLimit;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      toast.success(`کد «${coupon.code}» کپی شد`);
    } catch {
      toast.error("کپی کد ناموفق بود");
    }
  };

  return (
    <div
      className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow ${
        !coupon.active ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Right: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {/* خود کد — کلیک = کپی */}
            <button
              type="button"
              onClick={copyCode}
              title="کپی کد"
              className="font-mono text-sm font-bold tracking-widest bg-gray-900 text-white px-3 py-1 rounded-lg hover:bg-[#aa4725] transition-colors"
              dir="ltr"
            >
              {coupon.code}
            </button>

            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                APPLICABLE_COLORS[coupon.applicableTo] || "bg-gray-50 text-gray-600 border-gray-200"
              }`}
            >
              {APPLICABLE_LABELS[coupon.applicableTo] || coupon.applicableTo}
            </span>

            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                live && !capacityFull
                  ? "bg-green-50 text-green-700"
                  : expired
                    ? "bg-red-50 text-red-600"
                    : capacityFull
                      ? "bg-amber-50 text-amber-600"
                      : "bg-gray-100 text-gray-500"
              }`}
            >
              {expired
                ? "منقضی"
                : capacityFull
                  ? "ظرفیت تکمیل"
                  : live
                    ? "فعال"
                    : "غیرفعال"}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="font-medium text-[#aa4725] text-sm">
              {coupon.discount?.kind === "percent"
                ? `${coupon.discount.value}٪ تخفیف`
                : `${coupon.discount?.value?.toLocaleString("fa-IR")} تومان تخفیف`}
            </span>
            <span>شروع: {formatDate(coupon.startAt)}</span>
            <span>پایان: {formatDate(coupon.endAt)}</span>
            <span>
              استفاده‌شده: {(coupon.usedCount || 0).toLocaleString("fa-IR")}
              {coupon.usageLimit != null
                ? ` از ${coupon.usageLimit.toLocaleString("fa-IR")}`
                : " (بدون سقف کل)"}
            </span>
            {coupon.perUserLimit != null && (
              <span>سقف هر کاربر: {coupon.perUserLimit.toLocaleString("fa-IR")}</span>
            )}
          </div>

          {(coupon.minCartValue > 0 || (coupon.targets?.length || 0) > 0) && (
            <div className="mt-1.5 flex gap-2 flex-wrap">
              {coupon.minCartValue > 0 && (
                <span className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600">
                  حداقل سبد: {coupon.minCartValue.toLocaleString("fa-IR")} تومان
                </span>
              )}
              {coupon.applicableTo !== "all" && (coupon.targets?.length || 0) > 0 && (
                <span className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600">
                  {coupon.targets.length.toLocaleString("fa-IR")} هدف انتخاب‌شده
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(coupon)}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            ویرایش
          </button>
          <button
            onClick={() => onToggle(coupon._id, coupon.active)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              coupon.active
                ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                : "bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            {coupon.active ? "غیرفعال" : "فعال"}
          </button>
          <button
            onClick={() => onDelete(coupon._id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}
