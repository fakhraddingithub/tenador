'use client';

/**
 * امتیازدهی محصول دست‌دوم — سیستم نمره از ۱۰ (به جای ۵ ستاره).
 * مقدار بین ۱ تا ۱۰ و خروجی به صورت عدد ذخیره می‌شود.
 */
export default function StarRating({ value, onChange, disabled }) {
  const v = Number(value) || 0;

  const handleChange = (e) => {
    const raw = parseInt(e.target.value, 10);
    if (isNaN(raw)) return onChange?.(0);
    const clamped = Math.max(1, Math.min(10, raw));
    onChange?.(clamped);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={10}
        step={1}
        value={v || ''}
        disabled={disabled}
        onChange={handleChange}
        placeholder="0"
        dir="ltr"
        className={`w-14 text-center font-bold text-sm bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 ring-[var(--color-primary)]/20 ${
          disabled ? 'opacity-60 cursor-default' : ''
        }`}
      />
      <span className="text-xs font-bold text-neutral-400">/ ۱۰</span>
    </div>
  );
}
