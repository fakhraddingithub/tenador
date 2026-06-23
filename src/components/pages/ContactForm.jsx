"use client";

import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { CheckCircle2, Paperclip, Loader2, X } from "lucide-react";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toEnDigits = (s = "") =>
  String(s).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FILE = 5 * 1024 * 1024;

const EMPTY = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  message: "",
};

/**
 * فرم «تماس با ما» — اعتبارسنجی کامل فارسی، آپلودِ فایلِ اختیاری (تصویر/PDF) روی
 * Cloudinary از طریق /api/upload، و ارسال به /api/contact.
 */
export default function ContactForm({ accent = "#aa4725" }) {
  const [data, setData] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef(null);

  const setField = (name, value) => {
    setData((d) => ({ ...d, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!data.firstName.trim()) e.firstName = "نام را وارد کنید";
    if (!data.lastName.trim()) e.lastName = "نام خانوادگی را وارد کنید";
    if (!data.email.trim()) e.email = "ایمیل را وارد کنید";
    else if (!EMAIL_RE.test(data.email.trim())) e.email = "ایمیل معتبر نیست";

    const phone = toEnDigits(data.phone).trim();
    if (!phone) e.phone = "شماره تلفن را وارد کنید";
    else if (!/^\d{10,15}$/.test(phone))
      e.phone = "شماره تلفن باید فقط شامل ارقام باشد";

    if (!data.message.trim()) e.message = "متن پیام را وارد کنید";
    else if (data.message.trim().length < 10)
      e.message = "پیام باید حداقل ۱۰ نویسه باشد";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onFile = (f) => {
    if (!f) return;
    const okType =
      /^image\//.test(f.type) ||
      f.type === "application/pdf" ||
      /\.(jpe?g|png|webp|pdf)$/i.test(f.name || "");
    if (!okType) {
      toast.error("فقط تصویر (JPG/PNG/WebP) یا PDF مجاز است");
      return;
    }
    if (f.size > MAX_FILE) {
      toast.error("حجم فایل نباید بیشتر از ۵ مگابایت باشد");
      return;
    }
    setFile(f);
  };

  const uploadAttachment = async () => {
    if (!file) return { url: "", type: "" };
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "contact");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "خطا در آپلود فایل");
    const type = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
      ? "pdf"
      : "image";
    return { url: json.url, type };
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error("لطفاً خطاهای فرم را برطرف کنید");
      return;
    }
    setSubmitting(true);
    try {
      const attachment = await uploadAttachment();
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          phone: toEnDigits(data.phone).trim(),
          attachmentUrl: attachment.url,
          attachmentType: attachment.type,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در ارسال پیام");

      setSent(true);
      setData(EMPTY);
      setFile(null);
      toast.success("پیام شما با موفقیت ارسال شد");
    } catch (err) {
      toast.error(err.message || "ارسال پیام ناموفق بود");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-12 px-6">
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5"
          style={{ background: `color-mix(in srgb, ${accent} 14%, white)`, color: accent }}
        >
          <CheckCircle2 size={34} />
        </div>
        <h3 className="text-xl font-black text-[var(--color-text)] mb-2">
          پیام شما دریافت شد
        </h3>
        <p className="text-gray-500 leading-7 mb-6">
          از تماس شما سپاسگزاریم. تیم ما در اولین فرصت پاسخ خواهد داد.
        </p>
        <button
          onClick={() => setSent(false)}
          className="text-sm font-bold underline"
          style={{ color: accent }}
        >
          ارسال پیام دیگر
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="نام"
          required
          value={data.firstName}
          onChange={(v) => setField("firstName", v)}
          error={errors.firstName}
          accent={accent}
          autoComplete="given-name"
        />
        <Field
          label="نام خانوادگی"
          required
          value={data.lastName}
          onChange={(v) => setField("lastName", v)}
          error={errors.lastName}
          accent={accent}
          autoComplete="family-name"
        />
      </div>

      <Field
        label="نام شرکت / سازمان"
        value={data.company}
        onChange={(v) => setField("company", v)}
        accent={accent}
        hint="اختیاری"
        autoComplete="organization"
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="ایمیل"
          type="email"
          required
          value={data.email}
          onChange={(v) => setField("email", v)}
          error={errors.email}
          accent={accent}
          dir="ltr"
          autoComplete="email"
        />
        <Field
          label="شماره تلفن"
          type="tel"
          required
          value={data.phone}
          onChange={(v) => setField("phone", v)}
          error={errors.phone}
          accent={accent}
          dir="ltr"
          inputMode="numeric"
          autoComplete="tel"
        />
      </div>

      {/* پیام */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1.5">
          متن پیام <span style={{ color: accent }}>*</span>
        </label>
        <textarea
          value={data.message}
          onChange={(e) => setField("message", e.target.value)}
          rows={5}
          className="w-full px-4 py-3 text-sm font-medium rounded-[6px] border-2 bg-gray-50 text-gray-900 placeholder-gray-400 outline-none transition-all focus:bg-white resize-y"
          style={{ borderColor: errors.message ? "#f87171" : "#e5e7eb" }}
          onFocus={(e) => !errors.message && (e.target.style.borderColor = accent)}
          onBlur={(e) => (e.target.style.borderColor = errors.message ? "#f87171" : "#e5e7eb")}
          placeholder="پیام خود را اینجا بنویسید…"
        />
        {errors.message ? (
          <p className="mt-1 text-xs text-red-500 font-bold">{errors.message}</p>
        ) : null}
      </div>

      {/* پیوست */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1.5">
          فایل پیوست <span className="text-gray-400 font-medium">(اختیاری — تصویر یا PDF)</span>
        </label>
        {file ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[6px] border-2 border-gray-200 bg-gray-50">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700 truncate">
              <Paperclip size={16} style={{ color: accent }} />
              <span className="truncate">{file.name}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              aria-label="حذف فایل"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <label
            className="flex items-center justify-center gap-2 px-4 py-4 rounded-[6px] border-2 border-dashed border-gray-200 bg-gray-50 text-sm font-bold text-gray-500 cursor-pointer transition-colors hover:border-gray-300"
          >
            <Paperclip size={18} />
            انتخاب فایل
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[6px] text-white font-black text-[15px] transition-all disabled:opacity-60 hover:brightness-110 active:scale-[0.99]"
        style={{ background: accent }}
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            در حال ارسال…
          </>
        ) : (
          "ارسال پیام"
        )}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  accent,
  required,
  hint,
  type = "text",
  ...props
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-1.5">
        {label}
        {required ? <span style={{ color: accent }}> *</span> : null}
        {hint ? <span className="text-gray-400 font-medium"> ({hint})</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 text-sm font-medium rounded-[6px] border-2 bg-gray-50 text-gray-900 placeholder-gray-400 outline-none transition-all focus:bg-white"
        style={{ borderColor: error ? "#f87171" : "#e5e7eb" }}
        onFocus={(e) => !error && (e.target.style.borderColor = accent)}
        onBlur={(e) => (e.target.style.borderColor = error ? "#f87171" : "#e5e7eb")}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-500 font-bold">{error}</p>
      ) : null}
    </div>
  );
}
