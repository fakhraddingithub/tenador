"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FiArrowRight,
  FiAward,
  FiImage,
  FiLink,
  FiLoader,
  FiRefreshCcw,
  FiSave,
  FiType,
  FiUploadCloud,
} from "react-icons/fi";
import AdminLoader from "@/components/admin/AdminLoader";
import RolandGarros from "@/components/features/rolandGarros/RolandGarros";
import { showToast } from "@/lib/toast";
import { showError } from "@/lib/swal";
import { DEFAULT_ROLAND_GARROS_BANNER } from "@/lib/rolandGarrosBanner";

const API_URL = "/api/admin/home-roland-garros";

const TEXT_FIELDS = [
  {
    name: "backgroundText",
    label: "متن پس‌زمینه بزرگ",
    dir: "ltr",
    placeholder: "Roland Garros",
    icon: FiType,
  },
  {
    name: "eyebrow",
    label: "متن کوچک بالای کارت",
    placeholder: "کالکشن رسمی 2026",
    icon: FiType,
  },
  {
    name: "titlePrefix",
    label: "عنوان فارسی - بخش سفید",
    placeholder: "رولاند",
    icon: FiType,
  },
  {
    name: "titleHighlight",
    label: "عنوان فارسی - بخش رنگی",
    placeholder: "گاروس",
    icon: FiType,
  },
  {
    name: "englishTitlePrefix",
    label: "عنوان انگلیسی - بخش سفید",
    dir: "ltr",
    placeholder: "Roland",
    icon: FiType,
  },
  {
    name: "englishTitleHighlight",
    label: "عنوان انگلیسی - بخش رنگی",
    dir: "ltr",
    placeholder: "Garros",
    icon: FiType,
  },
  {
    name: "description",
    label: "توضیح بنر",
    type: "textarea",
    placeholder: DEFAULT_ROLAND_GARROS_BANNER.description,
    colSpan: "lg:col-span-2",
    icon: FiType,
  },
  {
    name: "ctaLabel",
    label: "متن دکمه",
    placeholder: "مشاهده محصولات",
    icon: FiType,
  },
  {
    name: "ctaHref",
    label: "لینک دکمه",
    dir: "ltr",
    placeholder: "/wilson/roland-garros",
    icon: FiLink,
  },
  {
    name: "statValue",
    label: "عدد کنار دکمه",
    dir: "ltr",
    placeholder: "۱۰۰٪",
    icon: FiType,
  },
  {
    name: "statLabel",
    label: "متن زیر عدد",
    placeholder: "اصالت تضمین شده",
    icon: FiType,
  },
  {
    name: "cornerTitle",
    label: "عنوان کارت کوچک روی تصویر",
    dir: "ltr",
    placeholder: "PARIS",
    icon: FiType,
  },
  {
    name: "cornerSubtitle",
    label: "متن کارت کوچک روی تصویر",
    placeholder: "تورنمنت 2026",
    icon: FiType,
  },
  {
    name: "imageAlt",
    label: "متن جایگزین تصویر",
    placeholder: "محصولات رولاند گاروس",
    icon: FiImage,
  },
];

function cloneDefaultBanner() {
  return { ...DEFAULT_ROLAND_GARROS_BANNER };
}

function FormField({ field, value, onChange }) {
  const Icon = field.icon;
  const inputClass =
    "w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-800 outline-none transition-all focus:border-[var(--color-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10";

  return (
    <label className={`block ${field.colSpan || ""}`}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-gray-500">
        <Icon size={13} className="text-[var(--color-primary)]" />
        {field.label}
      </span>
      {field.type === "textarea" ? (
        <textarea
          required
          rows={4}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => onChange(field.name, event.target.value)}
          className={`${inputClass} resize-none leading-7`}
        />
      ) : (
        <input
          required
          type="text"
          dir={field.dir || "rtl"}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => onChange(field.name, event.target.value)}
          className={inputClass}
        />
      )}
    </label>
  );
}

export default function RolandGarrosBannerManager() {
  const [form, setForm] = useState(cloneDefaultBanner);
  const [initial, setInitial] = useState(cloneDefaultBanner);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadBanner() {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "خطا در بارگذاری بنر");
        if (cancelled) return;

        const nextBanner = data.banner || cloneDefaultBanner();
        setForm(nextBanner);
        setInitial(nextBanner);
      } catch (err) {
        if (!cancelled) {
          setLoadError(true);
          showToast.error(err.message || "خطا در بارگذاری بنر رولند گاروس");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBanner();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "home/roland-garros");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در آپلود تصویر");

      updateField("imageUrl", data.url);
      showToast.success("تصویر بنر آپلود شد");
    } catch (err) {
      showError("خطا", err.message || "خطا در آپلود تصویر");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const resetToDefault = () => {
    setForm(cloneDefaultBanner());
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banner: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره بنر");

      setForm(data.banner);
      setInitial(data.banner);
      showToast.success("بنر رولند گاروس ذخیره شد");
    } catch (err) {
      showError("خطا", err.message || "خطا در ذخیره بنر");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoader />;

  if (loadError) {
    return (
      <div dir="rtl">
        <Link
          href="/p-admin/admin-home"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold transition-all hover:gap-2.5"
          style={{ color: "var(--color-primary)" }}
        >
          <FiArrowRight size={12} /> بازگشت
        </Link>
        <div className="rounded-2xl border-2 border-dashed border-red-200 bg-white py-16 text-center text-sm font-bold text-red-400">
          خطا در بارگذاری اطلاعات — صفحه را تازه‌سازی کنید
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/p-admin/admin-home"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold transition-all hover:gap-2.5"
            style={{ color: "var(--color-primary)" }}
          >
            <FiArrowRight size={12} /> بازگشت
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <FiAward style={{ color: "var(--color-secondary)" }} />
            بنر رولند گاروس
          </h1>
          <p className="mt-0.5 text-xs font-bold text-gray-400">
            متن‌ها، تصویر و لینک بنر رولند گاروس صفحه اصلی
          </p>
        </div>

        <span
          className="rounded-full px-3 py-1 text-[11px] font-bold"
          style={{
            background: dirty ? "rgba(255,191,0,0.18)" : "rgba(34,197,94,0.1)",
            color: dirty ? "#9a6700" : "#16a34a",
          }}
        >
          {dirty ? "تغییرات ذخیره‌نشده" : "ذخیره‌شده"}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl border bg-white shadow-sm"
          style={{ borderColor: "#e8e4df" }}
        >
          <div className="h-1 w-full bg-[var(--color-primary)]" />
          <div className="space-y-5 p-5">
            <div>
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-gray-500">
                <FiImage size={13} className="text-[var(--color-primary)]" />
                تصویر بنر
              </span>
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                <div className="relative h-44 w-full bg-gray-100">
                  {form.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.imageUrl}
                      alt={form.imageAlt || ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-gray-300">
                      <FiImage size={32} />
                      <span className="mt-2 text-xs font-bold">تصویری انتخاب نشده</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-3">
                  <input
                    required
                    type="text"
                    dir="ltr"
                    value={form.imageUrl}
                    onChange={(event) => updateField("imageUrl", event.target.value)}
                    placeholder="/images/roland-garros.webp"
                    className="w-full rounded-xl border-2 border-gray-100 bg-white px-3 py-2.5 text-left text-sm font-bold text-gray-800 outline-none transition-all focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
                  />
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-gray-700">
                    {uploading ? (
                      <FiLoader className="animate-spin" size={14} />
                    ) : (
                      <FiUploadCloud size={14} />
                    )}
                    {uploading ? "در حال آپلود..." : "آپلود تصویر"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading}
                      onChange={handleUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {TEXT_FIELDS.map((field) => (
                <FormField
                  key={field.name}
                  field={field}
                  value={form[field.name] || ""}
                  onChange={updateField}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
              <button
                type="submit"
                disabled={saving || uploading || !dirty}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
                {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </button>

              <button
                type="button"
                onClick={resetToDefault}
                disabled={saving || uploading}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-500 transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FiRefreshCcw />
                بازگردانی پیش‌فرض
              </button>
            </div>
          </div>
        </form>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <FiImage className="text-[var(--color-primary)]" />
            پیش‌نمایش با استایل واقعی صفحه اصلی
          </div>
          <div
            className="overflow-hidden rounded-2xl border bg-white p-3 shadow-sm"
            style={{ borderColor: "#e8e4df" }}
          >
            <div className="pointer-events-none overflow-hidden rounded-xl">
              <RolandGarros content={form} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
