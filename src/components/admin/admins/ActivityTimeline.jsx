"use client";

/**
 * src/components/admin/admins/ActivityTimeline.jsx
 *
 * خطِ زمانیِ فعالیتِ یک ادمین (یا کلِ پنل، اگر actorUser داده نشود).
 *
 * فقط خواندنی — دفتر فقط‌افزودنی است و هیچ اکشنی اینجا وجود ندارد.
 * هر ردیف جمله‌ی «چه اتفاقی افتاد» را نشان می‌دهد و کلیک روی آن مودالِ
 * جزئیات را باز می‌کند. مقادیرِ حساس پیش از رسیدن به اینجا در سرور حذف
 * شده‌اند (src/lib/auditRedaction.js).
 */

import { useState } from "react";
import useSWR from "swr";
import {
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFilter,
  FiLogIn,
} from "react-icons/fi";

import {
  ACTIVITY_RESULT_LABELS,
  activityCategory,
  activityFilterOptions,
  activityHeadline,
  resourceTypeLabel,
} from "@/lib/activityLabels";
import ActivityDetailModal, {
  RESULT_STYLE,
  formatDateTime,
} from "@/components/admin/admins/ActivityDetailModal";

/** خلاصه‌ی یک‌خطیِ تغییرات برای ردیف — جزئیاتِ کامل در مودال. */
function changeSummary(item) {
  const paths = Object.keys(item?.changes || {}).filter((path) => path !== "__omitted");
  if (!paths.length) return "";
  const shown = paths
    .slice(0, 3)
    .map((path) => {
      const label = path.split(".").pop();
      return label;
    })
    .join("، ");
  return paths.length > 3 ? `${shown} و ${paths.length - 3} مورد دیگر` : shown;
}

export default function ActivityTimeline({
  actorUser = null,
  title = "تاریخچه فعالیت",
  lastLoginAt = null,
}) {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [selected, setSelected] = useState(null);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (actorUser) params.set("actorUser", actorUser);
  if (action) params.set("action", action);
  if (result) params.set("result", result);

  const { data, isLoading, error } = useSWR(`/api/admin/activity?${params}`, {
    keepPreviousData: true,
  });

  const items = data?.items || [];
  const pages = data?.pages || 1;

  return (
    <section
      className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: "#e8e4df" }}
      dir="rtl"
    >
      <header
        className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "#f0ede9" }}
      >
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <FiClock className="text-[var(--color-primary)]" size={15} />
            {title}
            {data ? (
              <span className="text-[11px] font-bold text-gray-400">
                ({Number(data.total).toLocaleString("fa-IR")} رکورد)
              </span>
            ) : null}
          </h2>

          {/* آخرین ورود — از Admin.lastLoginAt که هنگام ورودِ موفق نوشته
              می‌شود، نه از وضعیتِ مرورگر. */}
          {actorUser ? (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
              <FiLogIn size={12} className="text-gray-400" />
              آخرین ورود به پنل:{" "}
              {lastLoginAt ? (
                <span className="text-gray-800">{formatDateTime(lastLoginAt, true)}</span>
              ) : (
                <span className="text-gray-400">از زمان فعال‌شدنِ این قابلیت واردی ثبت نشده</span>
              )}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FiFilter size={13} className="text-gray-400" />
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            aria-label="فیلتر اقدام"
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700 outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">همه‌ی اقدام‌ها</option>
            {activityFilterOptions().map((group) => (
              <optgroup key={group.key} label={group.title}>
                {group.actions.map((option) => (
                  <option key={option.action} value={option.action}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            value={result}
            onChange={(e) => {
              setResult(e.target.value);
              setPage(1);
            }}
            aria-label="فیلتر نتیجه"
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700 outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">همه‌ی نتیجه‌ها</option>
            {Object.entries(ACTIVITY_RESULT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? (
        <p className="p-8 text-center text-xs font-bold text-red-500">
          خطا در دریافت تاریخچه فعالیت
        </p>
      ) : isLoading && !items.length ? (
        <p className="p-8 text-center text-xs font-bold text-gray-400">در حال بارگذاری…</p>
      ) : !items.length ? (
        <p className="p-10 text-center text-xs font-bold text-gray-400">
          رکوردی با این فیلترها ثبت نشده است
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "#f5f3f0" }}>
          {items.map((item) => {
            const category = activityCategory(item.action);
            const summary = changeSummary(item);
            const typeLabel = resourceTypeLabel(item.resourceType);

            return (
              <li key={item._id}>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="w-full p-4 text-right transition-colors hover:bg-gray-50/70"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        RESULT_STYLE[item.result] || RESULT_STYLE.attempted
                      }`}
                    >
                      {ACTIVITY_RESULT_LABELS[item.result] || item.result}
                    </span>

                    <span className="text-xs font-bold text-gray-800">
                      {activityHeadline(item)}
                    </span>

                    {category ? (
                      <span className="text-[10px] font-bold text-gray-400">
                        {category.title}
                      </span>
                    ) : null}

                    <span className="mr-auto text-[10px] font-bold text-gray-400 tabular-nums">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>

                  <p className="mt-1 text-[10px] font-bold text-gray-400">
                    {item.actorSnapshot?.name || "—"}
                    {item.actorSnapshot?.roleName ? ` · ${item.actorSnapshot.roleName}` : ""}
                    {typeLabel ? ` · ${typeLabel}` : ""}
                    {summary ? ` · ${summary}` : ""}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <div
          className="flex items-center justify-between border-t p-3"
          style={{ borderColor: "#f0ede9" }}
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 disabled:opacity-40"
          >
            <FiChevronRight size={13} /> قبلی
          </button>
          <span className="text-[11px] font-bold text-gray-400">
            صفحه {page.toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 disabled:opacity-40"
          >
            بعدی <FiChevronLeft size={13} />
          </button>
        </div>
      ) : null}

      {selected ? (
        <ActivityDetailModal item={selected} onClose={() => setSelected(null)} />
      ) : null}
    </section>
  );
}
