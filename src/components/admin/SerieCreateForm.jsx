"use client";

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { 
  FaSave, FaLayerGroup, FaPalette, FaIdCard, 
  FaFont, FaQuoteRight, FaImage, FaRocket, FaIcons
} from "react-icons/fa";
import { useRouter } from "next/navigation";
import ImageUpload from "./ImageUpload"; // کامپوننت آپلود اختصاصی شما

export default function SerieCreateForm({ initialData, brandId, brandName }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    title: initialData?.title || "",
    description: initialData?.description || "",
    brand: brandId, // از ورودی کامپوننت گرفته می‌شود
    colors: {
      primary: initialData?.colors?.primary || "#000000",
      secondary: initialData?.colors?.secondary || "#ffffff",
    },
    logo: initialData?.logo || "",
    icon: initialData?.icon || "",
    image: initialData?.image || "",
  });

  // هماهنگ‌سازی با داده‌های AI
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        brand: brandId // برند همیشه باید ثابت بماند
      }));
    }
  }, [initialData, brandId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/series/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "سری با موفقیت ایجاد شد",
          text: `سری ${formData.title} به لیست برند ${brandName} اضافه گردید.`,
          confirmButtonColor: "var(--color-primary)",
        }).then(() => {
          router.push(`/p-admin/admin-brands/${brandId}`);
          router.refresh();
        });
      } else {
        toast.error(result.error || "خطایی در ثبت سری رخ داد");
      }
    } catch (err) {
      toast.error("خطای شبکه؛ لطفاً اتصال خود را چک کنید");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      
      {/* Header بخش مدیریت */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-[var(--color-primary)] shadow-xl">
                <FaLayerGroup size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-bold italic">پیکربندی سری محصولات</h2>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                    Brand: <span className="text-black">{brandName}</span>
                </p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ستون چپ: آپلود رسانه و رنگ */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* بخش آپلودها */}
          <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-gray-50 space-y-6">
            <ImageUpload 
                label="تصویر اصلی (Cover)" 
                value={formData.image} 
                onChange={(url) => setFormData(p => ({...p, image: url}))}
                folder="series/covers"
            />
            <div className="grid grid-cols-2 gap-4">
                <ImageUpload 
                    label="لوگو" 
                    value={formData.logo} 
                    onChange={(url) => setFormData(p => ({...p, logo: url}))}
                    folder="series/logos"
                />
                <ImageUpload 
                    label="آیکون" 
                    value={formData.icon} 
                    onChange={(url) => setFormData(p => ({...p, icon: url}))}
                    folder="series/icons"
                />
            </div>
          </div>

          {/* بخش رنگ‌ها */}
          <div className="bg-black p-8 rounded-[3rem] shadow-2xl text-white">
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-6 flex items-center gap-2">
                <FaPalette className="text-[var(--color-primary)]" /> Color Branding
            </h3>
            <div className="space-y-4">
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                    <span className="text-xs font-bold text-gray-300">رنگ اصلی</span>
                    <input 
                        type="color" 
                        value={formData.colors.primary} 
                        onChange={(e) => setFormData(p => ({...p, colors: {...p.colors, primary: e.target.value}}))}
                        className="w-10 h-10 bg-transparent border-none cursor-pointer"
                    />
                </div>
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                    <span className="text-xs font-bold text-gray-300">رنگ ثانویه</span>
                    <input 
                        type="color" 
                        value={formData.colors.secondary} 
                        onChange={(e) => setFormData(p => ({...p, colors: {...p.colors, secondary: e.target.value}}))}
                        className="w-10 h-10 bg-transparent border-none cursor-pointer"
                    />
                </div>
            </div>
          </div>
        </div>

        {/* ستون راست: اطلاعات متنی */}
        <div className="lg:col-span-8 space-y-8">
          
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-gray-50 space-y-8">
            <h3 className="flex items-center gap-3 font-bold text-gray-900 italic uppercase">
                <FaIdCard className="text-blue-500" /> Identity Info
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 mr-4 uppercase tracking-widest flex items-center gap-2">
                    <FaFont /> Name (English Only)
                </label>
                <input 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange}
                    className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-black transition-all dir-ltr" 
                    placeholder="e.g. predator-edge-2024"
                    required
                />
              </div>

              <div className="space-y-2 text-right">
                <label className="text-[10px] font-bold text-gray-400 ml-4 uppercase tracking-widest flex flex-row-reverse items-center gap-2">
                    عنوان فارسی سری
                </label>
                <input 
                    name="title" 
                    value={formData.title} 
                    onChange={handleChange}
                    className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-black transition-all text-right" 
                    placeholder="مثال: سری پردیتور اج"
                    required
                />
              </div>
            </div>

            <div className="space-y-2 text-right">
                <label className="text-[10px] font-bold text-gray-400 ml-4 uppercase tracking-widest flex flex-row-reverse items-center gap-2">
                    <FaQuoteRight /> توضیحات متای سری
                </label>
                <textarea 
                    name="description" 
                    value={formData.description} 
                    onChange={handleChange}
                    rows={6}
                    className="w-full p-8 bg-gray-50 border-none rounded-[2.5rem] font-medium text-gray-700 outline-none focus:ring-2 focus:ring-black transition-all text-right leading-8 shadow-inner" 
                    placeholder="در مورد ویژگی‌ها، تکنولوژی‌ها و بازار هدف این سری توضیح دهید..."
                />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-black text-white py-8 rounded-[3rem] font-bold text-xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)] hover:-translate-y-1 transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 group"
          >
            {loading ? (
                <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
                <>
                    ثبت و نهایی‌سازی سری جدید 
                    <FaRocket className="text-[var(--color-primary)] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}