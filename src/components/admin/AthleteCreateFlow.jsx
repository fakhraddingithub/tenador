"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { FaRobot, FaCopy, FaCheckCircle, FaDatabase, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { HiOutlineDocumentText } from "react-icons/hi";
import AthleteCreateForm from "./AthleteCreateForm";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";


const steps = [
  { id: 1, label: "متن بیوگرافی", icon: <HiOutlineDocumentText /> },
  { id: 2, label: "دریافت پرامپت", icon: <FaRobot /> },
  { id: 3, label: "تایید داده‌ها", icon: <FaDatabase /> },
];

export default function AddAthleteAi({ sports }) {
  // POST /api/ai/athlete-prompt → ai.athletePrompt (جدا از athletes.create)
  const { can } = useAdminPermissions();
  const canUseAi = can("ai.athletePrompt");
  const [step, setStep] = useState(1);
  const [rawContent, setRawContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);

  // مرحله ۱: تولید پرامپت از متن خام
  async function generatePrompt() {
    if (!rawContent.trim()) return toast.error("ابتدا متن بیوگرافی را وارد کنید");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/athlete-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAiPrompt(data.prompt);
      setStep(2);
      toast.success("پرامپت با موفقیت ساخته شد");
    } catch (err) {
      Swal.fire("خطا", err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // مرحله ۲: اعتبارسنجی JSON دریافتی از AI
  function validateJson() {
    try {
      const parsed = JSON.parse(aiResult);
      setParsedData(parsed);
      setStep(3);
      Swal.fire({
        icon: "success",
        title: "اطلاعات استخراج شد",
        text: "حالا می‌توانید جزئیات را چک کرده و عکس را آپلود کنید",
        confirmButtonColor: "var(--color-primary)",
      });
    } catch (e) {
      Swal.fire("خطا در فرمت JSON", "متن وارد شده یک JSON معتبر نیست. لطفاً خروجی AI را دقیق کپی کنید.", "error");
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-[var(--color-background)] rounded-[var(--radius)] shadow-lg overflow-hidden border border-gray-100">
      {/* Header & Stepper */}
      <div className="bg-gray-50 p-6 border-b border-gray-100">
        <div className="flex items-center justify-between relative">
          {steps.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center z-10 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all duration-300 ${
                  step >= s.id ? "bg-[var(--color-primary)] text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {s.id < step ? <FaCheckCircle /> : s.icon}
              </div>
              <span className={`text-xs mt-2 font-medium ${step >= s.id ? "text-[var(--color-text)]" : "text-gray-400"}`}>
                {s.label}
              </span>
            </div>
          ))}
          {/* Progress Line */}
          <div className="absolute top-5 left-0 w-full h-[2px] bg-gray-200 -z-0">
            <div
              className="h-full bg-[var(--color-primary)] transition-all duration-500"
              style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* STEP 1: Raw Input */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <label className="block text-sm font-bold text-[var(--color-text)]">متن بیوگرافی یا اطلاعات خام را اینجا وارد کنید:</label>
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              rows={10}
              className="w-full p-4 border border-gray-200 rounded-[var(--radius)] focus:ring-2 focus:ring-[var(--color-secondary)] outline-none transition-all text-sm leading-relaxed"
              placeholder="مثال: کریستیانو رونالدو متولد ۵ فوریه ۱۹۸۵ در پرتغال است. قد او ۱۸۷ سانتی‌متر است..."
            />
            {canUseAi ? (
            <button
              onClick={generatePrompt}
              disabled={loading}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-bold py-3 rounded-[var(--radius)] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? "در حال پردازش..." : <><FaRobot /> ساخت پرامپت هوشمند</>}
            </button>
            ) : (
              <p className="text-xs font-bold text-gray-400 text-center">
                دسترسی «دستیار هوش مصنوعی» را ندارید — می‌توانید JSON را دستی وارد کنید.
              </p>
            )}
          </div>
        )}

        {/* STEP 2: Copy Prompt */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-amber-50 border-r-4 border-[var(--color-secondary)] p-4 text-sm text-amber-800">
              پرامپت زیر را کپی کرده و به ChatGPT یا هوش مصنوعی دیگری بدهید. سپس خروجی JSON را در مرحله بعد وارد کنید.
            </div>
            <div className="relative group">
              <pre className="bg-gray-900 text-gray-100 p-5 rounded-[var(--radius)] text-xs overflow-auto max-h-72 leading-6">
                {aiPrompt}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aiPrompt);
                  toast.info("پرامپت کپی شد");
                }}
                className="absolute top-3 left-3 bg-[var(--color-secondary)] text-black px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 hover:scale-105 transition-transform"
              >
                <FaCopy /> کپی متن
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 py-3 rounded-[var(--radius)] flex items-center justify-center gap-2">
                <FaArrowRight /> بازگشت
              </button>
              <button onClick={() => setStep(3)} className="flex-[2] bg-[var(--color-primary)] text-white py-3 rounded-[var(--radius)] font-bold flex items-center justify-center gap-2">
                مرحله بعد <FaArrowLeft />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: JSON Paste */}
        {step === 3 && !parsedData && (
          <div className="space-y-4 animate-fadeIn">
            <label className="block text-sm font-bold">خروجی JSON را اینجا پیست کنید:</label>
            <textarea
              value={aiResult}
              onChange={(e) => setAiResult(e.target.value)}
              rows={10}
              className="w-full p-4 border border-gray-200 rounded-[var(--radius)] font-mono text-sm bg-gray-50"
              placeholder='{ "name": "...", "title": "...", ... }'
            />
            <button
              onClick={validateJson}
              className="w-full bg-[var(--color-secondary)] text-black font-bold py-3 rounded-[var(--radius)] hover:opacity-90 transition-all shadow-md"
            >
              تایید و بررسی نهایی
            </button>
          </div>
        )}

        {/* FINAL STEP: Integration with your Form */}
        {parsedData && (
          <div className="animate-fadeIn">
             <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-lg">پیش‌نویس ورزشکار آماده است</h2>
                <button onClick={() => setParsedData(null)} className="text-sm text-red-500 underline">ویرایش JSON</button>
             </div>
             {/* در اینجا کامپوننت فرم خود را صدا می‌زنید */}
             <AthleteCreateForm initialData={parsedData} />
          </div>
        )}
      </div>
    </div>
  );
}