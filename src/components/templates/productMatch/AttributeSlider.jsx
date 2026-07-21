'use client';

// یک ردیف اسلایدر برای یک شاخص فنی دسته‌بندی
export default function AttributeSlider({ stat, value, onChange }) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-neutral-700">{stat.label}</span>
        <span className="text-sm font-extrabold text-[var(--color-primary)] tabular-nums">
          {Number(value).toLocaleString('fa-IR')}
        </span>
      </div>
      <input
        type="range"
        min={stat.min}
        max={stat.max}
        value={value}
        onInput={(e) => onChange(stat.name, Number(e.target.value))}
        className="w-full h-2 cursor-pointer"
        style={{ accentColor: 'var(--color-primary)' }}
        aria-label={stat.label}
      />
      <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
        <span>{Number(stat.min).toLocaleString('fa-IR')}</span>
        <span>{Number(stat.max).toLocaleString('fa-IR')}</span>
      </div>
    </div>
  );
}
