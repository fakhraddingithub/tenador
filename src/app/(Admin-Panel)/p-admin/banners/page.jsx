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
      const data = await res.json();
      if (data.success) {
        setBanners(prev => prev.filter(b => b._id !== id));
        setDeleteConfirm(null);
      }
    } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); }
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
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", direction: "rtl", fontFamily: "var(--font-sans, Vazirmatn, sans-serif)" }}>
      <style>{`
        .admin-banner-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; }
        .admin-banner-cell { border-radius: 12px; overflow: hidden; }
        @media(max-width:768px) { .admin-banner-grid { grid-template-columns: 1fr; } }
        .banner-slot { background: #f8f8f8; border: 2px dashed #ddd; border-radius: 12px; padding: 12px; }
        .banner-item { background: #fff; border: 1px solid #eee; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .banner-actions { display: flex; gap: 8px; padding: 10px 12px; background: #fafafa; border-top: 1px solid #f0f0f0; }
        .btn { padding: 6px 14px; border-radius: 6px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .btn-edit { background: #f0f4ff; color: #3b5bdb; }
        .btn-delete { background: #fff0f0; color: #c92a2a; }
        .btn-toggle { background: #f0fdf4; color: #2f9e44; }
        .btn-toggle.inactive { background: #fff8e1; color: #f08c00; }
        .btn-add { background: var(--color-primary, #aa4725); color: #fff; width: 100%; padding: 10px; margin-top: 8px; }
        .position-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .preview-wrap { position: relative; }
      `}</style>

      {/* هدر */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, margin: "0 0 6px", color: "#0d0d0d" }}>مدیریت بنرها</h1>
        <p style={{ color: "#888", fontSize: "0.9rem", margin: 0 }}>بنرهای صفحه اصلی را مدیریت کنید</p>
      </div>

      {/* پیش‌نمایش زنده */}
      <div style={{ marginBottom: "28px", background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #eee", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "14px", color: "#333" }}>پیش‌نمایش زنده</h2>
        <div className="admin-banner-grid" style={{ height: "200px" }}>
          {["wide", "tall-1", "tall-2"].map(pos => {
            const b = getBannerForPosition(pos);
            return (
              <div key={pos} style={{ borderRadius: "8px", overflow: "hidden", background: "#f5f5f5", border: "1px solid #eee" }}>
                {b ? <BannerRenderer banner={b} preview /> : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: "12px" }}>
                    {POSITIONS.find(p => p.key === pos)?.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {getBannerForPosition("strip") && (
          <div style={{ marginTop: "10px", height: "52px", borderRadius: "8px", overflow: "hidden" }}>
            <StripBannerRenderer banner={getBannerForPosition("strip")} />
          </div>
        )}
      </div>

      {/* لیست موقعیت‌ها */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {POSITIONS.map(pos => {
          const items = getAllForPosition(pos.key);
          return (
            <div key={pos.key} className="banner-slot">
              <div className="position-header">
                <span style={{ fontSize: "1.3rem" }}>{pos.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#222" }}>{pos.label}</div>
                  <div style={{ fontSize: "0.78rem", color: "#999" }}>{pos.desc}</div>
                </div>
              </div>

              {items.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px", color: "#bbb", fontSize: "0.85rem" }}>
                  هنوز بنری برای این موقعیت ثبت نشده
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {items.map(b => (
                  <div key={b._id} className="banner-item" style={{ opacity: b.isActive ? 1 : 0.6 }}>
                    {/* پیش‌نمایش */}
                    <div className="preview-wrap" style={{ height: pos.key === "strip" ? "56px" : "140px", background: "#f0f0f0" }}>
                      {pos.key === "strip"
                        ? <StripBannerRenderer banner={b} />
                        : <BannerRenderer banner={b} preview />
                      }
                      {!b.isActive && (
                        <div style={{
                          position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: "0.85rem", fontWeight: 700,
                        }}>
                          غیرفعال
                        </div>
                      )}
                    </div>
                    {/* اطلاعات و دکمه‌ها */}
                    <div style={{ padding: "8px 12px" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#333" }}>{b.title || "(بدون عنوان)"}</div>
                      <div style={{ fontSize: "0.72rem", color: "#999", marginTop: "2px" }}>تمپلیت: {b.template}</div>
                    </div>
                    <div className="banner-actions">
                      <button className="btn btn-edit" onClick={() => setEditingBanner(b)}>ویرایش</button>
                      <button className={`btn btn-toggle ${!b.isActive ? "inactive" : ""}`} onClick={() => handleToggleActive(b)}>
                        {b.isActive ? "غیرفعال کن" : "فعال کن"}
                      </button>
                      <button className="btn btn-delete" onClick={() => setDeleteConfirm(b._id)}>حذف</button>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-add" onClick={() => setCreatingPosition(pos.key)}>
                + افزودن بنر جدید برای این موقعیت
              </button>
            </div>
          );
        })}
      </div>

      {/* مودال تایید حذف */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "28px", maxWidth: "340px", textAlign: "center", direction: "rtl" }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>حذف بنر؟</h3>
            <p style={{ margin: "0 0 20px", color: "#666", fontSize: "0.88rem" }}>این عملیات قابل بازگشت نیست.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button style={{ padding: "8px 20px", borderRadius: "8px", background: "#fee", border: "none", color: "#c00", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => handleDelete(deleteConfirm)}>
                بله، حذف شود
              </button>
              <button style={{ padding: "8px 20px", borderRadius: "8px", background: "#f5f5f5", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => setDeleteConfirm(null)}>
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
