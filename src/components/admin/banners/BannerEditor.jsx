"use client";

import { useState, useRef } from "react";
import BannerRenderer from "@/components/banners/BannerRenderer";
import StripBannerRenderer from "@/components/banners/StripBannerRenderer";

// به جای ایموجی از یک نام برای نمایش آیکون یا تصویر استفاده می‌کنیم
const TEMPLATES = [
  { key: "flame", label: "آتشین", desc: "پرانرژی برای کمپین‌های تخفیف", defaultColors: { bg: "#0d0d0d", primary: "#aa4725", secondary: "#ffbf00", text: "#ffffff", textSecondary: "rgba(255,255,255,0.7)", accent: "#ffffff" } },
  { key: "luxury", label: "لاکچری", desc: "ظریف و بلندپایه برای کالکشن ویژه", defaultColors: { bg: "#0a0a0a", primary: "#aa4725", secondary: "#ffbf00", text: "#ffffff", textSecondary: "rgba(255,255,255,0.55)", accent: "#ffbf00" } },
  { key: "geometric", label: "هندسی", desc: "مدرن و جذاب برای معرفی محصول جدید", defaultColors: { bg: "#f5f0eb", primary: "#aa4725", secondary: "#ffbf00", text: "#0d0d0d", textSecondary: "#555555", accent: "#ffffff" } },
  { key: "neon", label: "نئون", desc: "سایبرپانک برای فروش ویژه", defaultColors: { bg: "#070712", primary: "#aa4725", secondary: "#ffbf00", text: "#ffffff", textSecondary: "rgba(255,255,255,0.6)", accent: "#ffbf00" } },
];

const COLOR_FIELDS = [
  { key: "bg", label: "پس‌زمینه" },
  { key: "primary", label: "رنگ اصلی" },
  { key: "secondary", label: "رنگ ثانویه" },
  { key: "text", label: "رنگ متن" },
];

export default function BannerEditor({ banner, position, onClose, onSave }) {
  const isEdit = !!banner;
  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [form, setForm] = useState(isEdit ? { ...banner, colors: { ...banner.colors } } : { position, template: "flame", colors: TEMPLATES[0].defaultColors, isActive: true, order: 0 });
  const [activeTab, setActiveTab] = useState("content");
  const [saving, setSaving] = useState(false);

  const selectedTemplate = TEMPLATES.find(t => t.key === form.template);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans" dir="rtl">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">←</button>
          <h1 className="text-xl font-bold text-slate-800">{isEdit ? "ویرایش بنر" : "ساخت بنر جدید"}</h1>
        </div>
      </div>

      {step === 1 ? (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold mb-6">انتخاب تمپلیت</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TEMPLATES.map(tpl => (
              <button 
                key={tpl.key} 
                onClick={() => { setForm({...form, template: tpl.key, colors: tpl.defaultColors}); setStep(2); }}
                className={`p-6 rounded-2xl border-2 text-right transition-all ${form.template === tpl.key ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <div className="font-bold text-slate-800 mb-2">{tpl.label}</div>
                <div className="text-xs text-slate-500">{tpl.desc}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Preview Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">پیش‌نمایش</h3>
              <div className="rounded-2xl overflow-hidden border border-slate-100">
                {position === "strip" ? <StripBannerRenderer banner={form} /> : <BannerRenderer banner={form} preview />}
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl">
              {["content", "colors"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-sm font-bold rounded-lg capitalize ${activeTab === tab ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>
                  {tab === "content" ? "محتوا" : "رنگ‌بندی"}
                </button>
              ))}
            </div>

            {activeTab === "content" ? (
              <div className="space-y-4">
                {["title", "subtitle", "ctaText"].map(field => (
                  <div key={field}>
                    <label className="text-xs font-bold text-slate-500 uppercase">{field}</label>
                    <input className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                           value={form[field] || ""} onChange={e => setForm({...form, [field]: e.target.value})} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {COLOR_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-4">
                    <input type="color" value={form.colors[field.key]} onChange={e => setForm({...form, colors: {...form.colors, [field.key]: e.target.value}})} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                    <span className="text-sm font-medium text-slate-700">{field.label}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={onSave} className="w-full mt-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200">
              {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}