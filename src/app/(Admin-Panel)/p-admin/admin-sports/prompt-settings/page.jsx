'use client';

/**
 * «تنظیمات پرامپت» — نمای کلی: کارتِ پرامپت پایه، فهرستِ گروه‌های پرامپت دسته و
 * پیش‌نمایشِ پرامپتِ نهایی. ویرایشِ قواعد در صفحه‌ی خودِ هر کدام است:
 *   ./base             پرامپت پایه
 *   ./groups/[groupId] یک گروه («new» برای ساخت)
 * جابه‌جایی و حذفِ گروه همین‌جا و فوراً ذخیره می‌شود (فقط `groups` فرستاده می‌شود).
 */

import { useState } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import {
  FiArrowDown, FiArrowLeft, FiArrowRight, FiArrowUp, FiEye, FiLayers, FiLock, FiPlus, FiSliders, FiTrash2,
} from 'react-icons/fi';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import { getApiErrorMessage } from '@/lib/apiClientError';
import {
  PROMPTS_HOME, categoryName, storedGroupPayload, swalTheme, usePromptConfig,
} from '@/components/admin/productPrompts/promptSettingsUi';
import {
  BASE_PROMPT_SECTIONS, DEFAULT_BASE_PROMPT, fieldTitle, isLegacyGroupField, resolveBasePrompt,
} from '@/lib/productPromptConfig';

const PREVIEW_RAW_CONTENT =
  'Sample product content for previewing the assembled prompt. Replace this with real product text when generating a product.';

export default function PromptSettingsPage() {
  const { can } = useAdminPermissions();
  const canEdit = can('productPrompts.edit');
  const ctx = usePromptConfig();
  const [busy, setBusy] = useState(false);

  if (ctx.loadError) return <div className="a-card p-8 text-center text-sm font-bold text-red-500">{ctx.loadError}</div>;
  if (!ctx.config) return <AdminLoader />;

  const { config, categories, categoryById, save } = ctx;
  const base = resolveBasePrompt(config.base);
  const customSections = BASE_PROMPT_SECTIONS.filter(
    ({ key }) => JSON.stringify(base[key]) !== JSON.stringify(DEFAULT_BASE_PROMPT[key]),
  );
  const totalBaseRules = Object.values(base).reduce((n, rules) => n + rules.length, 0);

  const saveGroups = async (groups, message) => {
    setBusy(true);
    await save({ groups: groups.map(storedGroupPayload) }, message);
    setBusy(false);
  };
  const move = (i, dir) => {
    const next = [...config.groups];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    saveGroups(next, 'ترتیبِ گروه‌ها ذخیره شد');
  };
  const remove = async (group, label) => {
    const { isConfirmed } = await Swal.fire({
      ...swalTheme,
      icon: 'warning',
      title: 'حذف گروه؟',
      text: `گروه «${label}» و ${group.rules.length} قاعده‌ی آن حذف می‌شوند.`,
      showCancelButton: true,
      confirmButtonText: 'حذف گروه',
      cancelButtonText: 'لغو',
    });
    if (isConfirmed) saveGroups(config.groups.filter((g) => g._id !== group._id), 'گروه حذف شد');
  };

  return (
    <div dir="rtl" className="space-y-6 pb-10">
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
              <Link
                href={`${PROMPTS_HOME}/groups/new`}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-[var(--admin-radius)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors"
              >
                <FiPlus size={15} /> ایجاد گروه جدید
              </Link>
            )}
          </>
        }
      />

      {/* پرامپت پایه */}
      <section className="a-card p-5 flex flex-col md:flex-row md:items-center gap-4">
        <span className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <FiSliders size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-gray-900">پرامپت پایه</h2>
          <p className="text-xs font-bold text-gray-500 mt-1 leading-6">
            قواعدِ مشترکِ همه‌ی محصولات: نقش، قواعد کلی، قالب خروجی، زبان و قواعدِ هر فیلد — {BASE_PROMPT_SECTIONS.length} بخش، {totalBaseRules} قاعده.
            {' '}
            {customSections.length
              ? <span className="text-amber-700">{customSections.length} بخش سفارشی شده است ({customSections.map((s) => s.title).join('، ')}).</span>
              : 'همه‌ی بخش‌ها روی پیش‌فرض‌اند.'}
          </p>
        </div>
        <Link
          href={`${PROMPTS_HOME}/base`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-white text-gray-800 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
        >
          {canEdit ? 'ویرایش پرامپت پایه' : 'مشاهده‌ی پرامپت پایه'} <FiArrowLeft size={14} />
        </Link>
      </section>

      {/* گروه‌ها */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900">گروه‌های پرامپت دسته ({config.groups.length})</h2>
            <p className="text-xs font-bold text-gray-500 mt-1 leading-6">
              قواعدِ گروه بعد از پرامپت پایه و پیش از پرامپتِ خودِ دسته می‌آیند؛ یک دسته می‌تواند عضوِ چند گروه باشد و ترتیبِ گروه‌ها ترتیبِ قواعدشان در پرامپت است.
            </p>
          </div>
        </div>

        {config.groups.map((group, i) => {
          const label = group.title || group.categories.map((id) => categoryName(categoryById, id)).join('، ');
          const deleted = group.categories.filter((id) => !categoryById.has(id)).length;
          const disabled = group.rules.filter((r) => r.categories.length && r.categories.every((id) => !categoryById.has(id))).length;
          const legacy = group.rules.filter((r) => isLegacyGroupField(r.field)).length;
          const perField = Object.entries(
            group.rules.reduce((acc, r) => ({ ...acc, [r.field]: (acc[r.field] || 0) + 1 }), {}),
          );
          return (
            <article key={group._id} className="a-card p-4 flex flex-col md:flex-row md:items-center gap-3">
              <span className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-bold">{i + 1}</span>
              <div className="flex-1 min-w-0 space-y-1.5">
                <Link href={`${PROMPTS_HOME}/groups/${group._id}`} className="block truncate text-sm font-bold text-gray-900 hover:text-[var(--color-primary)]">
                  {label}
                </Link>
                <div className="flex flex-wrap gap-1">
                  {group.categories.slice(0, 6).map((id) => (
                    <span key={id} className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${categoryById.has(id) ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-600'}`}>
                      {categoryName(categoryById, id)}
                    </span>
                  ))}
                  {group.categories.length > 6 && <span className="px-2 py-0.5 text-[11px] font-bold text-gray-400">+{group.categories.length - 6}</span>}
                </div>
                <p className="text-[11px] font-bold text-gray-400">
                  {group.rules.length
                    ? `${group.rules.length} قاعده — ${perField.map(([f, n]) => `${fieldTitle(f)}: ${n}`).join('، ')}`
                    : 'هنوز قاعده‌ای ندارد'}
                </p>
                {(deleted > 0 || disabled > 0 || legacy > 0) && (
                  <p className="text-[11px] font-bold text-amber-600">
                    {[deleted && `${deleted} دسته‌ی حذف‌شده`, disabled && `${disabled} قاعده‌ی غیرفعال`, legacy && `${legacy} قاعده برای فیلدهای دیگر (قدیمی)`].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 self-end md:self-center">
                {canEdit && (
                  <>
                    <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} title="بالاتر (زودتر در پرامپت)" aria-label="بالاتر" className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-30"><FiArrowUp size={14} /></button>
                    <button type="button" disabled={busy || i === config.groups.length - 1} onClick={() => move(i, 1)} title="پایین‌تر" aria-label="پایین‌تر" className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-30"><FiArrowDown size={14} /></button>
                    <button type="button" disabled={busy} onClick={() => remove(group, label)} title="حذف گروه" aria-label="حذف گروه" className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30"><FiTrash2 size={14} /></button>
                  </>
                )}
                <Link
                  href={`${PROMPTS_HOME}/groups/${group._id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-[var(--admin-radius)] border border-[var(--admin-border)] text-gray-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  {canEdit ? 'ویرایش قواعد' : 'مشاهده'} <FiArrowLeft size={13} />
                </Link>
              </div>
            </article>
          );
        })}

        {!config.groups.length && (
          <div className="a-card py-12 text-center space-y-3">
            <FiLayers className="mx-auto text-gray-300" size={26} />
            <p className="text-sm font-bold text-gray-400">هنوز گروهی ساخته نشده است.</p>
            {canEdit && (
              <Link href={`${PROMPTS_HOME}/groups/new`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)]">
                <FiPlus size={13} /> ایجاد گروه جدید
              </Link>
            )}
          </div>
        )}
      </section>

      <PreviewPanel categories={categories} canPreview={can('ai.productDraft')} />

      <div className="flex gap-2 items-start p-3 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-500 leading-6">
        <FiLock className="mt-1 shrink-0" size={13} />
        <span>
          ترتیبِ هر فیلد در پرامپتِ نهایی: پرامپت پایه ← گروه‌ها (به ترتیبِ بالا) ← پرامپتِ خودِ دسته؛ در تعارض، قاعده‌ی خاص‌تر برنده است.
          بخش‌های داده‌محور (شناسه‌ها، فهرست‌ها، تعریف دسته و ساختارِ خروجی) همیشه از داده ساخته می‌شوند.
        </span>
      </div>
    </div>
  );
}

/* ─── پیش‌نمایش ─────────────────────────────────────────────────────────── */
function PreviewPanel({ categories, canPreview }) {
  const [categoryId, setCategoryId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

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
    <section className="a-card p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><FiEye size={16} /> پیش‌نمایش پرامپت نهایی</h2>
        <p className="text-xs font-bold text-gray-500 mt-1 leading-6">پرامپتِ ساختِ محصول را برای یک دسته از آخرین تنظیماتِ ذخیره‌شده می‌سازد؛ متنِ خامِ محصول یک متنِ نمونه است.</p>
      </div>
      {!canPreview ? (
        <p className="text-sm font-bold text-gray-400">برای پیش‌نمایش، دسترسی «تولید پیش‌نویس محصول با AI» لازم است.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-[220px]">
              <span className="block text-sm font-bold text-gray-700 mb-1.5">دسته</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border-2 border-gray-200 bg-white">
                <option value="">یک دسته را انتخاب کنید</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.label}</option>)}
              </select>
            </label>
            <Button icon={<FiEye size={15} />} disabled={!categoryId} loading={loading} onClick={run}>ساخت پرامپت نهایی</Button>
          </div>
          {prompt && (
            <pre className="text-xs leading-6 bg-gray-50 border rounded-xl p-4 max-h-[70vh] overflow-auto whitespace-pre-wrap text-left [direction:ltr]">{prompt}</pre>
          )}
        </>
      )}
    </section>
  );
}
