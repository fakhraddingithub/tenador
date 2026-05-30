"use client";
// components/admin/discounts/DiscountRuleForm.jsx
import { useState, useEffect } from "react";
import { toast } from "react-toastify";

const TYPES = [
  { value: "global", label: "همه محصولات", hasTargets: false },
  { value: "product", label: "محصول خاص", hasTargets: true, placeholder: "آی‌دی محصولات را با کاما جدا کنید" },
  { value: "category", label: "دسته‌بندی", hasTargets: true, placeholder: "آی‌دی دسته‌بندی‌ها" },
  { value: "variant", label: "واریانت خاص", hasTargets: true, placeholder: "آی‌دی واریانت‌ها را با کاما جدا کنید" },
  { value: "serie", label: "سری محصولات", hasTargets: true, placeholder: "آی‌دی سری‌ها" },
  { value: "brand", label: "برند", hasTargets: true, placeholder: "آی‌دی برندها" },
  { value: "userRole", label: "نقش کاربر", hasTargets: false },
  { value: "userLevel", label: "سطح کاربر", hasTargets: false },
  { value: "cartValue", label: "حداقل سبد خرید", hasTargets: false },
];

const USER_ROLES = [
  { value: "coach", label: "مربی" },
  { value: "national_player", label: "ملی‌پوش" },
  { value: "seller", label: "فروشنده" },
  { value: "user", label: "کاربر عادی" },
];

const USER_LEVELS = [
  { value: 1, label: "نقره‌ای" },
  { value: 2, label: "طلایی" },
  { value: 3, label: "پلاتینیوم" },
];

const defaultForm = {
  title: "",
  type: "global",
  targets: [],
  targetRoles: [],
  targetLevels: [],
  discount: { kind: "percent", value: "" },
  conditions: { minCartValue: 0, onlyFirstOrders: false, maxUsagePerUser: "" },
  startAt: "",
  endAt: "",
  priority: 1000,
  combinable: false,
  active: true,
  usageLimit: "",
  note: "",
};

export default function DiscountRuleForm({ initial, onSuccess, onCancel }) {
  const [form, setForm] = useState(defaultForm);
  const [targetsText, setTargetsText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        ...defaultForm,
        ...initial,
        discount: initial.discount || defaultForm.discount,
        conditions: { ...defaultForm.conditions, ...initial.conditions },
        startAt: initial.startAt ? new Date(initial.startAt).toISOString().slice(0, 16) : "",
        endAt: initial.endAt ? new Date(initial.endAt).toISOString().slice(0, 16) : "",
        usageLimit: initial.usageLimit ?? "",
      });
      setTargetsText((initial.targets || []).join(", "));
    }
  }, [initial]);

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
      discount: { ...form.discount, value: Number(form.discount.value) },
      conditions: {
        ...form.conditions,
        minCartValue: Number(form.conditions.minCartValue) || 0,
        maxUsagePerUser: form.conditions.maxUsagePerUser ? Number(form.conditions.maxUsagePerUser) : null,
      },
      priority: Number(form.priority),
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
    };

    const url = initial ? `/api/admin/discounts/${initial._id}` : "/api/admin/discounts";
    const method = initial ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا");
      toast.success(initial ? "ویرایش شد" : "ایجاد شد");
      onSuccess();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedType = TYPES.find((t) => t.value === form.type);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* عنوان */}
      <Field label="عنوان قانون *">
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
          className={inputCls}
          placeholder="مثلاً: تخفیف ویژه مربیان"
        />
      </Field>

      {/* نوع */}
      <Field label="نوع تخفیف *">
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          className={inputCls}
          required
        >
          {TYPES.map((t) => (
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
            placeholder={selectedType.placeholder}
          />
          <p className="text-xs text-gray-400 mt-1">آی‌دی‌ها را با کاما جدا کنید</p>
        </Field>
      )}

      {/* نقش کاربر */}
      {form.type === "userRole" && (
        <Field label="نقش‌های هدف">
          <div className="flex flex-wrap gap-2">
            {USER_ROLES.map((r) => (
              <label key={r.value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.targetRoles.includes(r.value)}
                  onChange={(e) => {
                    const roles = e.target.checked
                      ? [...form.targetRoles, r.value]
                      : form.targetRoles.filter((x) => x !== r.value);
                    set("targetRoles", roles);
                  }}
                  className="accent-[#aa4725]"
                />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
        </Field>
      )}

      {/* سطح کاربر */}
      {form.type === "userLevel" && (
        <Field label="سطوح هدف">
          <div className="flex flex-wrap gap-2">
            {USER_LEVELS.map((l) => (
              <label key={l.value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.targetLevels.includes(l.value)}
                  onChange={(e) => {
                    const levels = e.target.checked
                      ? [...form.targetLevels, l.value]
                      : form.targetLevels.filter((x) => x !== l.value);
                    set("targetLevels", levels);
                  }}
                  className="accent-[#aa4725]"
                />
                <span className="text-sm">{l.label}</span>
              </label>
            ))}
          </div>
        </Field>
      )}

      {/* مقدار تخفیف */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="نوع محاسبه *">
          <select
            value={form.discount.kind}
            onChange={(e) => set("discount.kind", e.target.value)}
            className={inputCls}
          >
            <option value="percent">درصد (%)</option>
            <option value="amount">مبلغ ثابت (تومان)</option>
          </select>
        </Field>
        <Field label="مقدار تخفیف *">
          <input
            type="number"
            min={0}
            max={form.discount.kind === "percent" ? 100 : undefined}
            value={form.discount.value}
            onChange={(e) => set("discount.value", e.target.value)}
            required
            className={inputCls}
            placeholder={form.discount.kind === "percent" ? "مثلاً: ۲۰" : "مثلاً: ۵۰۰۰۰"}
          />
        </Field>
      </div>

      {/* تاریخ */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="تاریخ شروع *">
          <input
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => set("startAt", e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="تاریخ پایان *">
          <input
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => set("endAt", e.target.value)}
            required
            className={inputCls}
          />
        </Field>
      </div>

      {/* شرایط */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
        <p className="text-sm font-medium text-gray-700">شرایط اعمال</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="حداقل سبد خرید (تومان)">
            <input
              type="number"
              min={0}
              value={form.conditions.minCartValue}
              onChange={(e) => set("conditions.minCartValue", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="حداکثر استفاده کل">
            <input
              type="number"
              min={1}
              value={form.usageLimit}
              onChange={(e) => set("usageLimit", e.target.value)}
              className={inputCls}
              placeholder="بدون محدودیت"
            />
          </Field>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.conditions.onlyFirstOrders}
              onChange={(e) => set("conditions.onlyFirstOrders", e.target.checked)}
              className="accent-[#aa4725]"
            />
            فقط اولین سفارش
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.combinable}
              onChange={(e) => set("combinable", e.target.checked)}
              className="accent-[#aa4725]"
            />
            قابل ترکیب با سایر تخفیف‌ها
          </label>
        </div>
      </div>

      {/* اولویت */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="اولویت (عدد کمتر = اولویت بیشتر)">
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

      {/* یادداشت */}
      <Field label="یادداشت داخلی">
        <textarea
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          className={`${inputCls} h-20 resize-none`}
          placeholder="توضیح برای خودت..."
        />
      </Field>

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
