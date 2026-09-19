"use client";

import { TARGET_AUDIENCE_SELECT_OPTIONS } from "base/utils/targetAudience";

/**
 * انتخابِ مخاطب‌های هدفی که یک ویژگیِ ثابتِ دسته برایشان معنی دارد.
 *
 * گزینه‌ها دقیقاً همان گزینه‌های مخاطب هدفِ محصول‌اند (منبعِ واحد:
 * utils/targetAudience.js) تا رفتار در کلِ سیستم یکی بماند.
 *
 * هیچ انتخابی = بدونِ محدودیت. این پیش‌فرض عمدی است: هر ویژگیِ موجود بدونِ
 * مهاجرت همان رفتارِ قبلی‌اش را دارد.
 */
export default function AttributeAudienceField({ value = [], onChange }) {
  const selected = new Set(value || []);

  const toggle = (audience) => {
    const next = selected.has(audience)
      ? (value || []).filter((item) => item !== audience)
      : [...(value || []), audience];
    onChange(next);
  };

  return (
    <fieldset className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
      <legend className="px-2 text-sm font-bold text-neutral-800">
        مخاطب هدف مرتبط (اختیاری)
      </legend>
      <p className="mb-3 text-xs leading-6 text-neutral-500">
        اگر هیچ مخاطبی انتخاب نشود، این ویژگی برای همه‌ی محصولات این دسته در نظر
        گرفته می‌شود. با انتخاب مخاطب، ویژگی فقط روی محصولاتی که مخاطب هدفشان با
        انتخاب شما می‌خواند نمایش داده، الزامی و به هوش مصنوعی داده می‌شود.
        «یونی سکس» مثل بقیه‌ی سیستم یعنی بزرگسال (مردانه و زنانه) و شاملِ بچگانه
        نمی‌شود.
      </p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {TARGET_AUDIENCE_SELECT_OPTIONS.map((option) => {
          const checked = selected.has(option.value);
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                checked
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-neutral-900"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.value)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              <span className="font-medium">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
