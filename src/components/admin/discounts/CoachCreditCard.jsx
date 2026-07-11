"use client";

import { getUserFullName } from "base/utils/userName";
// components/admin/discounts/CoachCreditCard.jsx

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" });
}

const TARGET_LABELS = {
  all: "همه محصولات",
  product: "محصول خاص",
  category: "دسته‌بندی",
  serie: "سری",
};

export default function CoachCreditCard({ rule, onEdit, onDelete, onToggle }) {
  return (
    <div
      className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow ${
        !rule.active ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="font-semibold text-gray-800 text-sm">{rule.title}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 font-medium">
              {rule.scope === "all_coaches" ? "همه مربیان" : "مربی خاص"}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
              {TARGET_LABELS[rule.targetType] || rule.targetType}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                rule.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {rule.active ? "فعال" : "غیرفعال"}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="font-medium text-[#aa4725] text-sm">
              {rule.credit?.kind === "percent"
                ? `${rule.credit.value}٪ از مبلغ خرید`
                : `${rule.credit?.value?.toLocaleString("fa-IR")} تومان ثابت`}
            </span>

            {rule.scope === "specific_coach" && rule.coach && (
              <span>
                مربی: {getUserFullName(rule.coach, rule.coach.phone)}{" "}
                {rule.coach.coachCode ? `(${rule.coach.coachCode})` : ""}
              </span>
            )}
            <span>اولویت: {rule.priority}</span>
            {rule.startAt && <span>شروع: {formatDate(rule.startAt)}</span>}
            {rule.endAt && <span>پایان: {formatDate(rule.endAt)}</span>}
          </div>

          {/* آمار */}
          <div className="mt-1.5 flex gap-3 text-xs text-gray-400">
            <span>کردیت پرداختی: {(rule.totalCreditPaid || 0).toLocaleString("fa-IR")} تومان</span>
            <span>تعداد اعمال: {rule.triggerCount || 0}</span>
          </div>

          {/* شرایط */}
          {(rule.conditions?.minPurchaseAmount > 0 || rule.conditions?.onlyNewStudents) && (
            <div className="mt-1.5 flex gap-2 flex-wrap">
              {rule.conditions.minPurchaseAmount > 0 && (
                <span className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600">
                  حداقل خرید: {rule.conditions.minPurchaseAmount.toLocaleString("fa-IR")} تومان
                </span>
              )}
              {rule.conditions.onlyNewStudents && (
                <span className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600">
                  فقط شاگرد جدید
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(rule)}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            ویرایش
          </button>
          <button
            onClick={() => onToggle(rule._id, rule.active)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              rule.active
                ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                : "bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            {rule.active ? "غیرفعال" : "فعال"}
          </button>
          <button
            onClick={() => onDelete(rule._id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}
