"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import ProductCreateForm from "./ProductCreateForm";
import { normalizeTargetAudience } from "base/utils/targetAudience";

const steps = [
  { id: 1, label: "متن خام" },
  { id: 2, label: "پرامپت AI" },
  { id: 3, label: "JSON نهایی" },
];

export default function AddProductToCategory({ categoryId }) {
  const [step, setStep] = useState(1);

  const [rawContent, setRawContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [parsedProduct, setParsedProduct] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGeneratePrompt() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/product-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, rawContent }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAiPrompt(data.draft);
      setStep(2);
      toast.success("پرامپت ساخته شد");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleValidateJSON() {
    try {
      const parsed = JSON.parse(aiResult);
      if (parsed.targetAudience != null && parsed.targetAudience !== "") {
        const normalizedTargetAudience = normalizeTargetAudience(parsed.targetAudience);
        if (!normalizedTargetAudience) throw new Error("invalid targetAudience");
        parsed.targetAudience = normalizedTargetAudience;
      }
      setParsedProduct(parsed);
      setStep(3);

      Swal.fire({
        icon: "success",
        title: "JSON معتبره",
        text: "می‌تونی محصول رو ویرایش و ثبت کنی",
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "JSON نامعتبر",
        text: "فرمت خروجی AI غلطه",
      });
    }
  }

  return (
    <div className="w-full max-w-5xl bg-white rounded-xl shadow p-6 space-y-8">

      {/* Stepper */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center w-full">
            <button
              onClick={() => s.id <= step && setStep(s.id)}
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold
                ${step >= s.id ? "bg-black text-white" : "bg-gray-300 text-gray-600"}
              `}
            >
              {s.id}
            </button>

            {i < steps.length - 1 && (
              <div className="flex-1 h-1 mx-2 bg-gray-300 relative overflow-hidden">
                <div
                  className={`h-full bg-black transition-all duration-500`}
                  style={{ width: step > s.id ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            rows={8}
            className="w-full border rounded-lg p-3 text-sm"
            placeholder="متن محصول از سایت مرجع..."
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleGeneratePrompt}
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            ساخت پرامپت
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(aiPrompt);
              toast.info("پرامپت کپی شد");
            }}
            className="bg-gray-200 px-4 py-2 rounded"
          >
            کپی پرامپت
          </button>

          <pre className="text-xs bg-gray-50 border p-4 rounded max-h-64 overflow-auto">
            {aiPrompt}
          </pre>

          <button
            onClick={() => setStep(3)}
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            ادامه
          </button>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && !parsedProduct && (
        <div className="space-y-4">
          <textarea
            value={aiResult}
            onChange={(e) => setAiResult(e.target.value)}
            rows={8}
            className="w-full border rounded-lg p-3 text-sm"
            placeholder="JSON خروجی ChatGPT..."
          />

          <button
            onClick={handleValidateJSON}
            className="w-full bg-green-600 text-white py-3 rounded-lg"
          >
            تایید JSON
          </button>
        </div>
      )}

      {/* FINAL FORM */}
      {parsedProduct && (
        <ProductCreateForm initialData={parsedProduct} />
      )}
    </div>
  );
}
