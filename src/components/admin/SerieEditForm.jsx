"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { 
  FaSave, FaPalette, FaIdCard, 
  FaFont, FaQuoteRight, FaEdit, FaArrowRight, FaSync
} from "react-icons/fa";
import ImageUpload from "./ImageUpload";

export default function SerieEditPage({ id }) {
  const router = useRouter();
  
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    description: "",
    brand: "",
    colors: { primary: "#000000", secondary: "#ffffff" },
    logo: "",
    icon: "",
    image: "",
  });

  useEffect(() => {
    const fetchSerieData = async () => {
      try {
        const res = await fetch(`/api/series/${id}`);
        const result = await res.json();
        
        if (res.ok) {
          const data = result.data || result;
          setFormData({
            ...data,
            brand:data.brand._id,
            colors: data.colors || { primary: "#000000", secondary: "#ffffff" }
          });

          setBrandName(data?.brand?.title || "مشخص نشده");
        } else {
          toast.error("خطا در بارگذاری اطلاعات");
          router.push("/p-admin/admin-brands");
        }
      } catch (err) {
        toast.error("خطای شبکه");
      } finally {
        setFetching(false);
      }
    };

    if (id) fetchSerieData();
  }, [id, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // هندلر اختصاصی برای تغییر رنگ‌ها در آبجکت تو در تو
  const handleColorChange = (type, value) => {
    setFormData(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [type]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/series/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // ارسال کامل formData شامل آبجکت colors
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "به‌روزرسانی موفق",
          text: "تغییرات با موفقیت ذخیره شد.",
          confirmButtonColor: "var(--color-primary)",
        }).then(() => {
          // برگشت به صفحه برندها بعد از تایید کاربر
          router.push(`/p-admin/admin-brands/${formData.brand}`);
        });
      } else {
        const error = await res.json();
        toast.error(error.message || "خطا در ویرایش");
      }
    } catch (err) {
      toast.error("خطای سرور؛ دوباره تلاش کنید");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-gray-400">
        <FaSync className="animate-spin text-3xl text-[var(--color-primary)]" />
        <p className="font-bold italic text-xs uppercase tracking-widest">Loading Serie Data...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-8 pb-20">
      
      {/* Header */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-4 text-right">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-[var(--color-primary)] shadow-xl">
                <FaEdit size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-bold italic">ویرایش سری: {formData?.title || "..."}</h2>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                    برند مرتبط: <span className="text-black">{brandName}</span>
                </p>
            </div>
        </div>
        <button 
          type="button" 
          onClick={() => router.push("/p-admin/admin-brands")}
          className="p-4 bg-gray-50 text-gray-500 rounded-2xl hover:bg-gray-100 transition-all flex items-center gap-2 font-bold text-[10px]"
        >
          بازگشت به برندها <FaArrowRight />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ستون چپ: مدیا و رنگ */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-gray-50 space-y-6">
            <ImageUpload 
                label="تصویر اصلی" 
                value={formData?.image} 
                onChange={(url) => setFormData(p => ({...p, image: url}))}
                folder="series/covers"
            />
            <div className="grid grid-cols-2 gap-4">
                <ImageUpload 
                    label="لوگو" 
                    value={formData?.logo} 
                    onChange={(url) => setFormData(p => ({...p, logo: url}))}
                    folder="series/logos"
                />
                <ImageUpload 
                    label="آیکون" 
                    value={formData?.icon} 
                    onChange={(url) => setFormData(p => ({...p, icon: url}))}
                    folder="series/icons"
                />
            </div>
          </div>

          <div className="bg-black p-8 rounded-[3rem] shadow-2xl text-white">
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-6 flex items-center gap-2">
                <FaPalette className="text-[var(--color-primary)]" /> پالت رنگی اختصاصی
            </h3>
            <div className="space-y-4">
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                    <span className="text-xs font-bold text-gray-300">رنگ اصلی (Primary)</span>
                    <input 
                        type="color" 
                        value={formData?.colors?.primary || "#000000"} 
                        onChange={(e) => handleColorChange('primary', e.target.value)}
                        className="w-10 h-10 bg-transparent border-none cursor-pointer"
                    />
                </div>
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                    <span className="text-xs font-bold text-gray-300">رنگ ثانویه (Secondary)</span>
                    <input 
                        type="color" 
                        value={formData?.colors?.secondary || "#ffffff"} 
                        onChange={(e) => handleColorChange('secondary', e.target.value)}
                        className="w-10 h-10 bg-transparent border-none cursor-pointer"
                    />
                </div>
            </div>
          </div>
        </div>

        {/* ستون راست: متن‌ها */}
        <div className="lg:col-span-8 space-y-8 text-right">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-gray-50 space-y-8">
            <h3 className="flex flex-row-reverse items-center gap-3 font-bold text-gray-900 italic uppercase">
                <FaIdCard className="text-[var(--color-primary)]" /> مشخصات فنی
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 text-right">
                <label className="text-[10px] font-bold text-gray-400 mr-4 uppercase tracking-widest flex items-center gap-2">
                    <FaFont /> نام سیستمی (Slug)
                </label>
                <input 
                    name="name"
                    value={formData?.name || ""} 
                    onChange={handleChange}
                    className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 dir-ltr focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 ml-4 uppercase tracking-widest flex flex-row-reverse items-center gap-2">
                    عنوان نمایشی (فارسی)
                </label>
                <input 
                    name="title" 
                    value={formData?.title || ""} 
                    onChange={handleChange}
                    className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all text-right" 
                />
              </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 ml-4 uppercase tracking-widest flex flex-row-reverse items-center gap-2">
                    <FaQuoteRight /> توضیحات برند
                </label>
                <textarea 
                    name="description" 
                    value={formData?.description || ""} 
                    onChange={handleChange}
                    rows={8}
                    className="w-full p-8 bg-gray-50 border border-gray-100 rounded-[2.5rem] font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-right leading-8 shadow-inner" 
                />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-black text-white py-8 rounded-[3rem] font-bold text-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <><FaSave className="text-[var(--color-primary)]" /> ذخیره و بازگشت</>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}