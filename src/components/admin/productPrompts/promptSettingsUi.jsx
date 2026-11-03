'use client';

/**
 * قطعه‌های مشترکِ صفحه‌های «تنظیمات پرامپت»: نمای کلی، پرامپت پایه و صفحه‌ی هر گروه.
 * منطقِ پرامپت در src/lib/productPromptConfig.js است؛ اینجا فقط بارگذاری/ذخیره و UI.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { FiMenu, FiPlus, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { PROMPT_TOKENS } from '@/lib/productPromptConfig';
import { getApiErrorMessage } from '@/lib/apiClientError';
import { matchesSearch } from '@/lib/search';
import { getCategoryLabel } from 'base/utils/categoryLabel';

export const PROMPTS_API = '/api/admin/product-prompts';
export const PROMPTS_HOME = '/p-admin/admin-sports/prompt-settings';

export const swalTheme = {
  confirmButtonColor: 'var(--color-primary)',
  cancelButtonColor: '#9ca3af',
  rtl: true,
  customClass: {
    popup: 'rounded-2xl font-[Vazirmatn]',
    confirmButton: 'rounded-[var(--radius)] font-bold',
    cancelButton: 'rounded-[var(--radius)] font-bold',
  },
};

let seq = 0;
export const uid = () => `u${++seq}`;

/** خطاهای اعتبارسنجی → { path: message } (اولین پیامِ هر مسیر). */
export const errorMap = (errors) => {
  const map = {};
  for (const { path, message } of errors) map[path] ??= message;
  return map;
};

/**
 * بارگذاری و ذخیره‌ی تنظیمات. ذخیره همیشه updatedAtِ نسخه‌ی بارگذاری‌شده را
 * می‌فرستد؛ اگر کسی (یا صفحه‌ی دیگری) در این فاصله ذخیره کرده باشد سرور ۴۰۹
 * می‌دهد و هیچ چیز بازنویسی نمی‌شود.
 */
export function usePromptConfig() {
  const [config, setConfig] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(PROMPTS_API)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(getApiErrorMessage(data, 'خطا در دریافت تنظیمات پرامپت'));
        if (!alive) return;
        setCategories(
          data.categories
            .map((c) => ({ ...c, label: getCategoryLabel(c) }))
            .sort((a, b) => a.label.localeCompare(b.label, 'fa')),
        );
        setConfig(data.config);
      })
      .catch((err) => alive && setLoadError(err.message));
    return () => { alive = false; };
  }, []);

  const categoryById = new Map(categories.map((c) => [c._id, c]));
  // دسته‌ی حذف‌شده‌ای که قبلاً ذخیره شده همچنان «شناخته» است — همان قاعده‌ی سرور
  const knownCategoryIds = new Set([
    ...categories.map((c) => c._id),
    ...(config?.groups || []).flatMap((g) => g.categories),
  ]);

  /** @returns {Promise<{ok: boolean, config?: object, fieldErrors?: object}>} */
  const save = async (partial, successMessage = 'ذخیره شد') => {
    const res = await fetch(PROMPTS_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...partial, updatedAt: config.updatedAt }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      const { isConfirmed } = await Swal.fire({
        ...swalTheme,
        icon: 'warning',
        title: 'تنظیمات تغییر کرده است',
        text: `${data.error || ''} با بارگذاریِ دوباره، تغییراتِ ذخیره‌نشده‌ی این صفحه از بین می‌رود.`,
        showCancelButton: true,
        confirmButtonText: 'بارگذاری دوباره',
        cancelButtonText: 'ماندن در صفحه',
      });
      if (isConfirmed) window.location.reload();
      return { ok: false };
    }
    if (!res.ok) {
      toast.error(getApiErrorMessage({ error: data.error }, 'خطا در ذخیره'));
      return { ok: false, fieldErrors: data.fieldErrors || {} };
    }
    setConfig(data.config);
    toast.success(successMessage);
    return { ok: true, config: data.config };
  };

  return { config, categories, categoryById, knownCategoryIds, loadError, save };
}

/** گروهِ ذخیره‌شده به همان شکلی که PUT می‌پذیرد. */
export const storedGroupPayload = (g) => ({
  _id: g._id,
  title: g.title,
  categories: g.categories,
  rules: g.rules.map((r) => ({ field: r.field, text: r.text, categories: r.categories })),
  sections: g.sections,
});

/** کلیدِ بخشِ تازه؛ فقط باید در همان سند یکتا باشد. */
export const newSectionKey = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** هشدار هنگامِ بستن/بارگذاریِ دوباره‌ی صفحه + تأییدِ ترکِ صفحه برای لینک‌های داخلی. */
export function useUnsavedGuard(dirty) {
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return async (href) => {
    if (dirty) {
      const { isConfirmed } = await Swal.fire({
        ...swalTheme,
        icon: 'warning',
        title: 'تغییرات ذخیره نشده‌اند',
        text: 'با ترکِ این صفحه تغییراتِ ذخیره‌نشده از بین می‌روند.',
        showCancelButton: true,
        confirmButtonText: 'ترکِ صفحه',
        cancelButtonText: 'ماندن',
      });
      if (!isConfirmed) return;
    }
    router.push(href);
  };
}

/**
 * نوارِ تب‌ها. rows: [{ label?, tabs: [{ key, title, count, error, note }] }]
 * هر ردیف می‌شکند (flex-wrap) تا همه‌ی تب‌ها بدونِ اسکرولِ پنهان دیده شوند.
 */
export function PromptTabs({ rows, active, onChange, label }) {
  return (
    <div className="a-card p-3 space-y-2" role="tablist" aria-label={label}>
      {rows.map((row, r) => (
        <div key={r} className="flex flex-wrap items-center gap-1.5">
          {row.label && <span className="w-full sm:w-auto sm:ml-2 text-[11px] font-bold text-gray-400">{row.label}</span>}
          {row.tabs.map((t) => {
            const on = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={on}
                aria-controls="prompt-tabpanel"
                onClick={() => onChange(t.key)}
                className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  on
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                }`}
              >
                {t.title}
                {typeof t.count === 'number' && (
                  <span className={`min-w-5 px-1 rounded text-[10px] ${on ? 'bg-white/25' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
                )}
                {t.note && <span className={`text-[10px] ${on ? 'text-white/80' : 'text-amber-600'}`}>{t.note}</span>}
                {t.error && <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" title="خطا" />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export const textareaClass =
  'w-full px-3 py-2 text-[13px] leading-6 font-medium rounded-xl border-2 outline-none transition-all ' +
  // plaintext: جهتِ هر خط از متنِ همان خط می‌آید (فارسی راست‌به‌چپ، انگلیسی چپ‌به‌راست) تا
  // نقطه و دونقطه سرِ جایشان بمانند؛ direction روی * در globals.css جلوی dir را می‌گیرد.
  'bg-gray-50 text-gray-900 placeholder-gray-400 resize-y text-start [unicode-bidi:plaintext] ' +
  'focus:bg-white focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10';

/**
 * فهرستِ قابل‌جابه‌جاییِ قواعد (کشیدن با دستگیره، یا با صفحه‌کلید: فاصله روی دستگیره و
 * سپس جهت‌نماها). ترتیبِ قواعدِ هر فیلد همان ترتیبشان در پرامپت است.
 * renderItem(item, index, dragHandle) — dragHandle را به RuleCard بدهید.
 * onMove(from, to) با اندیس‌های همین فهرست صدا زده می‌شود.
 */
export function SortableRuleList({ items, getId, onMove, disabled, renderItem }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onMove(ids.indexOf(active.id), ids.indexOf(over.id));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableRow key={ids[index]} id={ids[index]} disabled={disabled || items.length < 2}>
            {(handle) => renderItem(item, index, handle)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const handle = disabled ? null : { ref: setActivatorNodeRef, ...attributes, ...listeners };
  return (
    <div ref={setNodeRef} style={style} className={`relative ${isDragging ? 'z-10 opacity-80 shadow-lg rounded-xl bg-white' : ''}`}>
      {children(handle)}
    </div>
  );
}

/** یک قاعده: textareaِ خودش، حذف، و (برای گروه‌ها) انتخابِ دسته‌ها در children. */
export function RuleCard({ index, rule, onChange, onRemove, error, readOnly, autoFocus, dragHandle, children }) {
  const rows = Math.min(14, Math.max(2, rule.text.split('\n').length));
  return (
    <div className="flex gap-2 items-start">
      {dragHandle && (
        <button
          type="button"
          {...dragHandle}
          title="برای جابه‌جایی بکشید"
          aria-label={`جابه‌جاییِ قاعده ${index + 1}`}
          className="mt-1.5 p-1.5 shrink-0 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 cursor-grab active:cursor-grabbing touch-none"
        >
          <FiMenu size={14} />
        </button>
      )}
      <span className="mt-2 w-6 shrink-0 text-center text-xs font-bold text-gray-400">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <textarea
          value={rule.text}
          rows={rows}
          readOnly={readOnly}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          placeholder="متن قاعده…"
          aria-label={`قاعده ${index + 1}`}
          className={`${textareaClass} ${error ? 'border-red-400 bg-red-50/30' : 'border-gray-200 hover:border-gray-300'}`}
        />
        {children}
        {error && <p className="mt-1 text-xs font-bold text-red-500">! {error}</p>}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          title="حذف قاعده"
          aria-label={`حذف قاعده ${index + 1}`}
          className="mt-1.5 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <FiTrash2 size={15} />
        </button>
      )}
    </div>
  );
}

const headInputClass =
  'w-full px-3 py-2 text-sm font-medium rounded-xl border-2 border-gray-200 bg-gray-50 outline-none text-start [unicode-bidi:plaintext] ' +
  'focus:bg-white focus:border-[var(--color-primary)]';

const HeadField = ({ label, hint, error, children }) => (
  <label className="block">
    <span className="block text-xs font-bold text-gray-600 mb-1">{label}</span>
    {children}
    {hint && <span className="block mt-1 text-[11px] font-bold text-gray-400">{hint}</span>}
    {error && <span className="block mt-1 text-xs font-bold text-red-500">! {error}</span>}
  </label>
);

/**
 * فیلدهای سربرگِ یک بخشِ پرامپت. جز «نام» همه دقیقاً همان‌طور که نوشته شده‌اند چاپ می‌شوند
 * و هر کدام خالی باشد چیزی چاپ نمی‌شود.
 */
export function SectionHeadFields({ section, onChange, readOnly, errors = {}, children }) {
  const text = (part) => ({
    value: section[part] ?? '',
    readOnly,
    onChange: (e) => onChange({ [part]: e.target.value }),
  });
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <HeadField label="نام بخش (در پرامپت چاپ نمی‌شود)" error={errors.name}>
        <input {...text('name')} className={headInputClass} />
      </HeadField>
      <HeadField label="عنوان" error={errors.title}>
        <input {...text('title')} className={headInputClass} />
      </HeadField>
      <HeadField label="جداکننده‌ی بالای عنوان" error={errors.top}>
        <input {...text('top')} className={headInputClass} />
      </HeadField>
      <HeadField label="جداکننده‌ی پایین عنوان" error={errors.bottom}>
        <input {...text('bottom')} className={headInputClass} />
      </HeadField>
      <div className="md:col-span-2">
        <HeadField label="توضیح (پیش از قواعد می‌آید؛ placeholder هم می‌پذیرد)" error={errors.description}>
          <textarea
            {...text('description')}
            rows={Math.min(16, Math.max(2, (section.description ?? '').split('\n').length))}
            className={`${textareaClass} border-gray-200 hover:border-gray-300`}
          />
        </HeadField>
      </div>
      <HeadField label="خط خالی بعد از این بخش" error={errors.blankLines}>
        <input
          type="number"
          min={0}
          max={10}
          value={section.blankLines ?? 1}
          readOnly={readOnly}
          onChange={(e) => onChange({ blankLines: e.target.value === '' ? 0 : Number(e.target.value) })}
          className={headInputClass}
        />
      </HeadField>
      {children}
    </div>
  );
}

/** placeholderهایی که کد در متن‌ها جای می‌گذارد؛ کلیک = کپی. */
export function TokenHelp({ tokens = PROMPT_TOKENS }) {
  const copy = async (key) => {
    try {
      await navigator.clipboard.writeText(`{{${key}}}`);
      toast.success(`{{${key}}} کپی شد`);
    } catch {
      toast.error('کپی انجام نشد');
    }
  };
  return (
    <details className="rounded-xl border border-gray-200 bg-white p-3 text-xs font-bold text-gray-600">
      <summary className="cursor-pointer">داده‌هایی که می‌توانید در متن بگذارید (placeholder)</summary>
      <ul className="mt-3 grid md:grid-cols-2 gap-1.5">
        {tokens.map(({ key, label }) => (
          <li key={key} className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => copy(key)} title="کپی" dir="ltr" className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-[11px] text-gray-700 hover:bg-gray-200">
              {`{{${key}}}`}
            </button>
            <span className="text-[11px] font-medium text-gray-500">{label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** هشدارِ placeholderی که کد نمی‌شناسد: همان‌طور خام به هوش مصنوعی می‌رسد. */
export const UnknownTokensNote = ({ tokens }) =>
  tokens.length > 0 && (
    <p className="text-xs font-bold text-amber-700 leading-6">
      این placeholderها شناخته نیستند و همان‌طور خام در پرامپت می‌مانند: <span dir="ltr" className="font-mono">{tokens.map((t) => `{{${t}}}`).join(' ')}</span>
    </p>
  );

export const AddRuleButton = ({ onClick, label = 'افزودن قاعده' }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
  >
    <FiPlus size={14} /> {label}
  </button>
);

/** چیپِ یک دسته؛ دسته‌ی حذف‌شده قرمز و با برچسبِ خودش. */
export const categoryName = (categoryById, id) => categoryById.get(id)?.label || 'دسته‌ی حذف‌شده';

/** انتخابِ دسته‌های گروه: چیپ‌های انتخاب‌شده + فهرستِ قابل جستجو. */
export function CategoryPicker({ selected, categories, categoryById, onChange, readOnly, error }) {
  const [q, setQ] = useState('');
  const chosen = new Set(selected);
  const visible = categories.filter((c) => matchesSearch(q, c.label, c.name));
  const toggle = (id) => onChange(chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((id) => {
          const cat = categoryById.get(id);
          return (
            <span
              key={id}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                cat ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'bg-red-50 text-red-600'
              }`}
            >
              {categoryName(categoryById, id)}
              {!readOnly && (
                <button type="button" onClick={() => toggle(id)} aria-label="برداشتن دسته" className="hover:opacity-70">
                  <FiX size={12} />
                </button>
              )}
            </span>
          );
        })}
        {!selected.length && <span className="text-xs font-bold text-gray-400">هنوز دسته‌ای انتخاب نشده است.</span>}
      </div>
      {error && <p className="text-xs font-bold text-red-500">! {error}</p>}
      {!readOnly && (
        <div className="border-2 border-gray-100 rounded-xl">
          <div className="relative border-b border-gray-100">
            <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی دسته (مثلاً راکت)…"
              aria-label="جستجوی دسته"
              className="w-full pr-9 pl-3 py-2 text-sm font-bold bg-transparent outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5 grid sm:grid-cols-2 gap-0.5">
            {visible.map((c) => (
              <label key={c._id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={chosen.has(c._id)} onChange={() => toggle(c._id)} className="accent-[var(--color-primary)]" />
                {c.label}
              </label>
            ))}
            {!visible.length && <p className="p-3 text-xs font-bold text-gray-400">دسته‌ای پیدا نشد.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
