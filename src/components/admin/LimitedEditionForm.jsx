"use client";

/**
 * فرم ساخت و ویرایش لیمیتد ادیشن — هم‌راستا با استاندارد فرم‌های پنل ادمین
 * (رجوع شود به SerieFormLayout / سایر فرم‌ها). عملکرد و APIها دست‌نخورده.
 */

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  FaSave,
  FaCrown,
  FaPalette,
  FaIdCard,
  FaFont,
  FaQuoteRight,
  FaRocket,
} from "react-icons/fa";
import { useRouter } from "next/navigation";
import ImageUpload from "./ImageUpload";

const emptyForm = {
  name: "",
  title: "",
  description: "",
  colors: { primary: "#000000", secondary: "#ffffff" },
  logo: "",
  headImage: "",
  image: "",
};

export default function LimitedEditionForm({ brandId, limitedEditionId = null }) {
  const router = useRouter();
  const isEdit = !!limitedEditionId;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (!isEdit) return;

    (async () => {
      try {
        const res = await fetch(`/api/limited-editions/${limitedEditionId}`);
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "خطا در دریافت اطلاعات لیمیتد ادیشن");
          return;
        }
        const c = data.limitedEdition;
        setFormData({
          name: c?.name || "",
          title: c?.title || "",
          description: c?.description || "",
          colors: {
            primary: c?.colors?.primary || "#000000",
            secondary: c?.colors?.secondary || "#ffffff",
          },
          logo: c?.logo || "",
          headImage: c?.headImage || "",
          image: c?.image || "",
        });
      } catch {
        toast.error("خطا در بارگذاری اطلاعات");
      } finally {
        setFetching(false);
      }
    })();
  }, [limitedEditionId, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(
        isEdit
          ? `/api/limited-editions/${limitedEditionId}`
          : "/api/limited-editions/create",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEdit ? formData : { ...formData, brand: brandId }),
        }
      );
      const result = await res.json();
      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: isEdit
            ? "لیمیتد ادیشن با موفقیت ویرایش شد"
            : "لیمیتد ادیشن با موفقیت ایجاد شد",
          text: `لیمیتد ادیشن ${formData.title} ${isEdit ? "به‌روزرسانی" : "ایجاد"} گردید.`,
          confirmButtonColor: "var(--color-primary)",
          customClass: { popup: "rounded-2xl font-[Vazirmatn] text-right" },
        }).then(() => {
          router.push(`/p-admin/admin-brands/${brandId}`);
          router.refresh();
        });
      } else {
        toast.error(result.error || "خطا در ثبت لیمیتد ادیشن");
      }
    } catch {
      toast.error("خطای شبکه؛ اتصال اینترنت را بررسی کنید");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-100 border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  const sectionCls =
    "bg-white rounded-2xl border border-gray-100 shadow-sm";
  const labelCls =
    "text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2";
  const inputCls =
    "w-full bg-gray-50 border border-gray-100 rounded-[var(--radius)] px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all";

  return (
    <form onSubmit={handleSubmit} dir="rtl" className="w-full space-y-6">
      {/* Header */}
      <div className={`${sectionCls} px-5 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-[var(--radius)] flex items-center justify-center text-white"
            style={{ background: "var(--color-primary)" }}
          >
            <FaCrown size={16} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? "ویرایش لیمیتد ادیشن" : "لیمیتد ادیشن جدید"}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">
              Brand / Limited Edition
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: assets + colors */}
        <div className="lg:col-span-4 space-y-5">
          <div className={`${sectionCls} p-5 space-y-4`}>
            <h3 className={labelCls}>تصاویر</h3>
            <ImageUpload
              label="تصویر هدر"
              value={formData.headImage}
              onChange={(url) => setFormData((p) => ({ ...p, headImage: url }))}
              folder="limited-editions/headImages"
            />
            <div className="grid grid-cols-2 gap-3">
              <ImageUpload
                label="آیکون"
                value={formData.logo}
                onChange={(url) => setFormData((p) => ({ ...p, logo: url }))}
                folder="limited-editions/logos"
              />
              <ImageUpload
                label="تصویر اصلی"
                value={formData.image}
                onChange={(url) => setFormData((p) => ({ ...p, image: url }))}
                folder="limited-editions/covers"
              />
            </div>
          </div>

          <div className={`${sectionCls} p-5 space-y-3`}>
            <h3 className={labelCls}>
              <FaPalette style={{ color: "var(--color-primary)" }} />
              رنگ برند
            </h3>
            <ColorRow
              label="رنگ اصلی"
              value={formData.colors.primary}
              onChange={(v) =>
                setFormData((p) => ({
                  ...p,
                  colors: { ...p.colors, primary: v },
                }))
              }
            />
            <ColorRow
              label="رنگ ثانویه"
              value={formData.colors.secondary}
              onChange={(v) =>
                setFormData((p) => ({
                  ...p,
                  colors: { ...p.colors, secondary: v },
                }))
              }
            />
          </div>
        </div>

        {/* Right: identity */}
        <div className="lg:col-span-8 space-y-5">
          <div className={`${sectionCls} p-5 space-y-5`}>
            <h3 className={labelCls}>
              <FaIdCard style={{ color: "var(--color-primary)" }} />
              اطلاعات هویتی
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls}>
                  <FaFont /> Name (English)
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="e.g. Roland-Garros"
                  required
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>عنوان فارسی</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="مثلاً رولان گاروس"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>
                <FaQuoteRight /> توضیحات
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                className={`${inputCls} leading-7 py-3`}
                placeholder="توضیحات این لیمیتد ادیشن..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-[var(--radius)] font-bold text-sm text-white flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isEdit ? <FaSave size={13} /> : <FaRocket size={13} />}
                {isEdit ? "ذخیره تغییرات" : "ثبت لیمیتد ادیشن"}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-[var(--radius)] px-3 py-2">
      <span className="text-xs font-bold text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-gray-500 uppercase" dir="ltr">
          {value}
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-md border border-gray-200 cursor-pointer bg-transparent"
        />
      </div>
    </div>
  );
}
