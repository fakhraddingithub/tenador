"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FiArrowRight, FiUploadCloud, FiSave, FiLoader, FiLink, FiType, FiLayers, FiEye } from "react-icons/fi";
import Image from "next/image";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

export default function EditSlide() {
  const router = useRouter();
  const { id } = useParams(); // گرفتن آی‌دی اسلاید از URL
  
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [file, setFile] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    link: "",
    position: "home",
    isActive: true,
  });

  // ۱. دریافت اطلاعات اسلاید فعلی
  useEffect(() => {
    const fetchSlideData = async () => {
      try {
        const res = await fetch(`/api/slides/${id}`);
        const data = await res.json();
        
        if (res.ok) {
          setFormData({
            title: data.title || "",
            subtitle: data.subtitle || "",
            link: data.link || "",
            position: data.position || "home",
            isActive: data.isActive,
          });
          setImagePreview(data.image);
        } else {
          toast.error("اسلاید پیدا نشد");
          router.push("/p-admin/admin-home/slider");
        }
      } catch (error) {
        toast.error("خطا در دریافت اطلاعات");
      } finally {
        setLoading(false);
      }
    };

    fetchSlideData();
  }, [id, router]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

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

  // ۲. عملیات بروزرسانی
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      let imageUrl = imagePreview;

      // اگر عکس جدید انتخاب شده باشد، اول آن را آپلود کن
      if (file) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        uploadData.append("folder", "slides");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        });
        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) throw new Error("خطا در آپلود عکس جدید");
        imageUrl = uploadResult.url;
      }

      // آپدیت نهایی در دیتابیس (متد PUT)
      const res = await fetch(`/api/slides/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, image: imageUrl }),
      });

      if (res.ok) {
        toast.success("تغییرات با موفقیت ذخیره شد", { toastId: "edit-success" });
        setTimeout(() => router.push("/p-admin/admin-home/slider"), 1500);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || "خطا در آپدیت");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <FiLoader className="animate-spin text-4xl text-[var(--color-primary)]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-10 " dir="rtl">
      <div className="max-w-3xl mx-auto">
        
        <header className="flex items-center justify-between mb-8">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-black font-bold">
            <FiArrowRight /> بازگشت
          </button>
          <h1 className="text-2xl font-bold italic text-[var(--color-primary)]">ویرایش اسلاید</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* بخش تصویر */}
          <div className="bg-white p-6 rounded-[var(--radius)] shadow-sm border border-gray-100">
            <div className="relative h-60 rounded-[var(--radius)] overflow-hidden border-2 border-gray-100 group">
              <Image src={imagePreview} alt="Slide Preview" fill className="object-cover" />
              <label htmlFor="file-edit" className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                <FiUploadCloud size={30} />
                <span className="mt-2 font-bold">تغییر تصویر اسلاید</span>
              </label>
              <input type="file" id="file-edit" className="hidden" onChange={handleImageChange} />
            </div>
          </div>

          {/* فرم اطلاعات */}
          <div className="bg-white p-8 rounded-[var(--radius)] shadow-sm border border-gray-100 space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400">عنوان اصلی</label>
                <input name="title" type="text" value={formData.title} onChange={handleChange} className="w-full border p-3 rounded-[var(--radius)] outline-none focus:border-[var(--color-primary)]" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400">زیر متن</label>
                <input name="subtitle" type="text" value={formData.subtitle} onChange={handleChange} className="w-full border p-3 rounded-[var(--radius)] outline-none focus:border-[var(--color-primary)]" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400">لینک مقصد (URL)</label>
              <input name="link" type="text" value={formData.link} onChange={handleChange} dir="ltr" className="w-full border p-3 rounded-[var(--radius)] outline-none focus:border-[var(--color-primary)] text-left" />
            </div>

            <div className="flex items-center justify-between pt-6 border-t">
              <label className="flex items-center gap-3 cursor-pointer">
                <input name="isActive" type="checkbox" checked={formData.isActive} onChange={handleChange} className="w-5 h-5 accent-[var(--color-primary)]" />
                <span className="text-sm font-bold">نمایش فعال باشد</span>
              </label>

              <button 
                type="submit" 
                disabled={isUpdating}
                className="bg-[var(--color-text)] text-white px-8 py-3 rounded-[var(--radius)] font-bold flex items-center gap-2 hover:bg-[var(--color-primary)] transition-all disabled:opacity-50"
              >
                {isUpdating ? <FiLoader className="animate-spin" /> : <FiSave />}
                {isUpdating ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}