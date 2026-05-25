"use client";

import { useEffect, useState } from "react";
import BannerEditor from "@/components/admin/banners/BannerEditor";
import BannerRenderer from "@/components/banners/BannerRenderer";
import StripBannerRenderer from "@/components/banners/StripBannerRenderer";

const POSITIONS = [
  { key: "wide", label: "بنر اصلی", icon: "▬", desc: "بنر عریض سمت راست" },
  { key: "tall-1", label: "بنر کناری ۱", icon: "▮", desc: "بنر عمودی وسط" },
  { key: "tall-2", label: "بنر کناری ۲", icon: "▮", desc: "بنر عمودی چپ" },
  { key: "strip", label: "نوار بنر (strip)", icon: "▬", desc: "نوار باریک" },
];

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBanner, setEditingBanner] = useState(null);
  const [creatingPosition, setCreatingPosition] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { fetchBanners(); }, []);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/banners?admin=true");
      const data = await res.json();
      if (data.success) setBanners(data.banners);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/banners/${id}`, { method: "DELETE" });
      if ((await res.json()).success) {
        setBanners(prev => prev.filter(b => b._id !== id));
        setDeleteConfirm(null);
      }
    } catch (e) { console.error(e); }
  };

  const handleToggleActive = async (banner) => {
    const res = await fetch(`/api/banners/${banner._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !banner.isActive }),
    });
    const data = await res.json();
    if (data.success) setBanners(prev => prev.map(b => b._id === banner._id ? data.banner : b));
  };

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
    <div className="p-4 md:p-8 max-w-6xl mx-auto font-sans" dir="rtl">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">مدیریت بنرها</h1>
        <p className="text-slate-500 mt-1">مدیریت چیدمان بنرهای صفحه اصلی</p>
      </header>

      {/* Live Preview */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <h2 className="text-sm font-bold text-slate-700 mb-4">پیش‌نمایش زنده چیدمان</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-auto md:h-48">
          {["wide", "tall-1", "tall-2"].map(pos => {
            const b = banners.find(x => x.position === pos && x.isActive);
            return (
              <div key={pos} className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-400 text-xs">
                {b ? <BannerRenderer banner={b} preview /> : POSITIONS.find(p => p.key === pos).label}
              </div>
            );
          })}
        </div>
      </section>

      {/* Grid Positions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {POSITIONS.map(pos => (
          <div key={pos.key} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xl bg-slate-100 p-2 rounded-lg">{pos.icon}</span>
              <div>
                <h3 className="font-bold text-slate-900">{pos.label}</h3>
                <p className="text-xs text-slate-400">{pos.desc}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {banners.filter(b => b.position === pos.key).map(b => (
                <div key={b._id} className="group relative border rounded-xl overflow-hidden border-slate-100 hover:border-blue-200 transition-all">
                  <div className="h-24 bg-slate-100">
                    <BannerRenderer banner={b} preview />
                    {!b.isActive && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold">غیرفعال</div>}
                  </div>
                  <div className="p-3 flex justify-between items-center bg-slate-50">
                    <span className="text-xs font-medium text-slate-600 truncate">{b.title || "بدون عنوان"}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingBanner(b)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs">ویرایش</button>
                      <button onClick={() => handleToggleActive(b)} className={`${b.isActive ? "text-green-600" : "text-amber-600"} text-xs`}>
                        {b.isActive ? "فعال" : "غیرفعال"}
                      </button>
                      <button onClick={() => setDeleteConfirm(b._id)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs">حذف</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setCreatingPosition(pos.key)} className="w-full mt-auto py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all text-sm font-semibold">
              + افزودن بنر جدید
            </button>
          </div>
        ))}
      </div>

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-lg font-bold mb-2">آیا مطمئن هستید؟</h3>
            <p className="text-slate-500 mb-6 text-sm">این بنر برای همیشه حذف خواهد شد.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 bg-red-600 text-white py-2 rounded-xl font-bold">حذف</button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-slate-100 py-2 rounded-xl font-bold">انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}