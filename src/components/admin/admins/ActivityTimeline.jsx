"use client";

/**
 * src/components/admin/admins/ActivityTimeline.jsx
 *
 * خطِ زمانیِ فعالیتِ یک ادمین (یا کلِ پنل، اگر actorUser داده نشود).
 *
 * فقط خواندنی — دفتر فقط‌افزودنی است و هیچ اکشنی اینجا وجود ندارد.
 * جزئیاتِ هر رکورد در همان ردیف باز می‌شود؛ مقادیرِ حساس پیش از رسیدن به
 * اینجا در سرور حذف شده‌اند (src/lib/adminActivity.js).
 */

import { useState } from "react";
import useSWR from "swr";
import { FiChevronLeft, FiChevronRight, FiClock, FiFilter } from "react-icons/fi";

import {
  ACTIVITY_RESULT_LABELS,
  activityCategory,
  activityFilterOptions,
  activityLabel,
} from "@/lib/activityLabels";

const RESULT_STYLE = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failure: "bg-red-50 text-red-600 border-red-200",
  denied: "bg-amber-50 text-amber-700 border-amber-200",
  attempted: "bg-gray-50 text-gray-500 border-gray-200",
};

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tehran",
      }).format(new Date(value))
    : "—";

function ChangeRow({ field, change }) {
  const show = (value) =>
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
      <span className="text-gray-500">{field}</span>
      <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600 line-through">
        {show(change.from)}
      </span>
      <span className="text-gray-300">→</span>
      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
        {show(change.to)}
      </span>
    </div>
  );
}

export default function ActivityTimeline({ actorUser = null, title = "تاریخچه فعالیت" }) {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [openId, setOpenId] = useState(null);

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
    <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#e8e4df" }} dir="rtl">
      <header
        className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "#f0ede9" }}
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <FiClock className="text-[var(--color-primary)]" size={15} />
          {title}
          {data ? (
            <span className="text-[11px] font-bold text-gray-400">
              ({Number(data.total).toLocaleString("fa-IR")} رکورد)
            </span>
          ) : null}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <FiFilter size={13} className="text-gray-400" />
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
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
            const isOpen = openId === item._id;
            const hasDetail = item.changes || item.metadata || item.reason;

            return (
              <li key={item._id} className="p-4">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : item._id)}
                  disabled={!hasDetail}
                  className="flex w-full flex-wrap items-center gap-2 text-right disabled:cursor-default"
                >
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      RESULT_STYLE[item.result] || RESULT_STYLE.attempted
                    }`}
                  >
                    {ACTIVITY_RESULT_LABELS[item.result] || item.result}
                  </span>

                  <span className="text-xs font-bold text-gray-800">
                    {activityLabel(item.action)}
                  </span>

                  {category ? (
                    <span className="text-[10px] font-bold text-gray-400">{category.title}</span>
                  ) : null}

                  {item.resourceLabel || item.resourceType ? (
                    <span className="truncate text-[11px] font-bold text-gray-500">
                      · {item.resourceLabel || item.resourceType}
                    </span>
                  ) : null}

                  <span className="mr-auto text-[10px] font-bold text-gray-400 tabular-nums">
                    {formatDate(item.createdAt)}
                  </span>
                </button>

                <p className="mt-1 text-[10px] font-bold text-gray-400">
                  {item.actorSnapshot?.name || "—"}
                  {item.actorSnapshot?.roleName ? ` · ${item.actorSnapshot.roleName}` : ""}
                  {item.ip ? ` · ${item.ip}` : ""}
                </p>

                {isOpen && hasDetail ? (
                  <div
                    className="mt-3 space-y-2 rounded-xl border bg-gray-50/70 p-3"
                    style={{ borderColor: "#eceae6" }}
                  >
                    {item.reason ? (
                      <p className="text-[11px] font-bold text-gray-600">دلیل: {item.reason}</p>
                    ) : null}

                    {item.permissions?.length ? (
                      <p className="text-[11px] font-bold text-gray-500" dir="ltr">
                        {item.permissions.join("، ")}
                      </p>
                    ) : null}

                    {item.changes ? (
                      <div className="space-y-1.5">
                        {Object.entries(item.changes).map(([field, change]) => (
                          <ChangeRow key={field} field={field} change={change} />
                        ))}
                      </div>
                    ) : null}

                    {item.metadata ? (
                      <pre
                        dir="ltr"
                        className="overflow-x-auto rounded-lg bg-white p-2 text-[10px] text-gray-600"
                      >
                        {JSON.stringify(item.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
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
    </section>
  );
}
