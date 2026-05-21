"use client";
// components/admin/discounts/CoachCreditForm.jsx
import { useState, useEffect } from "react";
import { toast } from "react-toastify";

const TARGET_TYPES = [
  { value: "all", label: "همه محصولات", hasTargets: false },
  { value: "product", label: "محصول خاص", hasTargets: true, placeholder: "آی‌دی محصولات" },
  { value: "category", label: "دسته‌بندی", hasTargets: true, placeholder: "آی‌دی دسته‌بندی‌ها" },
  { value: "serie", label: "سری محصولات", hasTargets: true, placeholder: "آی‌دی سری‌ها" },
];

const defaultForm = {
  title: "",
  scope: "all_coaches",
  coach: "",
  targetType: "all",
  targets: [],
  credit: { kind: "percent", value: "" },
  conditions: { onlyNewStudents: false, minPurchaseAmount: 0 },
  priority: 100,
  active: true,
  startAt: "",
  endAt: "",
};

export default function CoachCreditForm({ initial, onSuccess, onCancel }) {
  const [form, setForm] = useState(defaultForm);
  const [targetsText, setTargetsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [coaches, setCoaches] = useState([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        ...defaultForm,
        ...initial,
        credit: initial.credit || defaultForm.credit,
        conditions: { ...defaultForm.conditions, ...initial.conditions },
        startAt: initial.startAt ? new Date(initial.startAt).toISOString().slice(0, 16) : "",
        endAt: initial.endAt ? new Date(initial.endAt).toISOString().slice(0, 16) : "",
        coach: initial.coach?._id || initial.coach || "",
      });
      setTargetsText((initial.targets || []).join(", "));
    }
  }, [initial]);

  // اگر scope = specific_coach، لیست مربیان را بگیر
  useEffect(() => {
    if (form.scope === "specific_coach" && coaches.length === 0) {
      setLoadingCoaches(true);
      fetch("/api/admin/users?role=coach&limit=100")
        .then((r) => r.json())
        .then((d) => setCoaches(d.users || []))
        .catch(() => {})
        .finally(() => setLoadingCoaches(false));
    }
  }, [form.scope]);

  const set = (path, value) => {
    setForm((prev) => {
      const parts = path.split(".");
      if (parts.length === 1) return { ...prev, [path]: value };
      return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      targets: targetsText ? targetsText.split(",").map((s) => s.trim()).filter(Boolean) : [],
      credit: { ...form.credit, value: Number(form.credit.value) },
      conditions: {
        onlyNewStudents: form.conditions.onlyNewStudents,
        minPurchaseAmount: Number(form.conditions.minPurchaseAmount) || 0,
      },
      priority: Number(form.priority),
      coach: form.scope === "specific_coach" ? form.coach : null,
      startAt: form.startAt || null,
      endAt: form.endAt || null,
    };

    const url = initial ? `/api/admin/coach-credits/${initial._id}` : "/api/admin/coach-credits";
    const method = initial ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا");
      toast.success(initial ? "ویرایش شد" : "قانون کردیت ایجاد شد");
      onSuccess();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedType = TARGET_TYPES.find((t) => t.value === form.targetType);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* عنوان */}
      <Field label="عنوان قانون *">
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
          className={inputCls}
          placeholder="مثلاً: کردیت مربی برای فروش راکت"
        />
      </Field>

      {/* محدوده اعمال */}
      <Field label="اعمال روی">
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="all_coaches"
              checked={form.scope === "all_coaches"}
              onChange={() => set("scope", "all_coaches")}
              className="accent-[#aa4725]"
            />
            <span className="text-sm">همه مربیان</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="specific_coach"
              checked={form.scope === "specific_coach"}
              onChange={() => set("scope", "specific_coach")}
              className="accent-[#aa4725]"
            />
            <span className="text-sm">مربی خاص</span>
          </label>
        </div>
      </Field>

      {/* انتخاب مربی */}
      {form.scope === "specific_coach" && (
        <Field label="انتخاب مربی *">
          {loadingCoaches ? (
            <p className="text-sm text-gray-400">در حال بارگذاری...</p>
          ) : (
            <select
              value={form.coach}
              onChange={(e) => set("coach", e.target.value)}
              required
              className={inputCls}
            >
              <option value="">انتخاب کنید</option>
              {coaches.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name || c.phone} {c.coachCode ? `(${c.coachCode})` : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {/* هدف کردیت */}
      <Field label="اعمال برای">
        <select
          value={form.targetType}
          onChange={(e) => set("targetType", e.target.value)}
          className={inputCls}
        >
          {TARGET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </Field>

      {/* Targets */}
      {selectedType?.hasTargets && (
        <Field label="آی‌دی‌های هدف">
          <input
            value={targetsText}
            onChange={(e) => setTargetsText(e.target.value)}
            className={inputCls}
            placeholder={selectedType.placeholder + " (با کاما جدا کنید)"}
          />
        </Field>
      )}

      {/* مقدار کردیت */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="نوع کردیت *">
          <select
            value={form.credit.kind}
            onChange={(e) => set("credit.kind", e.target.value)}
            className={inputCls}
          >
            <option value="percent">درصد از مبلغ خرید</option>
            <option value="amount">مبلغ ثابت (تومان)</option>
          </select>
        </Field>
        <Field label="مقدار *">
          <input
            type="number"
            min={0}
            max={form.credit.kind === "percent" ? 100 : undefined}
            value={form.credit.value}
            onChange={(e) => set("credit.value", e.target.value)}
            required
            className={inputCls}
            placeholder={form.credit.kind === "percent" ? "مثلاً: ۵" : "مثلاً: ۱۰۰۰۰"}
          />
        </Field>
      </div>

      {/* شرایط */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
        <p className="text-sm font-medium text-gray-700">شرایط پرداخت کردیت</p>
        <Field label="حداقل مبلغ خرید شاگرد (تومان)">
          <input
            type="number"
            min={0}
            value={form.conditions.minPurchaseAmount}
            onChange={(e) => set("conditions.minPurchaseAmount", e.target.value)}
            className={inputCls}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.conditions.onlyNewStudents}
            onChange={(e) => set("conditions.onlyNewStudents", e.target.checked)}
            className="accent-[#aa4725]"
          />
          فقط برای شاگردان جدید (اولین خرید)
        </label>
      </div>

      {/* تاریخ (اختیاری) */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="تاریخ شروع (اختیاری)">
          <input
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => set("startAt", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="تاریخ پایان (اختیاری)">
          <input
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => set("endAt", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      {/* اولویت و وضعیت */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="اولویت">
          <input
            type="number"
            min={1}
            value={form.priority}
            onChange={(e) => set("priority", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="وضعیت">
          <select
            value={form.active ? "true" : "false"}
            onChange={(e) => set("active", e.target.value === "true")}
            className={inputCls}
          >
            <option value="true">فعال</option>
            <option value="false">غیرفعال</option>
          </select>
        </Field>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-[#aa4725] text-white py-2.5 rounded-xl font-medium hover:bg-[#8f3a1e] transition-colors disabled:opacity-60"
        >
          {saving ? "در حال ذخیره..." : initial ? "ویرایش" : "ایجاد"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          انصراف
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-1 focus:ring-[#aa4725]/20 transition-colors bg-white";
