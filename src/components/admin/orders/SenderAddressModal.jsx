"use client";

/**
 * src/components/admin/orders/SenderAddressModal.jsx
 *
 * انتخاب/مدیریتِ آدرسِ فرستنده، پیش از چاپِ برگه‌ی آدرس.
 *
 * ⚠️ این آدرس‌ها کاملاً از آدرس‌های مشتری جدا هستند (کالکشنِ SenderAddress،
 * روتِ /api/admin/sender-addresses) و هیچ‌وقت روی سفارش نوشته نمی‌شوند.
 *
 * ⚠️ این کامپوننت خودش چاپ نمی‌کند و هیچ پنجره/تبی باز نمی‌کند. فقط آدرسِ
 * انتخاب‌شده و اندازه‌ی کاغذ را با `onPrint` بالا می‌دهد؛ چاپ روی *همان*
 * صفحه‌ی سفارش و توسط OrderPrintOverlay انجام می‌شود.
 */

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { MapPin, Plus, Pencil, Trash2, X, Printer, Loader2, Check } from "lucide-react";

import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";
import { PAPER_SIZES } from "@/lib/printPaper.mjs";
import {
  firstSenderAddressError,
  normalizeDigits,
  senderAddressSummary,
  validateSenderAddress,
} from "@/lib/senderAddressForm.mjs";

const EMPTY_FORM = {
  title: "",
  fullName: "",
  phone: "",
  province: "",
  city: "",
  postalCode: "",
  addressLine: "",
};

/** آخرین فرستنده‌ی استفاده‌شده — فقط راحتیِ همین مرورگر است. */
const LAST_USED_KEY = "tenador:lastSenderAddress";

function readLastUsed() {
  try {
    return localStorage.getItem(LAST_USED_KEY) || null;
  } catch {
    return null;
  }
}

function writeLastUsed(id) {
  try {
    localStorage.setItem(LAST_USED_KEY, id);
  } catch {
    /* حالتِ خصوصی مرورگر — بی‌اهمیت */
  }
}

/**
 * والد این کامپوننت را فقط وقتی رندر می‌کند که باز باشد؛ پس هر بار تازه mount
 * می‌شود و هیچ state ای از دفعه‌ی قبل باقی نمی‌ماند (به‌جای پاک‌کردنِ دستی در
 * یک useEffect).
 */
export default function SenderAddressModal({ onClose, onPrint }) {
  const { can } = useAdminPermissions();
  const canManage = can("orders.manageSenders");

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [paperSize, setPaperSize] = useState("A4");

  // null = فرم بسته | "new" = افزودن | "<id>" = ویرایشِ همان آدرس
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/sender-addresses")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "دریافت آدرس‌های فرستنده ناموفق بود");
        return data.addresses || [];
      })
      .then((list) => {
        if (!alive) return;
        setAddresses(list);
        const last = readLastUsed();
        setSelectedId(
          (last && list.some((a) => a._id === last) && last) || list[0]?._id || null
        );
      })
      .catch((error) => alive && toast.error(error.message))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, []);

  const setField = (field, value) => {
    const next =
      field === "phone" || field === "postalCode" ? normalizeDigits(value) : value;
    setForm((prev) => ({ ...prev, [field]: next }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setEditing("new");
  };

  const openEdit = (address) => {
    setForm({
      title: address.title || "",
      fullName: address.fullName || "",
      phone: address.phone || "",
      province: address.province || "",
      city: address.city || "",
      postalCode: address.postalCode || "",
      addressLine: address.addressLine || "",
    });
    setErrors({});
    setEditing(address._id);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validateSenderAddress(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error(firstSenderAddressError(nextErrors));
      return;
    }

    const isNew = editing === "new";
    setSaving(true);
    try {
      const res = await fetch(
        isNew ? "/api/admin/sender-addresses" : `/api/admin/sender-addresses/${editing}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "ذخیره آدرس فرستنده ناموفق بود");

      const saved = data.address;
      setAddresses((prev) =>
        isNew ? [saved, ...prev] : prev.map((a) => (a._id === saved._id ? saved : a))
      );
      setSelectedId(saved._id);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/sender-addresses/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "حذف آدرس فرستنده ناموفق بود");

      setAddresses((prev) => prev.filter((a) => a._id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
      setConfirmDelete(null);
      if (editing === id) setEditing(null);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // چاپ روی *همین* صفحه انجام می‌شود: مودال بسته و حالتِ چاپ باز می‌شود.
  // آدرسِ انتخاب‌شده به‌صورت شیء بالا می‌رود تا حالتِ چاپ لازم نباشد دوباره
  // چیزی از سرور بگیرد.
  const handlePrint = () => {
    const selected = addresses.find((a) => a._id === selectedId) || null;
    if (selected) writeLastUsed(selected._id);
    onPrint({ sender: selected, paperSize });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <MapPin size={16} className="text-[var(--color-primary)]" />
            آدرس فرستنده برای چاپ
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {editing ? (
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-xs font-bold text-[var(--color-primary)] hover:underline"
              >
                ← بازگشت به فهرست
              </button>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="عنوان (اختیاری)" hint="مثلاً انبار تهران">
                  <input
                    className={inputClass(errors.title)}
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    placeholder="انبار تهران"
                  />
                </Field>
                <Field label="نام فرستنده" required error={errors.fullName}>
                  <input
                    className={inputClass(errors.fullName)}
                    value={form.fullName}
                    onChange={(e) => setField("fullName", e.target.value)}
                    placeholder="نام شخص یا فروشگاه"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="شماره تماس" required error={errors.phone} hint="ثابت یا موبایل">
                  <input
                    className={`${inputClass(errors.phone)} text-left`}
                    dir="ltr"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="02112345678"
                  />
                </Field>
                <Field label="کد پستی" error={errors.postalCode}>
                  <input
                    className={`${inputClass(errors.postalCode)} text-left`}
                    dir="ltr"
                    inputMode="numeric"
                    value={form.postalCode}
                    onChange={(e) => setField("postalCode", e.target.value)}
                    placeholder="۱۰ رقم"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="استان">
                  <input
                    className={inputClass()}
                    value={form.province}
                    onChange={(e) => setField("province", e.target.value)}
                    placeholder="تهران"
                  />
                </Field>
                <Field label="شهر" required error={errors.city}>
                  <input
                    className={inputClass(errors.city)}
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                    placeholder="تهران"
                  />
                </Field>
              </div>

              <Field label="آدرس کامل" required error={errors.addressLine}>
                <textarea
                  rows={3}
                  className={`${inputClass(errors.addressLine)} resize-none`}
                  value={form.addressLine}
                  onChange={(e) => setField("addressLine", e.target.value)}
                  placeholder="خیابان، کوچه، پلاک، واحد ..."
                />
              </Field>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-bold
                  text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "در حال ذخیره..." : editing === "new" ? "ذخیره آدرس فرستنده" : "ذخیره تغییرات"}
              </button>
            </form>
          ) : (
            <>
              {loading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
                  ))}
                </div>
              ) : addresses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-xs text-gray-500">
                  <MapPin size={26} className="mx-auto mb-2 text-gray-300" />
                  هنوز آدرس فرستنده‌ای ثبت نشده است.
                  {!canManage && (
                    <p className="mt-2 text-[11px] text-amber-600">
                      شما دسترسی افزودن آدرس فرستنده را ندارید؛ می‌توانید برگه را بدون
                      بخش فرستنده چاپ کنید.
                    </p>
                  )}
                </div>
              ) : (
                addresses.map((address) => {
                  const selected = selectedId === address._id;
                  return (
                    <div
                      key={address._id}
                      onClick={() => setSelectedId(address._id)}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        selected
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {address.title && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                                {address.title}
                              </span>
                            )}
                            <span className="text-xs font-bold text-gray-700">
                              {address.fullName}
                            </span>
                            <span className="font-mono text-[11px] text-gray-400" dir="ltr">
                              {address.phone}
                            </span>
                          </div>
                          <p className="break-words text-[11px] leading-5 text-gray-500">
                            {senderAddressSummary(address)}
                          </p>
                          {address.postalCode && (
                            <p className="text-[10px] text-gray-400">
                              کد پستی: {address.postalCode}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {selected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
                              <Check size={12} />
                            </span>
                          )}
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(address);
                                }}
                                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                                title="ویرایش"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDelete(
                                    confirmDelete === address._id ? null : address._id
                                  );
                                }}
                                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                                title="حذف"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {confirmDelete === address._id && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
                          <span>این آدرس فرستنده حذف شود؟</span>
                          <span className="flex gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(address._id);
                              }}
                              className="rounded-md bg-red-500 px-2.5 py-1 font-bold text-white disabled:opacity-60"
                            >
                              حذف
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(null);
                              }}
                              className="rounded-md bg-white px-2.5 py-1 font-bold text-gray-600"
                            >
                              انصراف
                            </button>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {canManage && (
                <button
                  type="button"
                  onClick={openNew}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2
                    border-dashed border-gray-200 py-2.5 text-xs font-bold text-gray-500
                    transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  <Plus size={14} /> افزودن آدرس فرستنده
                </button>
              )}
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400">اندازه کاغذ</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
                {PAPER_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={paperSize === size}
                    onClick={() => setPaperSize(size)}
                    className={`px-3 py-1.5 text-[11px] font-bold transition ${
                      paperSize === size
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)]
                px-4 py-2 text-xs font-bold text-white transition hover:opacity-90
                disabled:opacity-60"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              چاپ برگه آدرس
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ریزکامپوننت‌های فرم ────────────────────────────────────────────── */

function inputClass(error) {
  return `w-full rounded-lg border px-3 py-2 text-xs outline-none transition
    focus:ring-2 ${
      error
        ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
        : "border-gray-200 focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/15"
    }`;
}

function Field({ label, required, hint, error, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold text-gray-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
        {hint && <span className="mr-1 font-normal text-gray-400">({hint})</span>}
      </span>
      {children}
      {error && <span className="block text-[10px] text-red-500">{error}</span>}
    </label>
  );
}
