"use client";

import { useState } from "react";
import { Loader2, Pencil, Save } from "lucide-react";
import { toast } from "react-toastify";
import { MANUAL_TRACKING_STATUSES, manualTrackingCount } from "@/lib/manualTracking";

const fa = (value) => new Intl.NumberFormat("fa-IR").format(value);

export default function ManualTrackingEditor({ orderId, target, line, quantity, canEdit, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const rows = line.manualTracking || [];
  const available = Math.max(0, quantity - line.scannedCount);
  const total = Object.values(draft).reduce((sum, value) => sum + Number(value || 0), 0);
  const valid = Object.values(draft).every((value) => Number.isSafeInteger(Number(value || 0)) && Number(value || 0) >= 0) && total <= available;

  const startEditing = () => {
    setDraft(Object.fromEntries(rows.map((row) => [row.status, String(row.quantity)])));
    setError("");
    setEditing(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving || !valid) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_manual", ...target,
          revision: line.manualTrackingRevision || 0,
          manualTracking: Object.entries(draft).filter(([, value]) => Number(value) > 0)
            .map(([status, value]) => ({ status, quantity: Number(value) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "ذخیره وضعیت ناموفق بود");
      toast.success(data.message);
      setEditing(false);
      await onSaved();
    } catch (err) {
      setError(err.message || "ارتباط با سرور برقرار نشد");
    } finally {
      setSaving(false);
    }
  };

  if (!editing && !rows.length && (!canEdit || available === 0)) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-800">وضعیت دستی — بدون ترکینگ کد</p>
        {canEdit && !editing && (
          <button type="button" onClick={startEditing}
            className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm font-bold text-[var(--color-primary)] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2">
            <Pencil size={15} /> {rows.length ? "ویرایش وضعیت‌ها" : "ثبت وضعیت دستی"}
          </button>
        )}
      </div>
      {!editing ? (
        <>
          {rows.length > 0 && <div className="flex flex-wrap gap-2">
            {rows.map((row) => <span key={row.status} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
              {fa(row.quantity)} عدد {MANUAL_TRACKING_STATUSES[row.status]}
            </span>)}
          </div>}
          <p className="text-xs leading-6 text-gray-600">
            {fa(Math.max(0, available - manualTrackingCount(line)))} عدد بدون وضعیت دستی یا ترکینگ؛ قابل علامت‌گذاری برای خرید یا تخصیص از انبار.
          </p>
        </>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <p className="text-xs leading-6 text-gray-600">
            تعداد هر وضعیت را مشخص کنید. {fa(line.scannedCount)} عدد دارای ترکینگ انبار است و حداکثر {fa(available)} عدد را می‌توانید دستی تعیین وضعیت کنید.
            با صفر کردن تعداد، آن بخش دوباره برای خرید یا تخصیص ترکینگ آزاد می‌شود.
          </p>
          <fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <legend className="sr-only">تعداد محصولات در هر وضعیت</legend>
            {Object.entries(MANUAL_TRACKING_STATUSES).map(([status, label]) => (
              <label key={status} className="flex items-center justify-between gap-3 text-sm text-gray-700">
                {label}
                <input type="number" min="0" max={available} step="1" inputMode="numeric"
                  value={draft[status] ?? ""} placeholder="۰"
                  onChange={(e) => setDraft((current) => ({ ...current, [status]: e.target.value }))}
                  className="w-24 min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-center focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]" />
              </label>
            ))}
          </fieldset>
          <p className={`text-sm font-bold ${valid ? "text-gray-700" : "text-red-700"}`} aria-live="polite">
            {valid ? `${fa(total)} عدد با وضعیت دستی · ${fa(available - total)} عدد باقی‌مانده` : "تعدادها باید صحیح و مجموع آن‌ها حداکثر برابر تعداد قابل تخصیص باشد"}
          </p>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !valid}
              className="min-h-11 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-bold text-white disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "در حال ذخیره..." : "ذخیره وضعیت‌ها"}
            </button>
            <button type="button" disabled={saving} onClick={() => setEditing(false)} className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm text-gray-700">انصراف</button>
          </div>
        </form>
      )}
    </div>
  );
}
