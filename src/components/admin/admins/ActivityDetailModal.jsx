"use client";

/**
 * src/components/admin/admins/ActivityDetailModal.jsx
 *
 * جزئیاتِ کاملِ یک رکوردِ ممیزی.
 *
 * فقط خواندنی و فقط نمایش‌دهنده: هر چیزی که اینجا دیده می‌شود پیش‌تر روی
 * سرور ساخته، پاک‌سازی و ذخیره شده است. هیچ داده‌ای اینجا محاسبه یا از
 * موجودیتِ زنده خوانده نمی‌شود — به همین دلیل رکوردِ یک محصولِ حذف‌شده هم
 * کامل نمایش داده می‌شود.
 *
 * برچسبِ فیلدها و ترجمه‌ی enumها از همان رجیستری‌ای می‌آید که پلاگینِ سرور
 * استفاده می‌کند (src/lib/auditEntities.js)، پس «آنچه ثبت شد» و «آنچه دیده
 * می‌شود» از هم جدا نمی‌افتند.
 */

import { useEffect } from "react";
import { FiActivity, FiClock, FiGlobe, FiKey, FiLink2, FiUser, FiX } from "react-icons/fi";

import {
  ACTIVITY_RESULT_LABELS,
  activityCategory,
  activityHeadline,
  activityLabel,
  resourceTypeLabel,
} from "@/lib/activityLabels";
import { enumLabel, fieldLabel, fieldMeta } from "@/lib/auditEntities";

export const RESULT_STYLE = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failure: "bg-red-50 text-red-600 border-red-200",
  denied: "bg-amber-50 text-amber-700 border-amber-200",
  attempted: "bg-gray-50 text-gray-500 border-gray-200",
};

/* ────────────────────────────────────────────────────────────────────────────
 * قالب‌بندیِ مقدار
 * ──────────────────────────────────────────────────────────────────────────── */

const isIsoDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);

export function formatDateTime(value, withSeconds = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    timeZone: "Asia/Tehran",
  }).format(date);
}

/** مقدارِ یک فیلد، با ترجمه‌ی enum و قالبِ عدد/تاریخ/بولین. */
export function formatAuditValue(resourceType, path, value) {
  if (value === null || value === undefined || value === "") return "—";

  const translated = enumLabel(resourceType, path, value);
  if (translated) return translated;

  const meta = fieldMeta(resourceType, path);
  if (meta?.type === "bool" || typeof value === "boolean") {
    return value ? "بله" : "خیر";
  }
  if (meta?.type === "price" && typeof value === "number") {
    return `${value.toLocaleString("fa-IR")} تومان`;
  }
  if (typeof value === "number") return value.toLocaleString("fa-IR");
  if (isIsoDate(value)) return formatDateTime(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/* ────────────────────────────────────────────────────────────────────────────
 * فهرستِ تغییرات
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * `__omitted` یک فیلدِ واقعی نیست؛ نشانگرِ «چند فیلدِ دیگر هم عوض شد ولی برای
 * خوانایی ثبت نشد» است و باید جدا و بدونِ فلشِ قبل/بعد نمایش داده شود.
 */
export function ChangeList({ resourceType, changes }) {
  const entries = Object.entries(changes || {}).filter(([path]) => path !== "__omitted");
  const omitted = changes?.__omitted?.to;

  if (!entries.length && !omitted) return null;

  return (
    // ⚠️ overflow-x-auto و نه overflow-hidden: مقدارها تا ۱۶۰ نویسه می‌آیند و
    // مسیرِ نقطه‌دارِ فیلد هم می‌تواند بلند باشد. با hidden، روی موبایل ستونِ
    // «مقدار جدید» بی‌صدا بریده می‌شد — یعنی ممیز چیزی را که نمی‌بیند هم
    // نمی‌داند که ندیده.
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#eceae6" }}>
      <table className="w-full text-right">
        <thead>
          <tr className="bg-gray-50 text-[10px] font-bold text-gray-400">
            <th className="p-2 font-bold">فیلد</th>
            <th className="p-2 font-bold">مقدار قبلی</th>
            <th className="p-2 font-bold">مقدار جدید</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "#f2f0ed" }}>
          {entries.map(([path, change]) => (
            <tr key={path} className="align-top text-[11px] font-bold">
              <td className="p-2 text-gray-600">
                {fieldLabel(resourceType, path)}
                {fieldLabel(resourceType, path) !== path ? (
                  <span className="block break-all text-[9px] font-bold text-gray-300" dir="ltr">
                    {path}
                  </span>
                ) : null}
              </td>
              <td className="p-2">
                <span className="inline-block break-all rounded bg-red-50 px-1.5 py-0.5 text-red-600">
                  {formatAuditValue(resourceType, path, change?.from)}
                </span>
              </td>
              <td className="p-2">
                <span className="inline-block break-all rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                  {formatAuditValue(resourceType, path, change?.to)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {omitted ? (
        <p className="border-t bg-gray-50 p-2 text-[10px] font-bold text-gray-400" style={{ borderColor: "#f2f0ed" }}>
          {omitted} برای خوانایی ثبت نشده است
        </p>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * مودال
 * ──────────────────────────────────────────────────────────────────────────── */

function Field({ label, value, dir, icon: Icon }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
        {Icon ? <Icon size={10} /> : null}
        {label}
      </p>
      <p className="mt-0.5 break-words text-xs font-bold text-gray-800" dir={dir}>
        {value || "—"}
      </p>
    </div>
  );
}

export default function ActivityDetailModal({ item, onClose }) {
  // Escape ببندد و پس‌زمینه اسکرول نکند — روی موبایل که مودال تمام‌صفحه است
  // بدونِ قفلِ اسکرول، صفحه‌ی زیرین زیرِ انگشت حرکت می‌کند.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!item) return null;

  const category = activityCategory(item.action);
  const typeLabel = resourceTypeLabel(item.resourceType);
  const related = Array.isArray(item.related) ? item.related : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="جزئیات فعالیت"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-2xl sm:rounded-2xl"
      >
        {/* ─── سربرگ ─── */}
        <header
          className="flex items-start justify-between gap-3 border-b p-4"
          style={{ borderColor: "#f0ede9" }}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                  RESULT_STYLE[item.result] || RESULT_STYLE.attempted
                }`}
              >
                {ACTIVITY_RESULT_LABELS[item.result] || item.result}
              </span>
              {category ? (
                <span className="text-[10px] font-bold text-gray-400">{category.title}</span>
              ) : null}
            </div>
            <h3 className="mt-1.5 text-sm font-bold leading-6 text-gray-900">
              {activityHeadline(item)}
            </h3>
            <p className="text-[10px] font-bold text-gray-400" dir="ltr">
              {item.action}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:text-[var(--color-primary)]"
          >
            <FiX size={15} />
          </button>
        </header>

        {/* ─── بدنه ─── */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field
              label="ادمین"
              icon={FiUser}
              value={item.actorSnapshot?.name || item.actorSnapshot?.username}
            />
            <Field label="نقش در زمان اقدام" value={item.actorSnapshot?.roleName} />
            <Field label="تاریخ و ساعت" icon={FiClock} value={formatDateTime(item.createdAt, true)} />
            <Field label="نوع موجودیت" value={typeLabel} />
            <Field label="نام موجودیت" value={item.resourceLabel} />
            <Field label="شناسه موجودیت" value={item.resourceId} dir="ltr" />
            <Field label="نشانی IP" icon={FiGlobe} value={item.ip} dir="ltr" />
            <Field label="کد وضعیت" value={item.statusCode ? String(item.statusCode) : ""} dir="ltr" />
            <Field label="دلیل" value={item.reason} dir="ltr" />
          </section>

          {item.permissions?.length ? (
            <section>
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-gray-400">
                <FiKey size={10} /> دسترسی‌های به‌کاررفته
              </p>
              <div className="flex flex-wrap gap-1.5" dir="ltr">
                {item.permissions.map((key) => (
                  <span
                    key={key}
                    className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-gray-600"
                  >
                    {key}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {item.changes ? (
            <section>
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-gray-400">
                <FiActivity size={10} /> فیلدهای تغییرکرده
              </p>
              <ChangeList resourceType={item.resourceType} changes={item.changes} />
            </section>
          ) : null}

          {related.length ? (
            <section>
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-gray-400">
                <FiLink2 size={10} /> تغییرات مرتبط با همین اقدام
              </p>
              <div className="space-y-3">
                {related.map((entry, index) => (
                  <div
                    key={`${entry.type}-${entry.id}-${index}`}
                    className="rounded-xl border p-3"
                    style={{ borderColor: "#eceae6" }}
                  >
                    <p className="text-[11px] font-bold text-gray-700">
                      {entry.description || activityLabel(entry.action)}
                    </p>
                    {entry.id ? (
                      <p className="break-all text-[9px] font-bold text-gray-300" dir="ltr">
                        {entry.type} · {entry.id}
                      </p>
                    ) : null}
                    {entry.changes ? (
                      <div className="mt-2">
                        <ChangeList resourceType={entry.type} changes={entry.changes} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {item.metadata && Object.keys(item.metadata).length ? (
            <details className="rounded-xl border p-3" style={{ borderColor: "#eceae6" }}>
              <summary className="cursor-pointer text-[11px] font-bold text-gray-500">
                داده‌ی خام
              </summary>
              <pre
                dir="ltr"
                className="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-2 text-[10px] text-gray-600"
              >
                {JSON.stringify(item.metadata, null, 2)}
              </pre>
            </details>
          ) : null}

          <p className="break-all text-[9px] font-bold text-gray-300" dir="ltr">
            {item.requestId || item._id}
          </p>
        </div>
      </div>
    </div>
  );
}
