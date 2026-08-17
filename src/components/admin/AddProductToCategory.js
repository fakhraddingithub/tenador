"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";

/**
 * Step 1: Generate AI prompt
 * Step 2: Paste AI JSON result
 * Step 3: Validate and pass to parent
 */
export default function AIProductDraftStep({ categoryId, onConfirm }) {
  const { can } = useAdminPermissions();
  const canUseAi = can("ai.productDraft");
  const [step, setStep] = useState("RAW"); // RAW | PROMPT | RESULT
  const [rawContent, setRawContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGeneratePrompt() {
    setError("");

    if (!rawContent || rawContent.trim().length < 50) {
      setError("متن محصول خیلی کوتاهه. حداقل یه توضیح درست بده.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/ai/product-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, rawContent }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "خطا در ساخت پرامپت");
      }

      setAiPrompt(data.draft);
      setStep("PROMPT");
      toast.success("پرامپت ساخته شد");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(aiPrompt);
    toast.info("پرامپت کپی شد");
  }

  function handleValidateAndConfirm() {
    try {
      const parsed = JSON.parse(aiResult);

      Swal.fire({
        icon: "success",
        title: "JSON معتبره",
        text: "اطلاعات به فرم ساخت محصول ارسال شد",
      });

      // تحویل داده به والد
      onConfirm(parsed);
    } catch {
      Swal.fire({
        icon: "error",
        title: "JSON نامعتبر",
        text: "پاسخ AI فرمت JSON درست نداره",
      });
    }
  }

  return (
    <div className="w-full max-w-4xl bg-white rounded-xl shadow p-6 space-y-6">

      <h2 className="text-xl font-bold text-gray-800">
        تولید محصول با هوش مصنوعی
      </h2>

      {/* RAW INPUT */}
      {step === "RAW" && (
        <>
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            rows={7}
            className="w-full rounded-lg border p-3 text-sm focus:ring-2 focus:ring-black"
            placeholder="توضیحات کامل محصول رو اینجا پیست کن..."
          />

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          {canUseAi ? (
          <button
            onClick={handleGeneratePrompt}
            disabled={loading}
            className="w-full rounded-lg bg-black text-white py-3 text-sm font-semibold"
          >
            {loading ? "در حال ساخت پرامپت..." : "ساخت پرامپت"}
          </button>
          ) : (
            <p className="text-xs font-bold text-gray-400 text-center">
              دسترسی «دستیار هوش مصنوعی» را ندارید — می‌توانید JSON را دستی وارد کنید.
            </p>
          )}
        </>
      )}

      {/* PROMPT */}
      {step === "PROMPT" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">پرامپت AI</span>
            <button
              onClick={handleCopyPrompt}
              className="text-xs px-3 py-1 rounded bg-gray-200"
            >
              کپی
            </button>
          </div>

          <pre className="text-xs bg-gray-50 border rounded p-4 max-h-64 overflow-auto">
            {aiPrompt}
          </pre>

          <button
            onClick={() => setStep("RESULT")}
            className="w-full rounded-lg bg-blue-600 text-white py-2 text-sm font-semibold"
          >
            پاسخ AI رو دارم
          </button>
        </div>
      )}

      {/* RESULT */}
      {step === "RESULT" && (
        <div className="space-y-3">
          <textarea
            value={aiResult}
            onChange={(e) => setAiResult(e.target.value)}
            rows={8}
            className="w-full rounded-lg border p-3 text-sm"
            placeholder="JSON خروجی ChatGPT رو اینجا پیست کن..."
          />

          <button
            onClick={handleValidateAndConfirm}
            className="w-full rounded-lg bg-green-600 text-white py-2 text-sm font-semibold"
          >
            تایید و رفتن به ساخت محصول
          </button>
        </div>
      )}
    </div>
  );
}
