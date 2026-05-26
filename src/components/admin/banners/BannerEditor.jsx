"use client";

import { useState, useRef } from "react";
import BannerRenderer from "@/components/banners/BannerRenderer";
import StripBannerRenderer from "@/components/banners/StripBannerRenderer";

const TEMPLATES = [
  {
    key: "elegant-overlay",
    label: "پرمیوم (شیشه‌ای)",
    emoji: "💎",
    desc: "افکت گلس‌مورفیسم مدرن همراه با درخشش Shimmer متحرک",
    defaultColors: { bg: "#0d0d11", primary: "#16161a", secondary: "#aa4725", text: "#ffffff", textSecondary: "#e4e4e7", accent: "#ffbf00" },
  },
  {
    key: "symmetric",
    label: "سیمتریک - نوار",
    emoji: "💎",
    desc: "افکت گلس‌مورفیسم مدرن همراه با درخشش Shimmer متحرک",
    defaultColors: { bg: "#0d0d11", primary: "#16161a", secondary: "#aa4725", text: "#ffffff", textSecondary: "#e4e4e7", accent: "#ffbf00" },
  },
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
  title: "",
  subtitle: "",
  badge: "",
  ctaText: "",
  link: "/",
  imageUrl: "",
  imagePublicId: "",
  template: "elegant-overlay", // اصلاح شد از "premium"
  colors: TEMPLATES[0].defaultColors,
  isActive: true,
  order: 0,
};

export default function BannerEditor({ banner, position, onClose, onSave }) {
  const isEdit = !!banner;
  const isStrip = position === "strip"; // برای استفاده در مقدار اولیه استیت به خط بالا منتقل شد

  const [step, setStep] = useState(isEdit ? 2 : 1);
  
  // انتخاب هوشمند تمپلیت پیش‌فرض بر اساس موقعیت بنر
  const defaultTemplateKey = isStrip ? "symmetric" : "elegant-overlay";
  const defaultTemplate = TEMPLATES.find(t => t.key === defaultTemplateKey) || TEMPLATES[0];

  const [form, setForm] = useState(
    isEdit
      ? { ...banner, colors: { ...TEMPLATES.find(t => t.key === banner.template)?.defaultColors, ...banner.colors } }
      : { ...defaultForm, position, template: defaultTemplateKey, colors: { ...defaultTemplate.defaultColors } }
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("content"); // content | colors
  const fileInputRef = useRef(null);

  const selectedTemplate = TEMPLATES.find(t => t.key === form.template) || TEMPLATES[0];

  const handleTemplateSelect = (tpl) => {
    setForm(prev => ({
      ...prev,
      template: tpl.key,
      colors: { ...tpl.defaultColors },
    }));
    setStep(2);
  };

  const handleField = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleColor = (key, val) => {
    setForm(prev => ({ ...prev, colors: { ...prev.colors, [key]: val } }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "banners");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setForm(prev => ({ ...prev, imageUrl: data.url, imagePublicId: data.publicId || "" }));
      } else {
        alert(data.error || "خطا در آپلود تصویر");
      }
    } catch (err) {
      alert("خطا در آپلود تصویر");
    } finally {
      setUploading(false);
    }
  };

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
      if (data.success) {
        onSave();
      } else {
        alert(data.error || "خطا در ذخیره بنر");
      }
    } catch (err) {
      alert("خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  const previewBanner = { ...form, position };

  return (
    <div className="min-h-screen bg-neutral-50 p-5" dir="rtl">
      
      {/* هدر ناوبری */}
      <div className="flex items-center gap-3 mb-6 max-w-7xl mx-auto">
        <button 
          onClick={onClose} 
          className="bg-white border border-neutral-200 rounded-xl w-9 h-9 cursor-pointer text-base flex items-center justify-center shadow-sm hover:bg-neutral-50 transition-colors"
        >
          ←
        </button>
        <div>
          <h1 className="m-0 text-lg font-black text-neutral-900">
            {isEdit ? "ویرایش بنر" : "ساخت بنر جدید"}
          </h1>
          <p className="m-0 text-xs text-neutral-400 mt-0.5">
            موقعیت جایگذاری: <span className="font-bold text-neutral-600">{position}</span>
          </p>
        </div>
        {step === 2 && !isEdit && (
          <button 
            onClick={() => setStep(1)} 
            className="mr-auto bg-neutral-200/70 hover:bg-neutral-200 text-neutral-700 border-none rounded-lg px-4 py-1.5 cursor-pointer text-xs font-bold transition-colors"
          >
            تغییر تمپلیت واقعه
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto">
        {/* مرحله ۱: انتخاب تمپلیت هندسی/بصری */}
        {step === 1 && (
          <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm p-6">
            <h2 className="m-0 mb-5 text-sm font-black text-neutral-800">تمپلیت طراحی بنر خود را انتخاب کنید</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {TEMPLATES.map(tpl => (
                <div 
                  key={tpl.key} 
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all text-center hover:-translate-y-0.5 hover:shadow-md ${
                    form.template === tpl.key 
                      ? "border-[#aa4725] bg-orange-50/20" 
                      : "border-neutral-100 hover:border-[#aa4725]/40"
                  }`} 
                  onClick={() => handleTemplateSelect(tpl)}
                >
                  <div className="text-3xl mb-2">{tpl.emoji}</div>
                  <div className="font-black text-xs text-neutral-800 mb-1">{tpl.label}</div>
                  <div className="text-[10px] text-neutral-400 leading-relaxed">{tpl.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* مرحله ۲: ویرایش محتوا و کدهای رنگی */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* ستون چپ: پیش‌نمایش زنده کامپوننت */}
            <div className="lg:col-span-7 bg-white border border-neutral-100 rounded-2xl shadow-sm p-5 lg:sticky lg:top-5">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-xl bg-neutral-50 w-8 h-8 rounded-lg flex items-center justify-center border border-neutral-100">{selectedTemplate.emoji}</span>
                <div>
                  <div className="font-black text-xs text-neutral-800">پیش‌نمایش زنده تمپلیت «{selectedTemplate.label}»</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">{selectedTemplate.desc}</div>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden border border-neutral-100 bg-neutral-50">
                {isStrip ? (
                  <div className="h-14">
                    <StripBannerRenderer banner={previewBanner} />
                  </div>
                ) : (
                  <div className="h-[240px]">
                    <BannerRenderer banner={previewBanner} preview />
                  </div>
                )}
              </div>
              <p className="m-0 mt-3 text-[10px] text-neutral-300 text-center font-medium">خروجی نهایی متناسب با ابعاد سایدبار یا گرید اصلی مچ می‌شود</p>
            </div>

            {/* ستون راست: پنل فرم تنظیمات */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm p-5">
                
                {/* دکمه‌های ناوبری تب‌ها */}
                <div className="flex gap-2 mb-5 bg-neutral-100 p-1 rounded-xl">
                  <button 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${activeTab === "content" ? "bg-[#aa4725] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-800 bg-transparent"}`} 
                    onClick={() => setActiveTab("content")}
                  >
                    محتوای متنی بنر
                  </button>
                  <button 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${activeTab === "colors" ? "bg-[#aa4725] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-800 bg-transparent"}`} 
                    onClick={() => setActiveTab("colors")}
                  >
                    پالت رنگی سفارشی
                  </button>
                </div>

                {/* تب محتوا */}
                {activeTab === "content" && (
                  <div className="flex flex-col gap-4">
                    {/* ساختار آپلود مدیا مالتی کلودینری */}
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1.5">تصویر پس‌زمینه بنر</label>
                      {form.imageUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-neutral-100 shadow-sm">
                          <img src={form.imageUrl} alt="" className="w-full h-28 object-cover block" />
                          <button 
                            onClick={() => setForm(p => ({ ...p, imageUrl: "", imagePublicId: "" }))} 
                            className="absolute top-2 left-2 bg-black/70 hover:bg-black text-white border-none rounded-full w-6 h-6 cursor-pointer text-[10px] flex items-center justify-center transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="border-2 border-dashed border-neutral-200 hover:border-[#aa4725] hover:bg-orange-50/10 rounded-xl p-5 text-center cursor-pointer transition-all"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? (
                            <div className="text-neutral-400 text-xs font-semibold animate-pulse">در حال آپلود سورس مدیا...</div>
                          ) : (
                            <>
                              <div className="text-2xl mb-1">📷</div>
                              <div className="text-xs font-bold text-neutral-500">انتخاب و آپلود تصویر بنر</div>
                              <div className="text-[10px] text-neutral-300 mt-1">حداکثر حجم مجاز ۲ مگابایت (JPG, PNG, WebP)</div>
                            </>
                          )}
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </div>

                    {/* رندر فیلدهای داینامیک */}
                    {[
                      { key: "badge", label: "بج اختصاصی بالای بنر (مثال: پیشنهاد ویژه رولند گاروس)" },
                      { key: "title", label: "عنوان اصلی بنر" },
                      { key: "subtitle", label: "کپشن / زیرعنوان توضیحات" },
                      { key: "ctaText", label: "متن دکمه اکشن (CTA)" },
                      { key: "link", label: "لینک URL مقصد دکمه" },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="block text-xs font-bold text-neutral-600 mb-1.5">{field.label}</label>
                        <input
                          className="w-full px-3.5 py-2 border border-neutral-200 focus:border-[#aa4725] rounded-xl text-xs font-bold text-neutral-800 outline-none transition-colors"
                          value={form[field.key] || ""}
                          onChange={e => handleField(field.key, e.target.value)}
                          placeholder={field.label}
                          dir="auto"
                        />
                      </div>
                    ))}

                    {/* فیلدها و ساختار اوردر و سورتینگ */}
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-neutral-600 mb-1.5">ترتیب اولویت نمایش</label>
                        <input 
                          className="w-full px-3.5 py-2 border border-neutral-200 focus:border-[#aa4725] rounded-xl text-xs font-bold text-neutral-800 outline-none transition-colors" 
                          type="number" 
                          value={form.order} 
                          onChange={e => handleField("order", Number(e.target.value))} 
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={form.isActive} 
                            onChange={e => handleField("isActive", e.target.checked)} 
                            className="w-4 h-4 rounded border-neutral-300 text-[#aa4725] focus:ring-[#aa4725] accent-[#aa4725]" 
                          />
                          <span className="text-xs font-black text-neutral-700">وضعیت انتشار بنر فعال باشد</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* تب پالت رنگی (Hex values) */}
                {activeTab === "colors" && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] font-medium text-neutral-400 mb-2">
                      تمامی کدهای هگز یا گرادیانت کدهای استایل تمپلیت را مستقیماً شخصی‌سازی کنید:
                    </p>
                    {COLOR_FIELDS.map(field => (
                      <div key={field.key} className="flex items-center gap-3 border border-neutral-100 rounded-xl p-2 bg-neutral-50/50">
                        <div className="w-9 h-9 rounded-xl border border-neutral-200 cursor-pointer overflow-hidden shrink-0 relative shadow-sm">
                          <input 
                            type="color" 
                            className="absolute scale-150 cursor-pointer border-none p-0 m-0 w-full h-full"
                            value={
                              (form.colors?.[field.key] || "#000000").startsWith("rgba") || (form.colors?.[field.key] || "#000000").includes("linear-gradient")
                                ? "#aa4725"
                                : (form.colors?.[field.key] || "#000000")
                            } 
                            onChange={e => handleColor(field.key, e.target.value)} 
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-[11px] font-black text-neutral-700">{field.label}</div>
                          <input
                            className="w-full mt-1 px-2.5 py-1.5 bg-white border border-neutral-200 focus:border-[#aa4725] rounded-lg text-[11px] font-mono font-medium outline-none transition-colors"
                            value={form.colors?.[field.key] || ""}
                            onChange={e => handleColor(field.key, e.target.value)}
                            placeholder="مثال: #aa4725 یا rgba(0,0,0,0.5)"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setForm(prev => ({ ...prev, colors: { ...selectedTemplate.defaultColors } }))}
                      className="w-full mt-2 py-2 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-600 rounded-xl font-bold text-xs border-none cursor-pointer transition-colors"
                    >
                      ریست و بازگشت به پالت پیش‌فرض تمپلیت
                    </button>
                  </div>
                )}
              </div>

              {/* کلید نهایی ثبت فیلدها */}
              <button 
                className="w-full py-3.5 bg-[#aa4725] hover:bg-[#933d1f] disabled:opacity-50 text-white rounded-2xl text-sm font-black transition-colors shadow-md active:scale-[0.99]" 
                disabled={saving} 
                onClick={handleSave}
              >
                {saving ? "در حال اعتبارسنجی و ذخیره..." : isEdit ? "ذخیره تغییرات اعمال شده" : "ساخت و انتشار بنر نهایی"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}