'use client';

/**
 * «تنظیمات پرامپت» — پرامپت پایه (قاعده به قاعده) و گروه‌های پرامپت دسته.
 *
 * منطق در src/lib/productPromptConfig.js است و همان تابع‌ها اینجا هم اجرا
 * می‌شوند: پیش‌فرض‌ها، اعتبارسنجی (همان که سرور اجرا می‌کند) و ترتیبِ ترکیب.
 * کلِ تنظیمات یک‌جا ذخیره می‌شود؛ بخشی از پرامپت پایه که با پیش‌فرض برابر است
 * اصلاً ذخیره نمی‌شود تا پیش‌فرض‌های کد را دنبال کند.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  FiArrowDown, FiArrowRight, FiArrowUp, FiChevronDown, FiChevronUp, FiEye, FiLayers,
  FiLock, FiPlus, FiRotateCcw, FiSave, FiSearch, FiSliders, FiTrash2, FiX,
} from 'react-icons/fi';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/admin/Button';
import SectionTabs from '@/components/admin/SectionTabs';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import { getApiErrorMessage } from '@/lib/apiClientError';
import { matchesSearch } from '@/lib/search';
import { getCategoryLabel } from 'base/utils/categoryLabel';
import {
  BASE_PROMPT_SECTIONS,
  DEFAULT_BASE_PROMPT,
  GROUP_PROMPT_FIELDS,
  resolveBasePrompt,
  validatePromptConfig,
} from '@/lib/productPromptConfig';

const swalTheme = {
  confirmButtonColor: 'var(--color-primary)',
  cancelButtonColor: '#9ca3af',
  rtl: true,
  customClass: {
    popup: 'rounded-2xl font-[Vazirmatn]',
    confirmButton: 'rounded-[var(--radius)] font-bold',
    cancelButton: 'rounded-[var(--radius)] font-bold',
  },
};

const PREVIEW_RAW_CONTENT =
  'Sample product content for previewing the assembled prompt. Replace this with real product text when generating a product.';

let seq = 0;
const uid = () => `u${++seq}`;
const toRules = (texts) => texts.map((text) => ({ uid: uid(), text }));

function fromServer(config) {
  const base = resolveBasePrompt(config.base);
  return {
    base: Object.fromEntries(Object.entries(base).map(([key, rules]) => [key, toRules(rules)])),
    groups: config.groups.map((g) => ({
      uid: uid(),
      title: g.title,
      categories: [...g.categories],
      rules: g.rules.map((r) => ({ uid: uid(), field: r.field, text: r.text, categories: [...r.categories] })),
    })),
    updatedAt: config.updatedAt,
  };
}

const sameAsDefault = (key, rules) => {
  const def = DEFAULT_BASE_PROMPT[key];
  return rules.length === def.length && rules.every((r, i) => r.text.trim() === def[i].trim());
};

function toPayload(state) {
  return {
    base: BASE_PROMPT_SECTIONS.filter(({ key }) => !sameAsDefault(key, state.base[key])).map(({ key }) => ({
      section: key,
      rules: state.base[key].map((r) => r.text),
    })),
    groups: state.groups.map((g) => ({
      title: g.title,
      categories: g.categories,
      rules: g.rules.map((r) => ({ field: r.field, text: r.text, categories: r.categories })),
    })),
  };
}

const textareaClass =
  'w-full px-3 py-2 text-[13px] leading-6 font-medium rounded-xl border-2 outline-none transition-all ' +
  'bg-gray-50 text-gray-900 placeholder-gray-400 resize-y text-left [direction:ltr] ' +
  'focus:bg-white focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10';

/* ─── یک قاعده ───────────────────────────────────────────────────────────── */
function RuleCard({ index, rule, onChange, onRemove, error, readOnly, autoFocus, children }) {
  const rows = Math.min(14, Math.max(2, rule.text.split('\n').length));
  return (
    <div className="flex gap-2 items-start">
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

const AddRuleButton = ({ onClick, label = 'افزودن قاعده' }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
  >
    <FiPlus size={14} /> {label}
  </button>
);

/* ─── پرامپت پایه ───────────────────────────────────────────────────────── */
function BasePanel({ state, update, errors, canEdit }) {
  const [active, setActive] = useState('task');
  const [focusUid, setFocusUid] = useState(null);
  const section = BASE_PROMPT_SECTIONS.find((s) => s.key === active);
  const rules = state.base[active];
  const sectionHasError = (key) => Object.keys(errors).some((p) => p === `base.${key}` || p.startsWith(`base.${key}.`));

  const setRules = (next) => update((s) => ({ ...s, base: { ...s.base, [active]: next } }));
  const addRule = () => {
    const rule = { uid: uid(), text: '' };
    setFocusUid(rule.uid);
    setRules([...rules, rule]);
  };

  const navItem = (s) => {
    const custom = !sameAsDefault(s.key, state.base[s.key]);
    return (
      <button
        key={s.key}
        type="button"
        onClick={() => setActive(s.key)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
          active === s.key ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className="truncate">{s.title}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {sectionHasError(s.key) && <span className="w-2 h-2 rounded-full bg-red-500" title="خطا" />}
          {custom && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px]">سفارشی</span>}
          <span className="text-gray-400">{state.base[s.key].length}</span>
        </span>
      </button>
    );
  };

  const general = BASE_PROMPT_SECTIONS.filter((s) => !s.field);
  const fields = BASE_PROMPT_SECTIONS.filter((s) => s.field);

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-4">
      <aside className="a-card p-3 h-fit lg:sticky lg:top-4">
        <select
          value={active}
          onChange={(e) => setActive(e.target.value)}
          className="lg:hidden w-full px-3 py-2 text-sm font-bold rounded-lg border-2 border-gray-200 bg-white"
          aria-label="بخش پرامپت پایه"
        >
          {BASE_PROMPT_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
        </select>
        <div className="hidden lg:block space-y-0.5">
          <p className="px-3 pt-1 pb-2 text-[11px] font-bold text-gray-400">قواعد عمومی</p>
          {general.map(navItem)}
          <p className="px-3 pt-4 pb-2 text-[11px] font-bold text-gray-400">قواعد فیلدهای محصول</p>
          {fields.map(navItem)}
        </div>
      </aside>

      <section className="a-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{section.title}</h2>
            <p className="text-xs font-bold text-gray-400 mt-0.5 [direction:ltr] text-right">
              {section.field ? `${section.field}:` : section.key}
            </p>
          </div>
          {canEdit && !sameAsDefault(active, rules) && (
            <Button
              size="sm"
              variant="secondary"
              icon={<FiRotateCcw size={13} />}
              onClick={() => setRules(toRules(DEFAULT_BASE_PROMPT[active]))}
            >
              بازگردانی پیش‌فرض
            </Button>
          )}
        </div>

        {section.locked && (
          <div className="flex gap-2 items-start p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-600 leading-6">
            <FiLock className="mt-1 shrink-0" size={13} />
            <span>بخشِ داده‌محور (قفل): {section.locked}</span>
          </div>
        )}
        {active === 'task' && (
          <p className="text-xs font-bold text-gray-500 leading-6">
            قواعدی که روی همه‌ی محصولات اعمال می‌شوند. در پرامپت زیرِ «Your task:» می‌آیند.
          </p>
        )}

        <div className="space-y-3">
          {rules.map((rule, i) => (
            <RuleCard
              key={rule.uid}
              index={i}
              rule={rule}
              readOnly={!canEdit}
              autoFocus={rule.uid === focusUid}
              error={errors[`base.${active}.${i}`]}
              onChange={(text) => setRules(rules.map((r) => (r.uid === rule.uid ? { ...r, text } : r)))}
              onRemove={() => setRules(rules.filter((r) => r.uid !== rule.uid))}
            />
          ))}
          {!rules.length && (
            <p className="text-center py-6 text-sm font-bold text-gray-400">
              این بخش قاعده‌ای ندارد{section.field ? ' — اگر گروه یا دسته هم قاعده‌ای نداشته باشد «No specific rule defined.» می‌آید' : ' و از پرامپت حذف می‌شود'}.
            </p>
          )}
          {errors[`base.${active}`] && <p className="text-xs font-bold text-red-500">! {errors[`base.${active}`]}</p>}
          {canEdit && <AddRuleButton onClick={addRule} />}
        </div>
      </section>
    </div>
  );
}

/* ─── انتخابگرِ دسته‌های گروه ───────────────────────────────────────────── */
function CategoryPicker({ selected, categories, categoryById, onChange, readOnly, error }) {
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
              {cat ? cat.label : 'دسته‌ی حذف‌شده'}
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

/* ─── یک گروه ───────────────────────────────────────────────────────────── */
function GroupCard({ group, index, count, categoryById, categories, errors, canEdit, onChange, onMove, onRemove, initiallyOpen }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [openFields, setOpenFields] = useState(() => new Set());
  const [focusUid, setFocusUid] = useState(null);
  const at = `groups.${index}`;
  const groupError = Object.keys(errors).some((p) => p.startsWith(`${at}.`));
  const inGroup = new Set(group.categories);

  const setRules = (rules) => onChange({ ...group, rules });
  const patchRule = (ruleUid, patch) => setRules(group.rules.map((r) => (r.uid === ruleUid ? { ...r, ...patch } : r)));
  const addRule = (field) => {
    const rule = { uid: uid(), field, text: '', categories: [] };
    setFocusUid(rule.uid);
    setRules([...group.rules, rule]);
  };
  const toggleField = (key) =>
    setOpenFields((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const name = group.title.trim() || group.categories.map((id) => categoryById.get(id)?.label || 'دسته‌ی حذف‌شده').join('، ') || 'گروه تازه';

  return (
    <div className={`a-card overflow-hidden ${groupError ? 'ring-2 ring-red-200' : ''}`}>
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <span className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-bold">
          {index + 1}
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex-1 min-w-0 text-right">
          <span className="block truncate text-sm font-bold text-gray-900">{name}</span>
          <span className="block text-[11px] font-bold text-gray-400">
            {group.categories.length} دسته · {group.rules.length} قاعده{groupError ? ' · دارای خطا' : ''}
          </span>
        </button>
        {canEdit && (
          <>
            <button type="button" disabled={index === 0} onClick={() => onMove(-1)} title="بالاتر (زودتر در پرامپت)" className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-30"><FiArrowUp size={14} /></button>
            <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} title="پایین‌تر" className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-30"><FiArrowDown size={14} /></button>
            <button type="button" onClick={onRemove} title="حذف گروه" className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><FiTrash2 size={14} /></button>
          </>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-50" aria-label={open ? 'بستن' : 'باز کردن'}>
          {open ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
        </button>
      </div>

      {open && (
        <div className="p-4 space-y-5">
          <div className="grid md:grid-cols-[1fr_2fr] gap-4">
            <label className="block">
              <span className="block text-sm font-bold text-gray-700 mb-1.5">عنوان گروه (اختیاری)</span>
              <input
                value={group.title}
                readOnly={!canEdit}
                onChange={(e) => onChange({ ...group, title: e.target.value })}
                placeholder="مثلاً راکت‌ها"
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border-2 border-gray-200 bg-gray-50 outline-none focus:bg-white focus:border-[var(--color-primary)]"
              />
              {errors[`${at}.title`] && <p className="mt-1 text-xs font-bold text-red-500">! {errors[`${at}.title`]}</p>}
            </label>
            <div>
              <span className="block text-sm font-bold text-gray-700 mb-1.5">دسته‌های این گروه</span>
              <CategoryPicker
                selected={group.categories}
                categories={categories}
                categoryById={categoryById}
                readOnly={!canEdit}
                error={errors[`${at}.categories`]}
                onChange={(next) => onChange({ ...group, categories: next })}
              />
            </div>
          </div>

          {!group.categories.length ? (
            <p className="p-4 rounded-xl bg-gray-50 text-center text-sm font-bold text-gray-400">
              ابتدا دسته‌های گروه را انتخاب کنید تا فیلدهای محصول نمایش داده شوند.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 leading-6">
                هر قاعده بدونِ انتخابِ دسته روی همه‌ی دسته‌های این گروه اعمال می‌شود؛ با انتخابِ دسته فقط روی همان‌ها.
              </p>
              {GROUP_PROMPT_FIELDS.map((f) => {
                const fieldRules = group.rules.map((r, i) => ({ r, i })).filter(({ r }) => r.field === f.key);
                const fieldError = fieldRules.some(({ i }) => errors[`${at}.rules.${i}`]);
                const isOpen = openFields.has(f.key) || fieldError;
                return (
                  <div key={f.key} className={`rounded-xl border ${fieldError ? 'border-red-200' : 'border-gray-100'}`}>
                    <button type="button" onClick={() => toggleField(f.key)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-gray-800">{f.title}</span>
                        <span className="text-[11px] font-bold text-gray-400 [direction:ltr]">{f.key}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs font-bold text-gray-400">
                        {fieldRules.length > 0 && <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">{fieldRules.length} قاعده</span>}
                        {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-3">
                        {fieldRules.map(({ r, i }, n) => {
                          const stale = r.categories.filter((id) => !inGroup.has(id));
                          const disabled = r.categories.length > 0 && r.categories.every((id) => !categoryById.has(id));
                          return (
                            <RuleCard
                              key={r.uid}
                              index={n}
                              rule={r}
                              readOnly={!canEdit}
                              autoFocus={r.uid === focusUid}
                              error={errors[`${at}.rules.${i}`]}
                              onChange={(text) => patchRule(r.uid, { text })}
                              onRemove={() => setRules(group.rules.filter((x) => x.uid !== r.uid))}
                            >
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-bold text-gray-400">اعمال روی:</span>
                                {group.categories.map((id) => {
                                  const on = r.categories.includes(id);
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      disabled={!canEdit}
                                      onClick={() => patchRule(r.uid, { categories: on ? r.categories.filter((x) => x !== id) : [...r.categories, id] })}
                                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                                        on ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white text-gray-500 border-gray-200 hover:border-[var(--color-primary)]'
                                      }`}
                                    >
                                      {categoryById.get(id)?.label || 'دسته‌ی حذف‌شده'}
                                    </button>
                                  );
                                })}
                                {stale.map((id) => (
                                  <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200">
                                    {categoryById.get(id)?.label || 'دسته‌ی حذف‌شده'} (خارج از گروه)
                                    {canEdit && (
                                      <button type="button" aria-label="برداشتن" onClick={() => patchRule(r.uid, { categories: r.categories.filter((x) => x !== id) })}>
                                        <FiX size={11} />
                                      </button>
                                    )}
                                  </span>
                                ))}
                                {!r.categories.length && <span className="text-[11px] font-bold text-[var(--color-primary)]">همه‌ی دسته‌های گروه</span>}
                              </div>
                              {disabled && (
                                <p className="mt-1 text-xs font-bold text-amber-600">این قاعده غیرفعال است: همه‌ی دسته‌های هدفش حذف شده‌اند و روی هیچ محصولی اعمال نمی‌شود.</p>
                              )}
                            </RuleCard>
                          );
                        })}
                        {canEdit && <AddRuleButton onClick={() => addRule(f.key)} label={`افزودن قاعده برای ${f.title}`} />}
                        {!canEdit && !fieldRules.length && <p className="text-xs font-bold text-gray-400">قاعده‌ای ندارد.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupsPanel({ state, update, errors, canEdit, categories, categoryById }) {
  const [created, setCreated] = useState(null);
  const setGroups = (groups) => update((s) => ({ ...s, groups }));
  const create = () => {
    const group = { uid: uid(), title: '', categories: [], rules: [] };
    setCreated(group.uid);
    setGroups([...state.groups, group]);
  };
  const move = (i, dir) => {
    const next = [...state.groups];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setGroups(next);
  };
  const remove = async (i) => {
    const { isConfirmed } = await Swal.fire({
      ...swalTheme,
      title: 'حذف گروه؟',
      text: 'همه‌ی قواعدِ این گروه هم حذف می‌شوند (پس از ذخیره).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'حذف',
      cancelButtonText: 'لغو',
    });
    if (isConfirmed) setGroups(state.groups.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-gray-500 leading-6 max-w-3xl">
          قواعدِ گروه بعد از پرامپت پایه و پیش از پرامپتِ خودِ دسته می‌آیند. یک دسته می‌تواند عضوِ چند گروه باشد؛
          ترتیبِ گروه‌ها ترتیبِ قواعدشان در پرامپت است.
        </p>
        {canEdit && (
          <Button icon={<FiPlus size={15} />} onClick={create}>ایجاد گروه پرامپت دسته</Button>
        )}
      </div>
      {state.groups.map((group, i) => (
        <GroupCard
          key={group.uid}
          group={group}
          index={i}
          count={state.groups.length}
          categories={categories}
          categoryById={categoryById}
          errors={errors}
          canEdit={canEdit}
          initiallyOpen={group.uid === created}
          onChange={(g) => setGroups(state.groups.map((x) => (x.uid === group.uid ? g : x)))}
          onMove={(dir) => move(i, dir)}
          onRemove={() => remove(i)}
        />
      ))}
      {!state.groups.length && (
        <div className="a-card py-14 text-center">
          <FiLayers className="mx-auto mb-3 text-gray-300" size={26} />
          <p className="text-sm font-bold text-gray-400">هنوز گروهی ساخته نشده است.</p>
        </div>
      )}
    </div>
  );
}

/* ─── پیش‌نمایش ─────────────────────────────────────────────────────────── */
function PreviewPanel({ categories, dirty, canPreview }) {
  const [categoryId, setCategoryId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  if (!canPreview) {
    return <div className="a-card p-6 text-sm font-bold text-gray-400">برای پیش‌نمایش، دسترسی «تولید پیش‌نویس محصول با AI» لازم است.</div>;
  }

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/product-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, rawContent: PREVIEW_RAW_CONTENT }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(data, 'خطا در ساخت پیش‌نمایش'));
      setPrompt(data.draft);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="a-card p-5 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[220px]">
          <span className="block text-sm font-bold text-gray-700 mb-1.5">دسته</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border-2 border-gray-200 bg-white"
          >
            <option value="">یک دسته را انتخاب کنید</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.label}</option>)}
          </select>
        </label>
        <Button icon={<FiEye size={15} />} disabled={!categoryId} loading={loading} onClick={run}>ساخت پرامپت نهایی</Button>
      </div>
      <p className={`text-xs font-bold leading-6 ${dirty ? 'text-amber-600' : 'text-gray-400'}`}>
        پیش‌نمایش از آخرین نسخه‌ی <b>ذخیره‌شده</b> ساخته می‌شود{dirty ? ' — تغییرات ذخیره‌نشده در آن نیستند.' : '.'} متن خامِ محصول یک متنِ نمونه است.
      </p>
      {prompt && (
        <pre className="text-xs leading-6 bg-gray-50 border rounded-xl p-4 max-h-[70vh] overflow-auto whitespace-pre-wrap text-left [direction:ltr]">
          {prompt}
        </pre>
      )}
    </div>
  );
}

/* ─── صفحه ──────────────────────────────────────────────────────────────── */
export default function PromptSettingsPage() {
  const { can } = useAdminPermissions();
  const canEdit = can('productPrompts.edit');

  const [tab, setTab] = useState('base');
  const [state, setState] = useState(null);
  const [savedPayload, setSavedPayload] = useState('');
  const [storedIds, setStoredIds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const accept = (config) => {
    const next = fromServer(config);
    setState(next);
    setSavedPayload(JSON.stringify(toPayload(next)));
    setStoredIds(config.groups.flatMap((g) => g.categories));
    setServerErrors({});
  };

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/product-prompts')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(getApiErrorMessage(data, 'خطا در دریافت تنظیمات پرامپت'));
        if (!alive) return;
        setCategories(
          data.categories
            .map((c) => ({ ...c, label: getCategoryLabel(c) }))
            .sort((a, b) => a.label.localeCompare(b.label, 'fa')),
        );
        accept(data.config);
      })
      .catch((err) => alive && setLoadError(err.message));
    return () => { alive = false; };
  }, []);

  const payload = state ? toPayload(state) : null;
  const dirty = !!state && JSON.stringify(payload) !== savedPayload;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (loadError) {
    return <div className="a-card p-8 text-center text-sm font-bold text-red-500">{loadError}</div>;
  }
  if (!state) return <AdminLoader />;

  const categoryById = new Map(categories.map((c) => [c._id, c]));
  const knownCategoryIds = new Set([...categories.map((c) => c._id), ...storedIds]);
  const clientErrors = Object.fromEntries(
    validatePromptConfig(payload, { knownCategoryIds }).errors.map(({ path, message }) => [path, message]).reverse(),
  );
  const errors = { ...serverErrors, ...clientErrors };
  const errorCount = Object.keys(clientErrors).length;

  const update = (fn) => {
    setServerErrors({});
    setState(fn);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/product-prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, updatedAt: state.updatedAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const { isConfirmed } = await Swal.fire({
          ...swalTheme,
          icon: 'warning',
          title: 'تنظیمات تغییر کرده است',
          text: `${data.error || ''} با بارگذاریِ دوباره، تغییراتِ ذخیره‌نشده‌ی شما از بین می‌رود.`,
          showCancelButton: true,
          confirmButtonText: 'بارگذاری دوباره',
          cancelButtonText: 'ماندن در صفحه',
        });
        if (isConfirmed) window.location.reload();
        return;
      }
      if (!res.ok) {
        setServerErrors(data.fieldErrors || {});
        throw new Error(getApiErrorMessage({ error: data.error }, 'خطا در ذخیره'));
      }
      accept(data.config);
      toast.success('تنظیمات پرامپت ذخیره شد');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-5 pb-10">
      <PageHeader
        title="تنظیمات پرامپت محصول"
        subtitle="پرامپت پایه و گروه‌های پرامپت دسته برای ساخت پیش‌نویس محصول با AI"
        icon={<FiSliders size={18} />}
        actions={
          <>
            <Link href="/p-admin/admin-sports" className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-500 hover:text-[var(--color-primary)]">
              <FiArrowRight size={14} /> ورزش‌ها
            </Link>
            {canEdit && (
              <Button icon={<FiSave size={15} />} loading={saving} disabled={!dirty || errorCount > 0} onClick={save}>
                ذخیره{dirty ? ' تغییرات' : ''}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'base', label: 'پرامپت پایه', icon: FiSliders },
            { value: 'groups', label: 'گروه‌های پرامپت دسته', icon: FiLayers, badge: state.groups.length },
            { value: 'preview', label: 'پیش‌نمایش پرامپت نهایی', icon: FiEye },
          ]}
        />
        {errorCount > 0 && (
          <span className="text-xs font-bold text-red-500">{errorCount} خطا — پیش از ذخیره برطرف کنید</span>
        )}
      </div>

      {tab === 'base' && (
        <>
          <div className="flex gap-2 items-start p-3 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-500 leading-6">
            <FiLock className="mt-1 shrink-0" size={13} />
            <span>
              بخش‌های داده‌محورِ پرامپت قابل ویرایش نیستند و همیشه از داده ساخته می‌شوند: شناسه‌ی ورزش و دسته، تعریف دسته
              (ویژگی‌ها، ویژگی‌های متغیر، آمار فنی، تب سفارشی)، فهرستِ برندها، ورزشکاران، سری‌ها و لیمیتد ادیشن‌ها، متنِ خامِ محصول،
              ساختارِ JSON خروجی و یادداشتِ ترتیبِ قواعد (پایه ← گروه ← دسته).
            </span>
          </div>
          <BasePanel state={state} update={update} errors={errors} canEdit={canEdit} />
        </>
      )}
      {tab === 'groups' && (
        <GroupsPanel state={state} update={update} errors={errors} canEdit={canEdit} categories={categories} categoryById={categoryById} />
      )}
      {tab === 'preview' && <PreviewPanel categories={categories} dirty={dirty} canPreview={can('ai.productDraft')} />}
    </div>
  );
}
