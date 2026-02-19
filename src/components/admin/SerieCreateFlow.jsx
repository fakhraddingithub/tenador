"use client";

import { useState, useEffect } from "react";
import {
  FaMagic, FaRobot, FaCopy, FaCheckCircle,
  FaArrowLeft, FaArrowRight, FaCode, FaFileAlt, FaPenNib, FaSave
} from "react-icons/fa";
import { toast } from "react-toastify";
import { buildSerieTemplate } from "@/lib/buildSerieTemplate";
import SerieCreateForm from "./SerieCreateForm"; // کامپوننت فرم نهایی شما

export default function ModernSerieAIFlow({ brandId, brandName }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [brandLoading, setBrandLoading] = useState(true); // لودینگ اولیه دیتابیس
  const [brand, setBrand] = useState(null); // ذخیره کل آبجکت برند
  const [rawText, setRawText] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [parsedData, setParsedData] = useState(null);

  useEffect(() => {
    const fetchBrand = async () => {
      try {
        const res = await fetch(`/api/brands/${brandId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setBrand(data.brand);
      } catch (err) {
        toast.error("خطا در دریافت اطلاعات برند");
      } finally {
        setBrandLoading(false);
      }
    };

    if (brandId) fetchBrand();
  }, [brandId]);

  const steps = [
    { id: 1, label: "متن کاتالوگ", icon: <FaFileAlt /> },
    { id: 2, label: "دریافت دستور", icon: <FaRobot /> },
    { id: 3, label: "تایید نهایی", icon: <FaCheckCircle /> },
  ];
  console.log(brand);

  const generatePrompt = () => {
    if (rawText.length < 20) return toast.warning("لطفاً متن کامل‌تری وارد کنید");
    setLoading(true);
    setTimeout(() => {
      const prompt = buildSerieTemplate({
        brand,
        rawContent: rawText
      });
      setAiPrompt(prompt);
      setStep(2);
      setLoading(false);
    }, 800);
  };

  const validateAndParse = () => {
    try {
      const data = JSON.parse(aiResult);
      if (!data.name || !data.title) throw new Error();
      setParsedData(data);
      // بعد از پارس موفق، فرم نهایی نمایش داده می‌شود
    } catch (err) {
      toast.error("فرمت JSON وارد شده معتبر نیست. لطفاً دقیقاً همان چیزی که AI داده را پیست کنید.");
    }
  };

  if (brandLoading) {
    return (
      <div className="max-w-4xl mx-auto my-20 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="font-bold text-gray-400">در حال فراخوانی دستورالعمل‌های برند...</p>
      </div>
    );
  }

  // اگر دیتا پارس شده باشد، فرم نهایی را نشان بده
  if (parsedData) {
    return (
      <div className="max-w-4xl mx-auto animate-in fade-in duration-700">
        <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-200">
              <FaCheckCircle size={24} />
            </div>
            <div>
              <h2 className="font-bold text-xl">اطلاعات آماده است!</h2>
              <p className="text-gray-400 text-xs font-bold">می‌توانید فیلدها را بازبینی و ثبت کنید.</p>
            </div>
          </div>
          <button onClick={() => setParsedData(null)} className="text-xs font-bold text-red-500 hover:underline">ویرایش مجدد JSON</button>
        </div>

        {/* کامپوننت فرم ساخت سری که دیتای استخراج شده را به عنوان مقدار اولیه می‌گیرد */}
        <SerieCreateForm initialData={parsedData} brandId={brandId} brandName={brandName} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-10 space-y-8 animate-in fade-in duration-500">

      {/* استپر افقی با عرض یکسان */}
      <div className="flex justify-between items-center px-12 relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0 rounded-full" />
        {steps.map((s) => (
          <div key={s.id} className="relative z-10 flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 shadow-xl ${step >= s.id ? "bg-[var(--color-primary)] text-white scale-110 shadow-[var(--color-primary)]/20" : "bg-white text-gray-300 border border-gray-100"
              }`}>
              {s.icon}
            </div>
            <span className={`text-xs font-bold tracking-tight ${step >= s.id ? "text-black" : "text-gray-300"}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* کارت اصلی با عرض ثابت برای هر سه مرحله */}
      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] overflow-hidden min-h-[500px] flex flex-col">

        {/* مرحله اول: ورودی متن خام */}
        {step === 1 && (
          <div className="p-10 flex-1 flex flex-col space-y-6 animate-in slide-in-from-left-5 duration-500">
            <div className="space-y-1 text-right">
              <h2 className="text-2xl font-bold italic flex flex-row-reverse items-center gap-3">
                <FaPenNib className="text-white bg-black p-2 rounded-xl" /> استخراج هوشمند اطلاعات
              </h2>
              <p className="text-gray-400 text-sm font-bold">توضیحات یا کاتالوگ سری جدید محصول را در کادر زیر وارد کنید.</p>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full flex-1 min-h-[300px] bg-gray-50 border-2 border-transparent focus:border-[var(--color-primary)] rounded-[2rem] p-8 outline-none transition-all text-sm leading-relaxed font-medium text-right shadow-inner"
              placeholder="مثال: سری جدید کفش‌های ورزشی آدیداس مدل Predator دارای تکنولوژی کنترل توپ..."
            />

            <button
              onClick={generatePrompt}
              disabled={loading}
              className="w-full bg-black text-white font-bold py-6 rounded-2xl flex items-center justify-center gap-3 hover:shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "در حال پردازش..." : <><FaMagic className="text-[var(--color-primary)]" /> ساخت دستور هوشمند</>}
            </button>
          </div>
        )}

        {/* مرحله دوم: نمایش پرامپت جهت کپی */}
        {step === 2 && (
          <div className="p-10 flex-1 flex flex-col space-y-6 animate-in zoom-in-95 duration-500">
            <div className="bg-[var(--color-primary)]/10 border-r-4 border-[var(--color-primary)] p-6 rounded-2xl text-right">
              <p className="text-black font-bold text-sm mb-1">راهنما:</p>
              <p className="text-sm text-gray-700 font-bold leading-6">دستور زیر را کپی کرده و به هوش مصنوعی (مانند ChatGPT) بدهید. سپس خروجی کد (JSON) را کپی کرده و در مرحله بعد وارد کنید.</p>
            </div>

            <div className="relative group flex-1">
              <pre className="h-[400px] bg-gray-900 text-gray-400 p-8 rounded-[2rem] text-[11px] overflow-y-auto leading-7 font-mono border border-black shadow-2xl text-left dir-ltr">
                {aiPrompt}
              </pre>

              <button
                onClick={() => { navigator.clipboard.writeText(aiPrompt); toast.info("کپی شد!"); }}
                className="absolute top-6 right-6 bg-[var(--color-primary)] text-white px-6 py-3 rounded-xl text-xs font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                <FaCopy /> کپی دستور
              </button>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 py-5 font-bold text-xs text-gray-400 hover:text-black transition-all">
                بازگشت به مرحله قبل
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-[2] bg-black text-white py-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:shadow-xl transition-all"
              >
                مرحله بعد: وارد کردن کد <FaArrowLeft className="text-[var(--color-primary)]" />
              </button>
            </div>
          </div>
        )}

        {/* مرحله سوم: پیست کردن جیسون */}
        {step === 3 && (
          <div className="p-10 flex-1 flex flex-col space-y-6 animate-in slide-in-from-right-5 duration-500">
            <div className="space-y-1 text-right">
              <h2 className="text-2xl font-bold italic flex flex-row-reverse items-center gap-3">
                <FaCode className="text-white bg-black p-2 rounded-xl" /> بارگذاری خروجی هوش مصنوعی
              </h2>
              <p className="text-gray-400 text-sm font-bold">کد JSON دریافت شده را در کادر زیر قرار دهید.</p>
            </div>

            <textarea
              value={aiResult}
              onChange={(e) => setAiResult(e.target.value)}
              className="w-full flex-1 min-h-[300px] bg-gray-900 border-none rounded-[2rem] p-8 font-mono text-[11px] text-[var(--color-primary)] outline-none shadow-2xl dir-ltr"
              placeholder='{ "name": "...", "title": "...", ... }'
            />

            <div className="flex gap-4">
              <button onClick={() => setStep(2)} className="flex-1 py-5 font-bold text-xs text-gray-400 hover:text-black transition-all">
                بازگشت
              </button>
              <button
                onClick={validateAndParse}
                className="flex-[3] bg-[var(--color-primary)] text-white font-bold py-5 rounded-2xl shadow-lg shadow-[var(--color-primary)]/20 hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                تایید و انتقال به فرم نهایی <FaCheckCircle />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}