"use client";

/**
 * src/components/admin/LimitedEditionForm.jsx
 *
 * فرم ساخت و ویرایش لیمیتد ادیشن — ساختار مشابه فرم سری‌ها، اما به یک برند
 * خاص محدود است (brandId الزامی). مدیریت از صفحه‌ی همان برند انجام می‌شود.
 *
 * اگر limitedEditionId داده شود فرم در حالت ویرایش است (fetch + PUT)،
 * در غیر این صورت حالت ساخت (POST).
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
  colors: {
    primary: "#000000",
    secondary: "#ffffff",
  },
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

  /*
   |--------------------------------------------------------------------------
   | Load (Edit Mode)
   |--------------------------------------------------------------------------
   */

  useEffect(() => {
    if (!isEdit) return;

    const loadLimitedEdition = async () => {
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
    };

    loadLimitedEdition();
  }, [limitedEditionId, isEdit]);

  /*
   |--------------------------------------------------------------------------
   | Handlers
   |--------------------------------------------------------------------------
   */

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /*
   |--------------------------------------------------------------------------
   | Submit
   |--------------------------------------------------------------------------
   */

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
          headers: {
            "Content-Type": "application/json",
          },
          // برند فقط هنگام ساخت ارسال می‌شود تا لیمیتد ادیشن به همین برند محدود شود
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
        <div className="w-14 h-14 border-4 border-black/10 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-[var(--color-primary)] shadow-xl">
            <FaCrown size={24} />
          </div>

          <div>
            <h2 className="text-2xl font-bold italic">
              {isEdit ? "ویرایش لیمیتد ادیشن" : "پیکربندی لیمیتد ادیشن جدید"}
            </h2>

            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">
              Brand / Limited Edition
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}

        <div className="lg:col-span-4 space-y-6">
          {/* Uploads */}

          <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-gray-50 space-y-6">
            <ImageUpload
              label="تصویر هدر"
              value={formData.headImage}
              onChange={(url) =>
                setFormData((p) => ({
                  ...p,
                  headImage: url,
                }))
              }
              folder="limited-editions/headImages"
            />

            <div className="grid grid-cols-2 gap-4">
              <ImageUpload
                label="آیکون"
                value={formData.logo}
                onChange={(url) =>
                  setFormData((p) => ({
                    ...p,
                    logo: url,
                  }))
                }
                folder="limited-editions/logos"
              />

              <ImageUpload
                label="تصویر اصلی"
                value={formData.image}
                onChange={(url) =>
                  setFormData((p) => ({
                    ...p,
                    image: url,
                  }))
                }
                folder="limited-editions/covers"
              />
            </div>
          </div>

          {/* Colors */}

          <div className="bg-black p-8 rounded-[3rem] shadow-2xl text-white">
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-6 flex items-center gap-2">
              <FaPalette className="text-[var(--color-primary)]" />
              Color Branding
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                <span className="text-xs font-bold text-gray-300">
                  رنگ اصلی
                </span>

                <input
                  type="color"
                  value={formData.colors.primary}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,

                      colors: {
                        ...p.colors,

                        primary: e.target.value,
                      },
                    }))
                  }
                  className="w-10 h-10 bg-transparent border-none cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                <span className="text-xs font-bold text-gray-300">
                  رنگ ثانویه
                </span>

                <input
                  type="color"
                  value={formData.colors.secondary}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,

                      colors: {
                        ...p.colors,

                        secondary: e.target.value,
                      },
                    }))
                  }
                  className="w-10 h-10 bg-transparent border-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}

        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-gray-50 space-y-8">
            {/* Identity */}

            <h3 className="flex items-center gap-3 font-bold text-gray-900 italic uppercase">
              <FaIdCard className="text-blue-500" />
              Identity Info
            </h3>

            {/* Name + Title */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <FaFont />
                  Name (English Only)
                </label>

                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold"
                  placeholder="e.g. Roland-Garros"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  عنوان فارسی
                </label>

                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold text-right"
                  placeholder="مثلاً رولان گاروس"
                  required
                />
              </div>
            </div>

            {/* Description */}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <FaQuoteRight />
                توضیحات
              </label>

              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={6}
                className="w-full p-8 bg-gray-50 rounded-[2.5rem] leading-8"
                placeholder="توضیحات این لیمیتد ادیشن..."
              />
            </div>
          </div>

          {/* Submit */}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-8 rounded-[3rem] font-bold text-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isEdit ? "ذخیره تغییرات" : "ثبت لیمیتد ادیشن"}
                {isEdit ? (
                  <FaSave className="text-[var(--color-primary)]" />
                ) : (
                  <FaRocket className="text-[var(--color-primary)]" />
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
