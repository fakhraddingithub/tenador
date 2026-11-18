"use client";

import { useEffect, useState } from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiExternalLink,
  FiLoader,
  FiPlus,
  FiRefreshCcw,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import AdminLoader from "@/components/admin/AdminLoader";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";
import { SOCIAL_ICONS } from "@/components/features/footer/socialIcons";
import { showToast } from "@/lib/toast";
import { showError } from "@/lib/swal";
import {
  DEFAULT_SITE_FOOTER,
  FOOTER_LIMITS,
  FOOTER_SOCIAL_PLATFORMS,
  normalizeSiteFooter,
} from "@/lib/siteFooter";

const API_URL = "/api/admin/footer";

const inputClass =
  "w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-800 outline-none transition-all focus:border-[var(--color-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:opacity-70";
const iconBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-30";

const NEWSLETTER_FIELDS = [
  { key: "title", label: "عنوان خبرنامه" },
  { key: "description", label: "توضیح خبرنامه" },
  { key: "placeholder", label: "متن داخل کادر ایمیل" },
  { key: "buttonLabel", label: "متن دکمه عضویت" },
  { key: "subscribedTitle", label: "عنوان بعد از عضویت" },
  { key: "subscribedDescription", label: "توضیح بعد از عضویت" },
];

const clone = (v) => JSON.parse(JSON.stringify(v));
const move = (list, from, to) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
};

function Card({ title, hint, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "#e8e4df" }}>
      <div className="h-1 w-full bg-[var(--color-primary)]" />
      <div className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-black text-gray-800">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] font-bold text-gray-400">{hint}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export default function FooterManager() {
  const { can } = useAdminPermissions();
  const canEdit = can("footer.edit");
  const [form, setForm] = useState(() => normalizeSiteFooter(null));
  const [initial, setInitial] = useState(form);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  useEffect(() => {
    let cancelled = false;
    fetch(API_URL)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "خطا در بارگذاری فوتر");
        if (cancelled) return;
        setForm(data.footer);
        setInitial(data.footer);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(true);
        showToast.error(err.message || "خطا در بارگذاری فوتر");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // نوشتن روی یک کپیِ عمیق — فرم کوچک است و این ساده‌ترین راهِ بی‌خطای به‌روزرسانیِ تودرتوست.
  const edit = (fn) =>
    setForm((prev) => {
      const next = clone(prev);
      fn(next);
      return next;
    });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ footer: form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors || [data.error || "خطا در ذخیره فوتر"]);
        throw new Error(data.error || "خطا در ذخیره فوتر");
      }
      setForm(data.footer);
      setInitial(data.footer);
      showToast.success("فوتر ذخیره شد");
    } catch (err) {
      showError("خطا", err.message || "خطا در ذخیره فوتر");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoader />;
  if (loadError) {
    return (
      <div className="max-w-4xl rounded-2xl border-2 border-dashed border-red-200 bg-white py-16 text-center text-sm font-bold text-red-400">
        خطا در بارگذاری اطلاعات فوتر — صفحه را تازه‌سازی کنید
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-gray-400">
          هر متنی که خالی بماند در فوتر سایت نمایش داده نمی‌شود.
        </p>
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

      <fieldset disabled={!canEdit || saving} className="space-y-5">
        <Card title="خبرنامه" hint="بخش بالای فوتر">
          <div className="grid gap-4 md:grid-cols-2">
            {NEWSLETTER_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  className={inputClass}
                  maxLength={FOOTER_LIMITS.text}
                  value={form.newsletter[f.key]}
                  placeholder={DEFAULT_SITE_FOOTER.newsletter[f.key]}
                  onChange={(e) => edit((d) => void (d.newsletter[f.key] = e.target.value))}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card title="معرفی و اطلاعات تماس" hint="ستون کنار لوگو — تلفن و آدرس بالای ایمیل نمایش داده می‌شوند">
          <Field label="متن معرفی فروشگاه">
            <textarea
              rows={3}
              className={`${inputClass} resize-y leading-7`}
              maxLength={FOOTER_LIMITS.description}
              value={form.description}
              onChange={(e) => edit((d) => void (d.description = e.target.value))}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="شماره تلفن">
              <input
                className={inputClass}
                maxLength={FOOTER_LIMITS.text}
                value={form.contact.phone}
                placeholder="۰۲۱-۱۲۳۴۵۶۷۸"
                onChange={(e) => edit((d) => void (d.contact.phone = e.target.value))}
              />
            </Field>
            <Field label="ایمیل">
              <input
                type="email"
                dir="ltr"
                className={`${inputClass} text-left [direction:ltr]`}
                maxLength={FOOTER_LIMITS.text}
                value={form.contact.email}
                onChange={(e) => edit((d) => void (d.contact.email = e.target.value))}
              />
            </Field>
            <Field label="آدرس" className="md:col-span-2">
              <textarea
                rows={2}
                className={`${inputClass} resize-y leading-7`}
                maxLength={500}
                value={form.contact.address}
                onChange={(e) => edit((d) => void (d.contact.address = e.target.value))}
              />
            </Field>
          </div>
        </Card>

        <Card title="شبکه‌های اجتماعی" hint="فقط شبکه‌های فعال با لینک در فوتر نمایش داده می‌شوند">
          <ul className="divide-y divide-gray-100">
            {form.socials.map((s, i) => {
              const Icon = SOCIAL_ICONS[s.platform];
              const label = FOOTER_SOCIAL_PLATFORMS.find((p) => p.key === s.platform)?.label;
              return (
                <li key={s.platform} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <label className="flex w-40 cursor-pointer items-center gap-2 text-sm font-bold text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--color-primary)]"
                      checked={s.enabled}
                      onChange={(e) => edit((d) => void (d.socials[i].enabled = e.target.checked))}
                    />
                    <Icon size={18} className={s.enabled ? "text-[var(--color-primary)]" : "text-gray-300"} />
                    {label}
                  </label>
                  <input
                    dir="ltr"
                    aria-label={`لینک ${label}`}
                    className={`${inputClass} min-w-0 flex-1 basis-64 text-left [direction:ltr]`}
                    placeholder="https://"
                    maxLength={FOOTER_LIMITS.href}
                    value={s.href}
                    onChange={(e) => edit((d) => void (d.socials[i].href = e.target.value))}
                  />
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="ستون‌های لینک"
          hint={`حداکثر ${FOOTER_LIMITS.sections} ستون؛ آدرس داخلی با / شروع می‌شود (مثل /about) و آدرس بیرونی با https://`}
        >
          <div className="space-y-4">
            {form.sections.map((section, si) => (
              <div key={si} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <input
                    aria-label={`عنوان ستون ${si + 1}`}
                    className={`${inputClass} flex-1 bg-white`}
                    placeholder="عنوان ستون"
                    maxLength={FOOTER_LIMITS.text}
                    value={section.title}
                    onChange={(e) => edit((d) => void (d.sections[si].title = e.target.value))}
                  />
                  <button type="button" className={iconBtn} title="انتقال به قبل" disabled={si === 0}
                    onClick={() => edit((d) => void (d.sections = move(d.sections, si, si - 1)))}>
                    <FiArrowUp />
                  </button>
                  <button type="button" className={iconBtn} title="انتقال به بعد" disabled={si === form.sections.length - 1}
                    onClick={() => edit((d) => void (d.sections = move(d.sections, si, si + 1)))}>
                    <FiArrowDown />
                  </button>
                  <button type="button" className={`${iconBtn} hover:!border-red-300 hover:!text-red-500`} title="حذف ستون"
                    onClick={() => {
                      if (section.links.length && !window.confirm(`ستون «${section.title || si + 1}» با همه‌ی لینک‌هایش حذف شود؟`)) return;
                      edit((d) => void d.sections.splice(si, 1));
                    }}>
                    <FiTrash2 />
                  </button>
                </div>

                <ul className="space-y-2">
                  {section.links.map((link, li) => (
                    <li key={li} className="flex flex-wrap items-center gap-2">
                      <input
                        aria-label="متن لینک"
                        className={`${inputClass} min-w-0 flex-1 basis-40 bg-white`}
                        placeholder="متن لینک"
                        maxLength={FOOTER_LIMITS.text}
                        value={link.label}
                        onChange={(e) => edit((d) => void (d.sections[si].links[li].label = e.target.value))}
                      />
                      <input
                        dir="ltr"
                        aria-label="آدرس لینک"
                        className={`${inputClass} min-w-0 flex-1 basis-40 bg-white text-left [direction:ltr]`}
                        placeholder="/about"
                        maxLength={FOOTER_LIMITS.href}
                        value={link.href}
                        onChange={(e) => edit((d) => void (d.sections[si].links[li].href = e.target.value))}
                      />
                      <div className="flex gap-1">
                        <button type="button" className={iconBtn} title="بالا" disabled={li === 0}
                          onClick={() => edit((d) => void (d.sections[si].links = move(d.sections[si].links, li, li - 1)))}>
                          <FiArrowUp />
                        </button>
                        <button type="button" className={iconBtn} title="پایین" disabled={li === section.links.length - 1}
                          onClick={() => edit((d) => void (d.sections[si].links = move(d.sections[si].links, li, li + 1)))}>
                          <FiArrowDown />
                        </button>
                        <button type="button" className={`${iconBtn} hover:!border-red-300 hover:!text-red-500`} title="حذف لینک"
                          onClick={() => edit((d) => void d.sections[si].links.splice(li, 1))}>
                          <FiTrash2 />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={section.links.length >= FOOTER_LIMITS.linksPerSection}
                  onClick={() => edit((d) => void d.sections[si].links.push({ label: "", href: "" }))}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] disabled:opacity-40"
                >
                  <FiPlus /> افزودن لینک
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={form.sections.length >= FOOTER_LIMITS.sections}
            onClick={() => edit((d) => void d.sections.push({ title: "", links: [{ label: "", href: "" }] }))}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-bold text-gray-500 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40"
          >
            <FiPlus /> افزودن ستون
          </button>
        </Card>

        <Card title="متن کپی‌رایت" hint="وسط‌چین در پایین فوتر">
          <input
            className={inputClass}
            maxLength={FOOTER_LIMITS.text}
            value={form.copyright}
            onChange={(e) => edit((d) => void (d.copyright = e.target.value))}
          />
        </Card>
      </fieldset>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-600">
          {errors.map((err, i) => (
            <li key={i}>• {err}</li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur" style={{ borderColor: "#e8e4df" }}>
        {canEdit ? (
          <>
            <button
              type="submit"
              disabled={saving || !dirty}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
              {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (window.confirm("همه‌ی فیلدها به مقادیر پیش‌فرض برگردند؟ (تا ذخیره نکنید چیزی تغییر نمی‌کند)")) {
                  setForm(normalizeSiteFooter(null));
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-500 transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40"
            >
              <FiRefreshCcw /> بازگردانی پیش‌فرض
            </button>
          </>
        ) : (
          <p className="text-xs font-bold text-gray-400">دسترسی ویرایش این بخش را ندارید — مقادیر فقط برای مشاهده‌اند.</p>
        )}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="ms-auto inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[var(--color-primary)]"
        >
          <FiExternalLink size={12} /> مشاهده سایت
        </a>
      </div>
    </form>
  );
}
