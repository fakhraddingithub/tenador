"use client";

import { useState, useRef } from "react";
import BannerRenderer from "@/components/banners/BannerRenderer";
import StripBannerRenderer from "@/components/banners/StripBannerRenderer";
import { getSlotsForTemplate } from "@/components/banners/templateImageSlots";

// ─────────────────────────────────────────────────────────────
// برای اضافه کردن تمپلیت جدید فقط همین آرایه رو گسترش بده
// ─────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    key: "flame",
    label: "آتشین",
    emoji: "🔥",
    desc: "پرانرژی برای کمپین‌های تخفیف",
    defaultColors: { bg: "#0d0d0d", primary: "#aa4725", secondary: "#ffbf00", text: "#ffffff", textSecondary: "rgba(255,255,255,0.7)", accent: "#ffffff" },
  },
  {
    key: "luxury",
    label: "لاکچری",
    emoji: "✨",
    desc: "ظریف و بلندپایه برای کالکشن ویژه",
    defaultColors: { bg: "#0a0a0a", primary: "#aa4725", secondary: "#ffbf00", text: "#ffffff", textSecondary: "rgba(255,255,255,0.55)", accent: "#ffbf00" },
  },
  {
    key: "geometric",
    label: "هندسی",
    emoji: "◆",
    desc: "مدرن و جذاب برای معرفی محصول جدید",
    defaultColors: { bg: "#f5f0eb", primary: "#aa4725", secondary: "#ffbf00", text: "#0d0d0d", textSecondary: "#555555", accent: "#ffffff" },
  },
  {
    key: "neon",
    label: "نئون",
    emoji: "⚡",
    desc: "سایبرپانک برای فروش ویژه و فلش‌سیل",
    defaultColors: { bg: "#070712", primary: "#aa4725", secondary: "#ffbf00", text: "#ffffff", textSecondary: "rgba(255,255,255,0.6)", accent: "#ffbf00" },
  },
  {
    key: "organic",
    label: "آرگانیک",
    emoji: "🌿",
    desc: "طبیعی و صمیمی برای محصولات آرگانیک",
    defaultColors: { bg: "#f9f4ef", primary: "#aa4725", secondary: "#ffbf00", text: "#2a1a0e", textSecondary: "#7a5c44", accent: "#aa4725" },
  },
  {
    key: "editorial",
    label: "مجله‌ای",
    emoji: "📰",
    desc: "سبک مجله برای کالکشن فصلی",
    defaultColors: { bg: "#fafaf8", primary: "#aa4725", secondary: "#ffbf00", text: "#0d0d0d", textSecondary: "#666666", accent: "#aa4725" },
  },
  {
    key: "brutalist",
    label: "بروتالیست",
    emoji: "◼",
    desc: "خشن و بولد برای تخفیف‌های شدید",
    defaultColors: { bg: "#ffffff", primary: "#aa4725", secondary: "#ffbf00", text: "#0d0d0d", textSecondary: "#333333", accent: "#ffffff" },
  },
  {
    key: "gradient-wave",
    label: "موج گرادیانت",
    emoji: "〰",
    desc: "مدرن و روشن برای برندهای خلاق",
    defaultColors: { bg: "#1a0533", primary: "#aa4725", secondary: "#ffbf00", text: "#ffffff", textSecondary: "rgba(255,255,255,0.7)", accent: "#ffbf00" },
  },
  {
    key: "elegant-overlay",
    label: "اورلی ظریف",
    emoji: "🖼️",
    desc: "عکس پس‌زمینه با متن روی آن — سبک مجله",
    defaultColors: { bg: "#6b6560", primary: "#aa4725", secondary: "#ffbf00", text: "#ffffff", textSecondary: "rgba(255,255,255,0.7)", accent: "#ffffff" },
  },
  {
    key: "symmetric",
    label: "سیمتریک - نوار",
    emoji: "💎",
    desc: "افکت گلس‌مورفیسم مدرن همراه با درخشش Shimmer متحرک",
    defaultColors: { bg: "#0d0d11", primary: "#16161a", secondary: "#aa4725", text: "#ffffff", textSecondary: "#e4e4e7", accent: "#ffbf00" },
  },
  {
    key: "adventure-shoes",
    label: "ادونچر شوز",
    emoji: "🥾",
    desc: "بنر تبلیغاتی اکشن با براش آبی و تایپوگرافی بولد",
    defaultColors: {
      bg: "#dcecff",
      primary: "#0f57c9",
      secondary: "#ffe36a",
      text: "#3f3f3f",
      textSecondary: "#6b7280",
      accent: "#7a5538",
    },
  },
  // ── تمپلیت جدید؟ فقط یه آبجکت اینجا اضافه کن ──
];

const COLOR_FIELDS = [
  { key: "bg", label: "پس‌زمینه" },
  { key: "primary", label: "رنگ اصلی" },
  { key: "secondary", label: "رنگ ثانویه" },
  { key: "text", label: "رنگ متن اصلی" },
  { key: "textSecondary", label: "رنگ متن فرعی" },
  { key: "accent", label: "رنگ تأکیدی" },
];

const defaultForm = {
  title: "", subtitle: "", badge: "", ctaText: "", link: "/",
  template: "flame", colors: TEMPLATES[0].defaultColors,
  images: {}, imagePids: {},
  isActive: true, order: 0,
};

// ─────────────────────────────────────────────────────────────
// ImageSlotUploader — کامپوننت آپلود داینامیک برای هر slot
// ─────────────────────────────────────────────────────────────
function ImageSlotUploader({ slot, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "banners");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) onChange(slot.key, data.url, data.publicId || "");
      else alert(data.error || "خطا در آپلود تصویر");
    } catch {
      alert("خطا در آپلود تصویر");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#555", marginBottom: "5px" }}>
        {slot.label}
        {slot.required && <span style={{ color: "#e53e3e", marginRight: "4px" }}>*</span>}
      </label>
      {slot.hint && (
        <p style={{ fontSize: "0.72rem", color: "#aaa", margin: "0 0 6px" }}>{slot.hint}</p>
      )}

      {value ? (
        <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden" }}>
          <img
            src={value}
            alt=""
            style={{ width: "100%", height: "110px", objectFit: "cover", display: "block", background: "#111" }}
          />
          <button
            onClick={() => onChange(slot.key, "", "")}
            style={{
              position: "absolute", top: "6px", left: "6px",
              background: "rgba(0,0,0,0.65)", color: "#fff", border: "none",
              borderRadius: "50%", width: "24px", height: "24px",
              cursor: "pointer", fontSize: "12px",
            }}
          >✕</button>
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              position: "absolute", bottom: "6px", left: "6px",
              background: "rgba(0,0,0,0.65)", color: "#fff", border: "none",
              borderRadius: "6px", padding: "3px 10px",
              cursor: "pointer", fontSize: "11px", fontFamily: "inherit",
            }}
          >تغییر</button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: "2px dashed #ddd", borderRadius: "10px", padding: "18px",
            textAlign: "center", cursor: "pointer", transition: "all 0.2s",
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = "#aa4725"; e.currentTarget.style.background = "#fff5f2"; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = "#ddd"; e.currentTarget.style.background = ""; }}
        >
          {uploading ? (
            <div style={{ color: "#888", fontSize: "0.85rem" }}>در حال آپلود...</div>
          ) : (
            <>
              <div style={{ fontSize: "1.6rem", marginBottom: "4px" }}>📷</div>
              <div style={{ fontSize: "0.8rem", color: "#888" }}>کلیک کنید تا آپلود شود</div>
              <div style={{ fontSize: "0.7rem", color: "#bbb", marginTop: "2px" }}>حداکثر ۲ مگابایت</div>
            </>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BannerEditor — کامپوننت اصلی
// ─────────────────────────────────────────────────────────────
export default function BannerEditor({ banner, position, onClose, onSave }) {
  const isEdit = !!banner;

  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [form, setForm] = useState(() => {
    if (isEdit) {
      // images از MongoDB به‌صورت Map برمی‌گرده — به plain object تبدیل کن
      const imgs = banner.images instanceof Map
        ? Object.fromEntries(banner.images)
        : (banner.images || {});
      const pids = banner.imagePids instanceof Map
        ? Object.fromEntries(banner.imagePids)
        : (banner.imagePids || {});
      const cols = banner.colors instanceof Map
        ? Object.fromEntries(banner.colors)
        : (banner.colors || {});
      return {
        ...banner,
        images: imgs,
        imagePids: pids,
        colors: { ...TEMPLATES.find(t => t.key === banner.template)?.defaultColors, ...cols },
      };
    }
    return { ...defaultForm, position, template: "flame", colors: { ...TEMPLATES[0].defaultColors } };
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("content");

  const selectedTemplate = TEMPLATES.find(t => t.key === form.template) || TEMPLATES[0];
  const imageSlots = getSlotsForTemplate(form.template);

  const handleTemplateSelect = (tpl) => {
    setForm(prev => ({ ...prev, template: tpl.key, colors: { ...tpl.defaultColors } }));
    setStep(2);
  };

  const handleField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const handleColor = (key, val) => setForm(prev => ({ ...prev, colors: { ...prev.colors, [key]: val } }));

  // ذخیره عکس داخل images map
  const handleImageChange = (slotKey, url, publicId) => {
    const pidKey = slotKey.replace("Url", "PublicId");
    setForm(prev => ({
      ...prev,
      images:    { ...prev.images,    [slotKey]: url },
      imagePids: { ...prev.imagePids, [pidKey]:  publicId },
    }));
  };

  // ImageSlotUploader باید مقدار رو از images map بخونه
  const getImageValue = (slotKey) => form.images?.[slotKey] || "";

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, position };
      const url = isEdit ? `/api/banners/${banner._id}` : "/api/banners";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) onSave();
      else alert(data.error || "خطا در ذخیره بنر");
    } catch {
      alert("خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  const previewBanner = { ...form, position };
  const isStrip = position === "strip";

  return (
    <div style={{
      minHeight: "100vh", background: "#f5f5f5", direction: "rtl",
      fontFamily: "var(--font-sans, Vazirmatn, sans-serif)", padding: "20px",
    }}>
      <style>{`
        .editor-card { background: #fff; border-radius: 16px; border: 1px solid #eee; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
        .form-group { margin-bottom: 14px; }
        .form-label { display: block; font-size: 0.82rem; font-weight: 600; color: #555; margin-bottom: 5px; }
        .form-input { width: 100%; padding: 9px 12px; border: 1.5px solid #e5e5e5; border-radius: 8px; font-size: 0.88rem; font-family: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .form-input:focus { border-color: var(--color-primary, #aa4725); }
        .tab-btn { padding: 8px 18px; border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .tab-btn.active { background: var(--color-primary, #aa4725); color: #fff; }
        .tab-btn:not(.active) { background: #f0f0f0; color: #555; }
        .tpl-card { border: 2px solid #eee; border-radius: 12px; padding: 14px; cursor: pointer; transition: all 0.2s; text-align: center; }
        .tpl-card:hover { border-color: var(--color-primary, #aa4725); transform: translateY(-2px); box-shadow: 0 4px 16px rgba(170,71,37,0.15); }
        .tpl-card.selected { border-color: var(--color-primary, #aa4725); background: #fff5f2; }
        .color-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .color-swatch { width: 36px; height: 36px; border-radius: 8px; border: 1.5px solid #ddd; cursor: pointer; overflow: hidden; flex-shrink: 0; }
        .color-swatch input[type=color] { width: 150%; height: 150%; margin: -25%; border: none; cursor: pointer; }
        .save-btn { width: 100%; padding: 13px; background: var(--color-primary, #aa4725); color: #fff; border: none; border-radius: 10px; font-size: 1rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 0.2s; }
        .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .slots-divider { font-size: 0.72rem; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.08em; margin: 16px 0 10px; padding-bottom: 6px; border-bottom: 1px dashed #eee; }
      `}</style>

      {/* هدر */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button onClick={onClose} style={{ background: "#fff", border: "1.5px solid #ddd", borderRadius: "8px", width: "36px", height: "36px", cursor: "pointer", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ←
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900 }}>
            {isEdit ? "ویرایش بنر" : "ساخت بنر جدید"}
          </h1>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#888" }}>موقعیت: {position}</p>
        </div>
        {step === 2 && !isEdit && (
          <button onClick={() => setStep(1)} style={{ marginRight: "auto", background: "#f0f0f0", border: "none", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 600 }}>
            تغییر تمپلیت
          </button>
        )}
      </div>

      {/* مرحله ۱: انتخاب تمپلیت */}
      {step === 1 && (
        <div className="editor-card" style={{ padding: "20px" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 700 }}>تمپلیت بنر را انتخاب کنید</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
            {TEMPLATES.map(tpl => (
              <div key={tpl.key} className={`tpl-card ${form.template === tpl.key ? "selected" : ""}`} onClick={() => handleTemplateSelect(tpl)}>
                <div style={{ fontSize: "2rem", marginBottom: "6px" }}>{tpl.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "4px" }}>{tpl.label}</div>
                <div style={{ fontSize: "0.72rem", color: "#888", lineHeight: 1.4 }}>{tpl.desc}</div>
                {/* نشانگر تعداد عکس‌ها */}
                <div style={{ marginTop: "6px", fontSize: "0.68rem", color: "#bbb" }}>
                  {getSlotsForTemplate(tpl.key).length} تصویر
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* مرحله ۲: ویرایش */}
      {step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "16px" }}>

          {/* پیش‌نمایش */}
          <div>
            <div className="editor-card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.2rem" }}>{selectedTemplate.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>«{selectedTemplate.label}»</div>
                  <div style={{ fontSize: "0.72rem", color: "#999" }}>{selectedTemplate.desc}</div>
                </div>
              </div>
              <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #eee" }}>
                {isStrip
                  ? <div style={{ height: "64px" }}><StripBannerRenderer banner={previewBanner} /></div>
                  : <div style={{ height: "260px" }}><BannerRenderer banner={previewBanner} preview /></div>
                }
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "#aaa", textAlign: "center" }}>پیش‌نمایش زنده</p>
            </div>
          </div>

          {/* فرم */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="editor-card" style={{ padding: "12px" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <button className={`tab-btn ${activeTab === "content" ? "active" : ""}`} onClick={() => setActiveTab("content")}>محتوا</button>
                <button className={`tab-btn ${activeTab === "colors" ? "active" : ""}`} onClick={() => setActiveTab("colors")}>رنگ‌ها</button>
              </div>

              {activeTab === "content" && (
                <div>
                  {/* ── تصاویر — داینامیک از templateImageSlots ── */}
                  <div className="slots-divider">
                    تصاویر ({imageSlots.length} مورد)
                  </div>
                  {imageSlots.map(slot => (
                    <ImageSlotUploader
                      key={slot.key}
                      slot={slot}
                      value={getImageValue(slot.key)}
                      onChange={handleImageChange}
                    />
                  ))}

                  {/* ── فیلدهای متنی ── */}
                  <div className="slots-divider">متن‌ها</div>
                  {[
                    { key: "badge",   label: "بج / برچسب" },
                    { key: "title",   label: "عنوان اصلی" },
                    { key: "subtitle",label: "زیرعنوان" },
                    { key: "ctaText", label: "متن دکمه (CTA)" },
                    { key: "link",    label: "لینک مقصد" },
                  ].map(field => (
                    <div key={field.key} className="form-group">
                      <label className="form-label">{field.label}</label>
                      <input className="form-input" value={form[field.key] || ""} onChange={e => handleField(field.key, e.target.value)} placeholder={field.label} dir="auto" />
                    </div>
                  ))}

                  {/* ── تنظیمات ── */}
                  <div className="slots-divider">تنظیمات</div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">ترتیب نمایش</label>
                      <input className="form-input" type="number" value={form.order} onChange={e => handleField("order", Number(e.target.value))} />
                    </div>
                    <div className="form-group" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      <label className="form-label">وضعیت</label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={form.isActive} onChange={e => handleField("isActive", e.target.checked)} style={{ width: "18px", height: "18px", accentColor: "var(--color-primary, #aa4725)" }} />
                        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>فعال</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "colors" && (
                <div>
                  <p style={{ fontSize: "0.8rem", color: "#888", margin: "0 0 14px" }}>رنگ‌های تمپلیت را سفارشی کنید</p>
                  {COLOR_FIELDS.map(field => (
                    <div key={field.key} className="color-row">
                      <div className="color-swatch">
                        <input type="color"
                          value={(form.colors?.[field.key] || "#000000").startsWith("rgba") ? "#888888" : (form.colors?.[field.key] || "#000000")}
                          onChange={e => handleColor(field.key, e.target.value)}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#333" }}>{field.label}</div>
                        <input className="form-input" value={form.colors?.[field.key] || ""} onChange={e => handleColor(field.key, e.target.value)} style={{ marginTop: "4px", fontSize: "0.75rem", fontFamily: "monospace" }} placeholder="#aa4725" />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setForm(prev => ({ ...prev, colors: { ...selectedTemplate.defaultColors } }))}
                    style={{ width: "100%", padding: "8px", background: "#f5f5f5", border: "1.5px solid #ddd", borderRadius: "8px", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", marginTop: "8px" }}>
                    بازگشت به رنگ‌های پیش‌فرض
                  </button>
                </div>
              )}
            </div>

            <button className="save-btn" disabled={saving} onClick={handleSave}>
              {saving ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ساخت بنر"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
