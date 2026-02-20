"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiUploadCloud, FiCheck, FiLoader, FiLink, FiType, FiLayers } from "react-icons/fi";
import Image from "next/image";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

export default function CreateSlide() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [file, setFile] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    link: "",
    position: "home",
    isActive: true,
  });

  // ۱. هندل کردن تغییرات اینپوت‌ها
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // ۲. هندل کردن انتخاب عکس
  const handleImageChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 2 * 1024 * 1024) {
        return toast.error("حجم فایل نباید بیشتر از ۲ مگابایت باشد");
      }
      setFile(selectedFile);
      setImagePreview(URL.createObjectURL(selectedFile));
    }
  };

  // ۳. ثبت نهایی فرم
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.warn("لطفاً ابتدا یک تصویر انتخاب کنید");

    setLoading(true);

    try {
      // مرحله اول: آپلود عکس به Cloudinary
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("folder", "slides");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });

      const uploadResult = await uploadRes.json();

      if (!uploadRes.ok) throw new Error(uploadResult.error || "خطا در آپلود عکس");

      // مرحله دوم: ساخت اسلاید با لینک عکس دریافت شده
      const slideRes = await fetch("/api/slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          image: uploadResult.url,
        }),
      });

      const slideResult = await slideRes.json();

      if (slideRes.ok) {
        toast.success("اسلاید با موفقیت ساخته شد");
        setTimeout(() => router.push("/p-admin/admin-home/slider"), 1500);
      } else {
        throw new Error(slideResult.message || "خطا در ثبت اسلاید");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-10" dir="rtl">
      <ToastContainer rtl />
      
      <div className="max-w-3xl mx-auto">
        {/* هدر */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-500 hover:text-[var(--color-text)] transition-all font-bold"
          >
            <FiArrowRight /> بازگشت
          </button>
          <h1 className="text-2xl font-bold">ساخت اسلاید جدید</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* بخش آپلود تصویر */}
          <div className="bg-white p-6 rounded-[var(--radius)] shadow-sm border border-gray-100">
            <label className="block text-sm font-bold mb-4 text-gray-400 uppercase tracking-widest">تصویر اسلاید (اجباری)</label>
            <div 
              className={`relative h-64 rounded-[var(--radius)] border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden ${
                imagePreview ? "border-[var(--color-primary)]" : "border-gray-200 hover:border-[var(--color-primary)]/50"
              }`}
            >
              {imagePreview ? (
                <>
                  <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                    <label htmlFor="image-upload" className="cursor-pointer text-white font-bold">تغییر تصویر</label>
                  </div>
                </>
              ) : (
                <label htmlFor="image-upload" className="flex flex-col items-center cursor-pointer p-10 text-center">
                  <FiUploadCloud size={48} className="text-gray-300 mb-4" />
                  <span className="text-gray-500 font-bold">فایل را اینجا بکشید یا کلیک کنید</span>
                  <span className="text-xs text-gray-400 mt-2">حداکثر ۲ مگابایت (WebP, JPG, PNG)</span>
                </label>
              )}
              <input id="image-upload" type="file" className="hidden" onChange={handleImageChange} accept="image/*" />
            </div>
          </div>

          {/* اطلاعات متنی */}
          <div className="bg-white p-8 rounded-[var(--radius)] shadow-sm border border-gray-100 space-y-6">
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                  <FiType className="text-[var(--color-primary)]" /> عنوان اصلی
                </label>
                <input 
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="مثلاً: تخفیف‌های پایان فصل"
                  className="w-full border border-gray-200 rounded-[var(--radius)] px-4 py-3 outline-none focus:border-[var(--color-primary)] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                  <FiLayers className="text-[var(--color-primary)]" /> زیرعنوان (Subtitle)
                </label>
                <input 
                  name="subtitle"
                  type="text"
                  value={formData.subtitle}
                  onChange={handleChange}
                  placeholder="توضیح کوتاه زیر عنوان..."
                  className="w-full border border-gray-200 rounded-[var(--radius)] px-4 py-3 outline-none focus:border-[var(--color-primary)] transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                <FiLink className="text-[var(--color-primary)]" /> لینک هدایت‌کننده
              </label>
              <input 
                name="link"
                type="text"
                value={formData.link}
                onChange={handleChange}
                placeholder="https://tenador.com/products/..."
                dir="ltr"
                className="w-full border border-gray-200 rounded-[var(--radius)] px-4 py-3 outline-none focus:border-[var(--color-primary)] transition-all text-left"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    name="isActive"
                    type="checkbox" 
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                </label>
                <span className="text-sm font-bold text-gray-600">نمایش در سایت فعال باشد</span>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-[var(--color-text)] text-white px-10 py-4 rounded-[var(--radius)] font-bold hover:bg-[var(--color-primary)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-black/10"
              >
                {loading ? <FiLoader className="animate-spin" /> : <FiCheck />}
                {loading ? "در حال پردازش..." : "ثبت و انتشار اسلاید"}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}