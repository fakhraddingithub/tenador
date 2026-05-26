"use client";

import { useEffect, useState } from "react";
import BannerEditor from "@/components/admin/banners/BannerEditor";
import BannerRenderer from "@/components/banners/BannerRenderer";
import StripBannerRenderer from "@/components/banners/StripBannerRenderer";

const POSITIONS = [
  { key: "wide", label: "بنر اصلی (افقی بزرگ)", icon: "▬", desc: "بنر عریض در سمت راست گرید" },
  { key: "tall-1", label: "بنر کناری ۱ (عمودی)", icon: "▮", desc: "بنر عمودی وسط" },
  { key: "tall-2", label: "بنر کناری ۲ (عمودی)", icon: "▮", desc: "بنر عمودی چپ" },
  { key: "strip", label: "نوار بنر (strip)", icon: "▬", desc: "نوار باریک زیر بنرها" },
];

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBanner, setEditingBanner] = useState(null);
  const [creatingPosition, setCreatingPosition] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { 
    fetchBanners(); 
  }, []);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/banners?admin=true");
      const data = await res.json();
      if (data.success) setBanners(data.banners);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/banners/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setBanners(prev => prev.filter(b => b._id !== id));
        setDeleteConfirm(null);
      }
    } catch (e) { 
      console.error(e); 
    }
  };

  const handleToggleActive = async (banner) => {
    try {
      const res = await fetch(`/api/banners/${banner._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setBanners(prev => prev.map(b => b._id === banner._id ? data.banner : b));
      }
    } catch (e) { 
      console.error(e); 
    }
  };

  const getBannerForPosition = (pos) => banners.find(b => b.position === pos && b.isActive);
  const getAllForPosition = (pos) => banners.filter(b => b.position === pos);

  if (editingBanner || creatingPosition) {
    return (
      <BannerEditor
        banner={editingBanner}
        position={creatingPosition || editingBanner?.position}
        onClose={() => { setEditingBanner(null); setCreatingPosition(null); }}
        onSave={() => { setEditingBanner(null); setCreatingPosition(null); fetchBanners(); }}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* هدر */}
      <div className="mb-7">
        <h1 className="text-2xl font-black text-neutral-950 tracking-tight">مدیریت بنرها</h1>
        <p className="text-sm text-neutral-400 mt-1">بنرهای صفحه اصلی را مدیریت کنید</p>
      </div>

      {/* پیش‌نمایش زنده */}
      <div className="mb-7 bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm">
        <h2 className="text-sm font-bold text-neutral-800 mb-4">پیش‌نمایش زنده</h2>
        
        {/* گرید با نسبت 2fr 1fr 1fr اصلی با col-span در حالت دسکتاپ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-auto md:h-[200px]">
          {["wide", "tall-1", "tall-2"].map(pos => {
            const b = getBannerForPosition(pos);
            const gridClasses = pos === "wide" ? "md:col-span-2" : "md:col-span-1";
            
            return (
              <div key={pos} className={`${gridClasses} rounded-lg overflow-hidden bg-neutral-50 border border-neutral-100`}>
                {b ? (
                  <BannerRenderer banner={b} preview />
                ) : (
                  <div className="w-full h-full min-h-[140px] flex items-center justify-center text-xs text-neutral-300 font-medium">
                    {POSITIONS.find(p => p.key === pos)?.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* نوار بنر پایین گرید پیش‌نمایش */}
        {getBannerForPosition("strip") && (
          <div className="mt-3.5 h-14 rounded-lg overflow-hidden border border-neutral-100">
            <StripBannerRenderer banner={getBannerForPosition("strip")} />
          </div>
        )}
      </div>

      {/* لیست موقعیت‌ها */}
      <div className="flex flex-col gap-5">
        {POSITIONS.map(pos => {
          const items = getAllForPosition(pos.key);
          return (
            <div key={pos.key} className="bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-2xl p-4">
              
              {/* هدر موقعیت */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl leading-none">{pos.icon}</span>
                <div>
                  <div className="font-bold text-sm text-neutral-800">{pos.label}</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">{pos.desc}</div>
                </div>
              </div>

              {items.length === 0 && (
                <div className="text-center py-5 text-neutral-400 text-xs font-medium">
                  هنوز بنری برای این موقعیت ثبت نشده
                </div>
              )}

              {/* لیست کارت‌های بنر */}
              <div className="flex flex-col gap-2.5">
                {items.map(b => (
                  <div 
                    key={b._id} 
                    className="bg-white border border-neutral-200/60 rounded-xl overflow-hidden shadow-sm transition-opacity"
                    style={{ opacity: b.isActive ? 1 : 0.6 }}
                  >
                    {/* تصویر بنر */}
                    <div className="relative bg-neutral-100" style={{ height: pos.key === "strip" ? "56px" : "140px" }}>
                      {pos.key === "strip" 
                        ? <StripBannerRenderer banner={b} />
                        : <BannerRenderer banner={b} preview />
                      }
                      {!b.isActive && (
                        <div className="absolute inset-0 bg-black/35 flex items-center justify-center color text-white text-xs font-bold">
                          غیرفعال
                        </div>
                      )}
                    </div>
                    
                    {/* اطلاعات */}
                    <div className="p-3">
                      <div className="text-xs font-bold text-neutral-800">{b.title || "(بدون عنوان)"}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">تمپلیت: {b.template}</div>
                    </div>
                    
                    {/* عملیات */}
                    <div className="flex gap-2 p-3 bg-neutral-50/50 border-t border-neutral-100">
                      <button className="py-1.5 px-3.5 rounded-md bg-blue-50 text-blue-600 font-semibold text-xs transition-colors hover:bg-blue-100" onClick={() => setEditingBanner(b)}>ویرایش</button>
                      <button 
                        className={`py-1.5 px-3.5 rounded-md font-semibold text-xs transition-colors ${
                          !b.isActive 
                            ? "bg-amber-50 text-amber-600 hover:bg-amber-100" 
                            : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        }`} 
                        onClick={() => handleToggleActive(b)}
                      >
                        {b.isActive ? "غیرفعال کن" : "فعال کن"}
                      </button>
                      <button className="py-1.5 px-3.5 rounded-md bg-rose-50 text-rose-600 font-semibold text-xs transition-colors hover:bg-rose-100" onClick={() => setDeleteConfirm(b._id)}>حذف</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* دکمه افزودن */}
              <button 
                className="w-full mt-2 py-2.5 rounded-md bg-[#aa4725] hover:bg-[#933d1f] text-white font-semibold text-xs transition-colors" 
                onClick={() => setCreatingPosition(pos.key)}
              >
                + افزودن بنر جدید برای این موقعیت
              </button>
            </div>
          );
        })}
      </div>

      {/* مودال تایید حذف */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-7 max-w-xs w-full text-center">
            <div className="text-3xl mb-3">🗑️</div>
            <h3 className="text-base font-bold text-neutral-900 mb-2">حذف بنر؟</h3>
            <p className="text-xs text-neutral-50 mb-5 leading-relaxed">این عملیات قابل بازگشت نیست.</p>
            <div className="flex gap-2 justify-center">
              <button 
                className="py-2 px-5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs transition-colors"
                onClick={() => handleDelete(deleteConfirm)}
              >
                بله، حذف شود
              </button>
              <button 
                className="py-2 px-5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-bold text-xs transition-colors"
                onClick={() => setDeleteConfirm(null)}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}