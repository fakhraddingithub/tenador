'use client';

/**
 * «پیش‌نمایش پرامپت نهایی» برای یک دسته — قواعدِ پرامپتِ ساختِ محصول، فیلد به فیلد.
 *
 * داده از GET /api/admin/product-prompts/preview می‌آید که همان composeProductPrompt
 * را صدا می‌زند که پرامپتِ واقعی از آن رندر می‌شود؛ پس هر قاعده‌ای که اینجا دیده
 * می‌شود دقیقاً همان است که به AI می‌رسد، با منبعِ دقیقش. فهرست‌های داده (برند، سری،
 * ورزشکار…) و متنِ خامِ محصول باز نمی‌شوند و به‌صورتِ placeholder می‌مانند؛ متنِ کامل در حالتِ «پرامپت نهایی» است.
 *
 * کلیک روی هر قاعده منبعش را نشان می‌دهد و (با دسترسیِ ویرایش) همان منبع را ویرایش می‌کند:
 *   پایه / گروه → همان PUTِ تنظیمات (۴۰۹ و بررسیِ تکرار همان‌جا)
 *   متعلق به دسته → PATCH …/category-rule (compare-and-set روی همان یک متن)
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { FiArrowRight, FiChevronLeft, FiEdit3, FiEye, FiExternalLink, FiX } from 'react-icons/fi';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import { getApiErrorMessage } from '@/lib/apiClientError';
import {
  PROMPTS_API, PROMPTS_HOME, categoryName, storedGroupPayload, textareaClass, usePromptConfig,
} from '@/components/admin/productPrompts/promptSettingsUi';
import { fieldTitle } from '@/lib/productPromptConfig';

/* ─── منبع‌ها ─────────────────────────────────────────────────────────────── */

const TONES = {
  base: { label: 'پرامپت پایه', rule: 'border-sky-400 bg-sky-50/70 hover:bg-sky-50', chip: 'bg-sky-100 text-sky-800', dot: 'bg-sky-400' },
  group: { label: 'گروه پرامپت دسته', rule: 'border-violet-400 bg-violet-50/70 hover:bg-violet-50', chip: 'bg-violet-100 text-violet-800', dot: 'bg-violet-400' },
  category: { label: 'اختصاصیِ دسته', rule: 'border-amber-400 bg-amber-50/70 hover:bg-amber-50', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-400' },
};
const toneOf = (kind) => {
  if (kind === 'section' || kind === 'baseField') return 'base';
  if (kind === 'group' || kind === 'groupSection') return 'group';
  return 'category';
};

const sourceId = (s) => [s.kind, s.sectionKey, s.index, s.groupId, s.field, s.name, s.itemId].join('|');

/** همه‌ی قاعده‌های مدل، به ترتیبِ پرامپت. */
function allRules(model) {
  const { sections, fields, attributes, variants, technicalStats, customTab } = model;
  return [
    ...sections.flatMap((s) => (s.kind === 'fields' ? [] : s.rules)),
    ...fields.flatMap((f) => [...f.rules.base, ...f.rules.groups, ...(f.rules.category ? [f.rules.category] : [])]),
    ...[...attributes, ...variants, ...technicalStats, ...customTab.items].flatMap((entry) => entry.rules),
  ];
}

async function fetchPreview(categoryId) {
  const res = await fetch(`${PROMPTS_API}/preview?categoryId=${encodeURIComponent(categoryId)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(getApiErrorMessage(json, 'خطا در ساخت پیش‌نمایش'));
  return json;
}

/* ─── صفحه ───────────────────────────────────────────────────────────────── */

export default function PromptPreviewPage() {
  const router = useRouter();
  const { can } = useAdminPermissions();
  const canEdit = can('productPrompts.edit');
  const ctx = usePromptConfig();
  // دسته از آدرس (?category=…) تا پیوند و بارگذاریِ دوباره همان دسته را نشان دهند.
  // روی سرور '' است؛ تا تنظیمات بارگذاری نشده هر دو طرف فقط لودر رندر می‌کنند.
  const [categoryId, setCategoryId] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('category') || '',
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [openId, setOpenId] = useState(null);
  // حالتِ «پرامپت نهایی»: متنِ خامِ پرامپت. پیش‌فرض خاموش؛ پیش‌نمایشِ قواعد mount می‌ماند
  // تا فیلتر و ویرایشِ نیمه‌کاره با رفت‌وبرگشت از بین نرود.
  const [finalMode, setFinalMode] = useState(false);
  const [finalPrompt, setFinalPrompt] = useState(null);
  const [finalError, setFinalError] = useState('');
  const finalRequest = useRef(0);

  // هر بار از نو ساخته می‌شود تا ویرایش‌های تازه را نشان دهد؛ پاسخِ درخواستِ کهنه
  // (مثلاً پس از عوض شدنِ دسته) نادیده گرفته می‌شود.
  const loadFinal = async (id) => {
    const request = ++finalRequest.current;
    setFinalPrompt(null);
    setFinalError('');
    try {
      const res = await fetch(`${PROMPTS_API}/final-prompt?categoryId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(json, 'خطا در ساخت پرامپت نهایی'));
      if (request === finalRequest.current) setFinalPrompt(json.prompt);
    } catch (err) {
      if (request === finalRequest.current) setFinalError(err.message);
    }
  };
  const toggleFinal = () => {
    const next = !finalMode;
    setFinalMode(next);
    if (next && categoryId) loadFinal(categoryId);
  };

  const load = async (id) => {
    setLoading(true);
    setLoadError('');
    try {
      const json = await fetchPreview(id);
      setData(json);
      return json;
    } catch (err) {
      setLoadError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // فقط دسته‌ی آدرس در اولین mount؛ انتخاب‌های بعدی خودشان load می‌کنند
  useEffect(() => {
    if (!categoryId) return;
    let alive = true;
    fetchPreview(categoryId)
      .then((json) => alive && setData(json))
      .catch((err) => alive && setLoadError(err.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (id) => {
    setCategoryId(id);
    setOpenId(null);
    setData(null);
    router.replace(id ? `${PROMPTS_HOME}/preview?category=${id}` : `${PROMPTS_HOME}/preview`, { scroll: false });
    if (id) load(id);
    if (id && finalMode) loadFinal(id);
  };

  if (ctx.loadError) return <div className="a-card p-8 text-center text-sm font-bold text-red-500">{ctx.loadError}</div>;
  if (!ctx.config) return <AdminLoader />;

  const groupLabel = (groupId, fallback) => {
    const g = ctx.config.groups.find((x) => x._id === groupId);
    if (!g) return fallback || 'گروهِ حذف‌شده';
    return g.title || g.categories.map((id) => categoryName(ctx.categoryById, id)).join('، ');
  };
  const categoryLabel = data ? `${data.category.title} (${data.category.sport.title || data.category.sport.name})` : '';
  const categoryHref = data ? `/p-admin/admin-categories/edit/${data.category._id}` : '';

  /** منبعِ یک قاعده، به زبانِ صفحه‌های تنظیمات. */
  const describe = (s) => {
    const cat = `دسته‌ی «${categoryLabel}»`;
    switch (s.kind) {
      case 'section':
        return { path: ['پرامپت پایه', `بخش «${s.sectionName}»`, `قاعده‌ی ${s.index + 1}`], href: `${PROMPTS_HOME}/base#${encodeURIComponent(`section:${s.sectionKey}`)}`, editable: true };
      case 'baseField':
        return { path: ['پرامپت پایه', `فیلد ${fieldTitle(s.field)}`, `قاعده‌ی ${s.index + 1}`], href: `${PROMPTS_HOME}/base#${encodeURIComponent(`field:${s.field}`)}`, editable: true };
      case 'group':
      case 'groupSection': {
        const order = ctx.config.groups.findIndex((g) => g._id === s.groupId);
        const targets = s.targets.length
          ? `فقط برای این دسته‌ها: ${s.targets.map((id) => categoryName(ctx.categoryById, id)).join('، ')}`
          : 'برای همه‌ی دسته‌های این گروه';
        const place = s.kind === 'group' ? `فیلد ${fieldTitle(s.field)}` : `بخش «${s.sectionName}»`;
        const tab = s.kind === 'group' ? s.field : `section:${s.sectionKey}`;
        return {
          path: ['گروه پرامپت دسته', `«${groupLabel(s.groupId, s.groupTitle)}»`, place, `قاعده‌ی ${s.index + 1}`],
          note: `${targets}.${order >= 0 ? ` این گروه ${order + 1}‌اُمین گروه در ترتیبِ گروه‌هاست.` : ''}`,
          href: s.groupId ? `${PROMPTS_HOME}/groups/${s.groupId}#${encodeURIComponent(tab)}` : '',
          editable: Boolean(s.groupId),
        };
      }
      case 'categoryField':
        return { path: [cat, 'تنظیمات هوش مصنوعی', `دستورالعمل ${s.field}`], href: categoryHref, editable: true };
      case 'technicalStats':
        return { path: [cat, 'شاخص‌های فنی', 'راهنمای هوش مصنوعی'], href: categoryHref, editable: true };
      case 'attribute':
        return { path: [cat, 'ویژگی‌های ثابت', `«${s.label}» (${s.name})`, 'پرامپت ویژگی'], href: categoryHref, editable: true };
      case 'variantAttribute':
        return { path: [cat, 'ویژگی‌های متغیر', `«${s.label}» (${s.name})`, 'پرامپت ویژگی'], href: categoryHref, editable: true };
      case 'customTab':
        return { path: [cat, `تب سفارشی «${s.tabName}»`, 'قاعده‌ی انتخاب آیتم‌ها'], href: categoryHref, editable: true };
      case 'customTabItem':
        return { path: [cat, 'تب سفارشی', `آیتم «${s.title}»`, 'راهنمای انتخاب'], href: categoryHref, editable: Boolean(s.itemId) };
      default:
        return { path: [cat], editable: false };
    }
  };

  /** ذخیره‌ی یک قاعده در منبعِ خودش. خطا → پیامِ خطا؛ موفق → null. */
  const saveRule = async (rule, rawText) => {
    const s = rule.source;
    // متن همان‌طور که نوشته شده ذخیره می‌شود
    const text = rawText;
    const stale = 'این قاعده در این فاصله تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.';
    const replaceAt = (list, index, value) => list.map((item, i) => (i === index ? value : item));

    if (toneOf(s.kind) !== 'category') {
      if (!text.trim()) return 'متن قاعده خالی است؛ برای حذفِ قاعده از صفحه‌ی تنظیماتِ آن استفاده کنید.';
      const { document, fieldRules } = ctx.config;
      const groups = ctx.config.groups.map(storedGroupPayload);
      const gi = groups.findIndex((g) => g._id === s.groupId);
      let payload;
      let errorPath;
      if (s.kind === 'section') {
        const section = document.find((x) => x.key === s.sectionKey);
        if (section?.rules[s.index] !== s.value) return stale;
        payload = { document: document.map((x) => (x === section ? { ...x, rules: replaceAt(x.rules, s.index, text) } : x)) };
        errorPath = `document.${s.sectionKey}.rules.${s.index}`;
      } else if (s.kind === 'baseField') {
        const entry = fieldRules.find((x) => x.field === s.field);
        if (entry?.rules[s.index] !== s.value) return stale;
        payload = { fieldRules: fieldRules.map((x) => (x === entry ? { ...x, rules: replaceAt(x.rules, s.index, text) } : x)) };
        errorPath = `fieldRules.${s.field}.${s.index}`;
      } else if (s.kind === 'group') {
        if (gi < 0 || groups[gi].rules[s.index]?.text !== s.value) return stale;
        groups[gi] = { ...groups[gi], rules: replaceAt(groups[gi].rules, s.index, { ...groups[gi].rules[s.index], text }) };
        payload = { groups };
        errorPath = `groups.${gi}.rules.${s.index}`;
      } else {
        const si = gi < 0 ? -1 : groups[gi].sections.findIndex((x) => x.key === s.sectionKey);
        const section = si < 0 ? null : groups[gi].sections[si];
        if (section?.rules[s.index]?.text !== s.value) return stale;
        groups[gi] = {
          ...groups[gi],
          sections: replaceAt(groups[gi].sections, si, { ...section, rules: replaceAt(section.rules, s.index, { ...section.rules[s.index], text }) }),
        };
        payload = { groups };
        errorPath = `groups.${gi}.sections.${si}.rules.${s.index}`;
      }
      const result = await ctx.save(payload, 'قاعده ذخیره شد');
      if (!result.ok) return result.fieldErrors?.[errorPath] || Object.values(result.fieldErrors || {})[0] || 'ذخیره نشد';
    } else {
      const res = await fetch(`${PROMPTS_API}/category-rule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: data.category._id,
          source: { kind: s.kind, field: s.field, name: s.name, itemId: s.itemId },
          previous: s.value,
          text,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // نسخه‌ی تازه را بیاور تا تلاشِ بعدی روی متنِ واقعیِ فعلی باشد
        if (res.status === 409) load(data.category._id);
        return getApiErrorMessage(json, 'خطا در ذخیره');
      }
      toast.success('قاعده ذخیره شد');
    }

    const fresh = await load(data.category._id);
    if (fresh && !allRules(fresh.model).some((r) => sourceId(r.source) === sourceId(s))) {
      toast.info('ذخیره شد، اما این قاعده اکنون در پرامپت نهایی نمی‌آید (خالی است یا تکرارِ قاعده‌ای پیش از آن است).');
    }
    return null;
  };

  const ruleProps = { openId, setOpenId, describe, canEdit, onSave: saveRule };

  return (
    <div dir="rtl" className="space-y-5 pb-16">
      <PageHeader
        title="پیش‌نمایش پرامپت نهایی"
        subtitle="قواعدی که برای ساختِ محصولِ یک دسته به هوش مصنوعی می‌رسد، فیلد به فیلد و با منبعِ هر قاعده"
        icon={<FiEye size={18} />}
        actions={
          <Link href={PROMPTS_HOME} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-500 hover:text-[var(--color-primary)]">
            <FiArrowRight size={14} /> تنظیمات پرامپت
          </Link>
        }
      />

      <section className="a-card p-4 flex flex-col lg:flex-row lg:items-end gap-4">
        <label className="flex-1 min-w-[220px] max-w-md">
          <span className="block text-sm font-bold text-gray-700 mb-1.5">دسته</span>
          <select
            value={categoryId}
            onChange={(e) => choose(e.target.value)}
            className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border-2 border-gray-200 bg-white focus:border-[var(--color-primary)] outline-none"
          >
            <option value="">یک دسته را انتخاب کنید</option>
            {ctx.categories.map((c) => <option key={c._id} value={c._id}>{c.label}</option>)}
          </select>
        </label>
        {categoryId && (
          <div className="flex items-center gap-2.5 lg:mr-auto lg:pb-2.5">
            <button
              type="button"
              id="final-prompt-toggle"
              role="switch"
              aria-checked={finalMode}
              onClick={toggleFinal}
              className="relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              style={{ background: finalMode ? 'var(--color-primary)' : 'var(--admin-border)' }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                style={{ left: finalMode ? 'calc(100% - 1.1rem)' : '2px' }}
              />
            </button>
            <label htmlFor="final-prompt-toggle" className="cursor-pointer text-sm font-bold text-gray-700">پرامپت نهایی (متن خام)</label>
          </div>
        )}
      </section>

      {!categoryId ? (
        <p className="a-card p-10 text-center text-sm font-bold text-gray-400">یک دسته را انتخاب کنید تا پرامپتِ نهاییِ آن نمایش داده شود.</p>
      ) : (
        <>
          {finalMode && (
            finalError ? (
              <div className="a-card p-8 text-center space-y-3">
                <p className="text-sm font-bold text-red-500">{finalError}</p>
                <Button variant="secondary" size="sm" onClick={() => loadFinal(categoryId)}>تلاش دوباره</Button>
              </div>
            ) : finalPrompt === null ? (
              <AdminLoader />
            ) : (
              // plaintext: جهتِ هر خط از متنِ همان خط؛ dir کافی نیست چون direction روی * در globals.css قوی‌تر است
              <pre className="m-0 p-4 bg-white text-black text-start [unicode-bidi:plaintext] whitespace-pre-wrap break-words font-mono text-[13px] leading-6">{finalPrompt}</pre>
            )
          )}
          <div hidden={finalMode}>
            {loadError ? (
              <div className="a-card p-8 text-center space-y-3">
                <p className="text-sm font-bold text-red-500">{loadError}</p>
                <Button variant="secondary" size="sm" onClick={() => load(categoryId)}>تلاش دوباره</Button>
              </div>
            ) : !data ? (
              <AdminLoader />
            ) : (
              <PromptArticle data={data} loading={loading} categoryLabel={categoryLabel} groupLabel={groupLabel} ruleProps={ruleProps} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── مقاله ──────────────────────────────────────────────────────────────── */

function PromptArticle({ data, loading, categoryLabel, groupLabel, ruleProps }) {
  const { model } = data;
  // فیلترِ منبع: منبع‌های انتخاب‌شده — خالی یعنی «همه»؛ با انتخاب، فقط همان‌ها
  // دیده می‌شوند. به‌علاوه (اختیاری) فقط یک گروهِ مشخص.
  const [tones, setTones] = useState(() => new Set());
  const [groupFilter, setGroupFilter] = useState('');

  const rules = allRules(model);
  const counts = rules.reduce((acc, r) => ({ ...acc, [toneOf(r.source.kind)]: (acc[toneOf(r.source.kind)] || 0) + 1 }), {});
  const groupIds = [...new Set(rules.filter((r) => toneOf(r.source.kind) === 'group').map((r) => r.source.groupId ?? ''))];
  const activeGroup = groupIds.includes(groupFilter) ? groupFilter : '';
  const toneShown = (tone) => !tones.size || tones.has(tone);
  const filtering = tones.size > 0 || Boolean(activeGroup);
  const shown = (r) => {
    const tone = toneOf(r.source.kind);
    return toneShown(tone) && (tone !== 'group' || !activeGroup || (r.source.groupId ?? '') === activeGroup);
  };
  const only = (list) => list.filter(shown);
  const toggleTone = (key) =>
    setTones((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const definitionRules = (key) => {
    if (key === 'attributes') {
      return { title: 'قواعدِ ویژگی‌های ثابت', items: model.attributes.flatMap((a) => a.rules.map((rule) => ({ rule, caption: `${a.label} · ${a.name}` }))) };
    }
    if (key === 'variantOptions') {
      return { title: 'قواعدِ ویژگی‌های متغیر', items: model.variants.flatMap((v) => v.rules.map((rule) => ({ rule, caption: `${v.label} · ${v.name}` }))) };
    }
    if (key === 'technicalStats') {
      return { title: 'قواعدِ شاخص‌ها', items: model.technicalStats.flatMap((s) => s.rules.map((rule) => ({ rule, caption: `${s.label} · ${s.name}` }))) };
    }
    if (key === 'customTabItems') {
      return { title: `آیتم‌های تب «${model.customTab.name}»`, items: model.customTab.items.flatMap((i) => i.rules.map((rule) => ({ rule, caption: i.title }))) };
    }
    return null;
  };

  const fields = model.fields.map((f) => {
    const def = definitionRules(f.key);
    const view = {
      ...f,
      def: def && { ...def, items: def.items.filter(({ rule }) => shown(rule)) },
      base: only(f.rules.base),
      groups: groupBy(only(f.rules.groups)),
      category: f.rules.category && shown(f.rules.category) ? f.rules.category : null,
      // «فیلدِ بدونِ قاعده» وضعیتِ خودِ پرامپت است، نه نتیجه‌ی فیلتر
      empty: !f.rules.base.length && !f.rules.groups.length && !f.rules.category,
    };
    view.count = view.base.length + view.groups.reduce((n, [, list]) => n + list.length, 0) + (view.category ? 1 : 0) + (view.def?.items.length || 0);
    return view;
  });
  const visibleFields = fields.filter((f) => !filtering || f.count);

  // بخش‌ها به ترتیبِ پرامپت؛ در حالتِ فیلتر، بخشی که قاعده‌ی دیده‌شونده ندارد پنهان می‌شود
  const sections = model.sections
    .map((section, position) => ({ ...section, anchor: `section-${position}`, shownRules: section.kind === 'fields' ? [] : only(section.rules) }))
    .filter((section) => !filtering || (section.kind === 'fields' ? visibleFields.length : section.shownRules.length));

  return (
    <div className={`grid lg:grid-cols-[minmax(0,1fr)_240px] gap-6 items-start transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <article className="a-card px-5 py-7 sm:px-10 sm:py-10 min-w-0">
        <header className="pb-6 border-b border-gray-100 space-y-3">
          <p className="text-xs font-bold text-[var(--color-primary)]">پرامپت ساخت محصول</p>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">{categoryLabel}</h1>
          <p className="text-sm font-medium text-gray-500 leading-7">
            بخش‌ها به همان ترتیبی آمده‌اند که به هوش مصنوعی می‌رسند. روی هر قاعده کلیک کنید تا منبعش را ببینید و ویرایشش کنید.
            داده‌هایی مثل فهرست برندها و متن خام محصول اینجا به‌صورت placeholder دیده می‌شوند؛ متنِ کامل در حالتِ «پرامپت نهایی» است.
          </p>
          {filtering && (
            <p className="text-xs font-bold text-amber-700">
              فیلتر فعال است: فقط قواعدِ {tones.size ? [...tones].map((t) => TONES[t].label).join('، ') : 'همه‌ی منبع‌ها'}
              {activeGroup !== '' && ` (فقط گروه «${groupLabel(activeGroup)}»)`} نمایش داده می‌شوند.
            </p>
          )}
        </header>

        {filtering && !sections.length && <p className="pt-10 text-center text-sm font-bold text-gray-400">هیچ قاعده‌ای با این فیلتر وجود ندارد.</p>}

        {sections.map((section) => (
          <section key={section.anchor} id={section.anchor} className="pt-10 scroll-mt-40">
            <h2 className="text-xl font-black text-gray-900 mb-1">{section.name}</h2>
            {section.owner && (
              <p className="text-xs font-bold text-violet-700 mb-2">از گروه «{groupLabel(section.owner.groupId, section.owner.groupTitle)}»</p>
            )}
            {!filtering && <SectionHeader section={section} />}

            {section.kind === 'fields' ? (
              <div className="mt-2 divide-y divide-gray-100">
                {visibleFields.map((f) => {
                  const placement = `${section.title || section.name} › ${f.key}`;
                  return (
                    <article key={f.key} id={`field-${f.key}`} className="py-8 scroll-mt-40 space-y-5">
                      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="text-lg font-black text-gray-900">{f.title}</h3>
                        <code dir="ltr" className="px-1.5 py-0.5 rounded bg-gray-100 text-xs font-bold text-gray-500">{f.key}</code>
                      </header>
                      {f.empty && !filtering && <Empty>قاعده‌ای ندارد — در پرامپت متنِ «فیلد بدون قاعده» می‌آید.</Empty>}
                      {f.base.length > 0 && <Layer tone="base" title="پرامپت پایه"><RuleList rules={f.base} placement={placement} ruleProps={ruleProps} /></Layer>}
                      {f.groups.map(([groupId, list]) => (
                        <Layer key={groupId} tone="group" title={`گروه «${groupLabel(groupId, list[0].source.groupTitle)}»`}>
                          <RuleList rules={list} placement={placement} ruleProps={ruleProps} />
                        </Layer>
                      ))}
                      {f.category && (
                        <Layer tone="category" title="اختصاصیِ این دسته">
                          <RuleList rules={[f.category]} placement={placement} ruleProps={ruleProps} />
                        </Layer>
                      )}
                      {f.def && f.def.items.length > 0 && (
                        <Layer tone="category" title={f.def.title} meta="کنارِ سطرِ همان داده می‌آید">
                          <div className="space-y-2">
                            {f.def.items.map(({ rule, caption }) => (
                              <Rule key={sourceId(rule.source)} rule={rule} caption={caption} placement={placement} {...ruleProps} />
                            ))}
                          </div>
                        </Layer>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              section.shownRules.length > 0 && (
                <div className="mt-3">
                  <RuleList rules={section.shownRules} placement={section.title || section.name} ruleProps={ruleProps} />
                </div>
              )
            )}
          </section>
        ))}
      </article>

      {/* ستونِ کناری (چپ): فیلتر + فهرستِ فیلدها؛ روی دسکتاپ هنگامِ اسکرول ثابت می‌ماند.
          top = نوبارِ سایت (75px) + هدرِ چسبانِ پنل */}
      <aside className="order-first lg:order-none lg:sticky lg:top-[150px] a-card p-4 space-y-4 lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto admin-scrollbar">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-gray-400">فیلتر بر اساسِ منبع</p>
            {filtering && (
              <button
                type="button"
                onClick={() => { setTones(new Set()); setGroupFilter(''); }}
                className="text-[11px] font-bold text-[var(--color-primary)] hover:underline"
              >
                نمایش همه
              </button>
            )}
          </div>
          <div className="flex flex-wrap lg:flex-col gap-1.5" role="group" aria-label="فیلتر بر اساسِ منبع">
            {Object.entries(TONES).map(([key, t]) => {
              // انتخاب‌شده: پررنگ با حاشیه؛ وقتی چیزی انتخاب نشده همه با رنگِ خودشان (همه دیده می‌شوند)؛
              // وقتی منبعِ دیگری انتخاب شده، کم‌رنگ (پنهان)
              const selected = tones.has(key);
              const visible = toneShown(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTone(key)}
                  className={`inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    selected
                      ? `${t.chip} border-current ring-1 ring-current`
                      : visible
                        ? `${t.chip} border-transparent hover:border-current`
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${visible ? t.dot : 'bg-gray-300'}`} />
                    {t.label}
                  </span>
                  <span className="text-[10px] opacity-80">{counts[key] || 0}</span>
                </button>
              );
            })}
          </div>
          {groupIds.length > 0 && toneShown('group') && (
            <label className="block mt-2">
              <span className="sr-only">گروه</span>
              <select
                value={activeGroup}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-white outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">همه‌ی گروه‌ها</option>
                {groupIds.map((id) => <option key={id} value={id}>گروه «{groupLabel(id)}»</option>)}
              </select>
            </label>
          )}
        </div>

        <nav aria-label="فهرست بخش‌ها و فیلدها" className="border-t border-gray-100 pt-3">
          <p className="text-[11px] font-bold text-gray-400 mb-2">فهرست</p>
          {sections.map((section) => (
            <div key={section.anchor}>
              <a href={`#${section.anchor}`} className="block px-2 py-1.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50">{section.name}</a>
              {section.kind === 'fields' && (
                <ul className="mt-1 mb-1 flex flex-wrap gap-1 lg:block lg:border-r lg:border-gray-100 lg:pr-2 lg:space-y-0.5">
                  {visibleFields.map((f) => (
                    <li key={f.key}>
                      <a href={`#field-${f.key}`} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs font-bold text-gray-500 bg-gray-50 lg:bg-transparent hover:bg-gray-50 hover:text-[var(--color-primary)]">
                        {f.title}
                        <span className="text-[10px] text-gray-400">{f.count}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}

/** سربرگ و توضیحِ یک بخش همان‌طور که نوشته شده؛ placeholderها باز نمی‌شوند. */
function SectionHeader({ section }) {
  const head = [section.top, section.title, section.bottom].filter((line) => line !== '');
  if (!head.length && !section.description) return null;
  return (
    <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 px-3.5 py-2.5 font-mono text-xs leading-6 text-gray-600 whitespace-pre-wrap break-words text-start [unicode-bidi:plaintext]">
      {[...head, ...(section.description ? [section.description] : [])].join('\n')}
    </div>
  );
}

/** قاعده‌های گروه، دسته‌بندی‌شده به ترتیبِ اولین ظهورِ هر گروه. */
function groupBy(rules) {
  const map = new Map();
  for (const r of rules) {
    const key = r.source.groupId ?? '';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map.entries()];
}

const SubHeading = ({ title, meta }) => (
  <div className="flex flex-wrap items-baseline gap-x-2 mb-3">
    <h3 className="text-base font-black text-gray-900">{title}</h3>
    {meta && <span dir="ltr" className="text-[11px] font-bold text-gray-400">{meta}</span>}
  </div>
);

const Empty = ({ children }) => <p className="text-sm font-medium text-gray-400 italic">{children}</p>;

function Layer({ tone, title, meta, children }) {
  return (
    <div>
      <p className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500">
        <span className={`w-2 h-2 rounded-full ${TONES[tone].dot}`} />
        {title}
        {meta && <span className="font-medium text-gray-400">— {meta}</span>}
      </p>
      {children}
    </div>
  );
}

function RuleList({ rules, placement, ruleProps }) {
  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <Rule key={sourceId(rule.source)} rule={rule} placement={placement} {...ruleProps} />
      ))}
    </div>
  );
}

/* ─── یک قاعده: متن + پنجره‌ی منبع/ویرایش ──────────────────────────────── */

function Rule({ rule, caption, placement, openId, setOpenId, describe, canEdit, onSave }) {
  const id = `${placement}::${sourceId(rule.source)}`;
  const open = openId === id;
  const tone = TONES[toneOf(rule.source.kind)];
  const d = describe(rule.source);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  const close = () => setOpenId(null);
  const toggle = () => setOpenId(open ? null : id);

  // بستنِ پنجره‌ی منبع با Escape یا کلیک بیرون
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpenId(null); };
    const onKey = (e) => { if (e.key === 'Escape') setOpenId(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpenId]);

  // ویرایش درجا: متنِ خودِ کادر با ویرایشگر جایگزین می‌شود و پنجره‌ی منبع بسته می‌شود
  const startEdit = () => {
    setDraft(rule.source.value ?? rule.text);
    setError('');
    setEditing(true);
    setOpenId(null);
  };
  const cancel = () => {
    setEditing(false);
    setError('');
  };
  const submit = async () => {
    setBusy(true);
    const message = await onSave(rule, draft);
    setBusy(false);
    if (message) setError(message);
    else setEditing(false);
  };

  const partial = typeof rule.source.value === 'string' && rule.source.value.trim() !== rule.text.trim();
  const categoryOwned = toneOf(rule.source.kind) === 'category';
  const unchanged = draft === rule.source.value;

  const body = (
    <>
      <div className="flex-1 min-w-0">
        {caption && <p className="mb-0.5 text-start [unicode-bidi:plaintext] text-[11px] font-bold text-gray-500">{caption}</p>}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              autoFocus
              rows={Math.min(14, Math.max(2, draft.split('\n').length + 1))}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !unchanged && !busy) submit();
              }}
              aria-label="متن قاعده"
              className={`${textareaClass} bg-white! ${error ? 'border-red-400' : 'border-gray-200'}`}
            />
            <div dir="rtl" className="space-y-2 text-right">
              {partial && (
                <p className="text-[11px] font-bold text-amber-700 leading-5">
                  متنِ کاملِ ذخیره‌شده ویرایش می‌شود؛ بخش‌هایی از آن که تکرارِ قاعده‌ای پیش از آن‌اند در پرامپت نمی‌آیند.
                </p>
              )}
              {categoryOwned && <p className="text-[11px] font-bold text-gray-400">خالی گذاشتن یعنی حذفِ این متن از دسته.</p>}
              {error && <p className="text-xs font-bold text-red-500">! {error}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" loading={busy} disabled={unchanged} onClick={submit}>ذخیره</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={cancel}>انصراف</Button>
                <span dir="ltr" className="text-[10px] font-bold text-gray-400">Ctrl+Enter · Esc</span>
              </div>
            </div>
          </div>
        ) : (
          // plaintext: جهتِ هر خط از متنِ همان خط می‌آید، پس نقطه و دونقطه‌ی جمله‌ی فارسی آخرِ جمله می‌مانند و
          // متنِ مخلوط درست چیده می‌شود. dir کافی نیست: direction روی * در globals.css از آن قوی‌تر است.
          <div className="whitespace-pre-wrap break-words text-start [unicode-bidi:plaintext] text-[13px] leading-7 text-gray-800">
            {rule.display ?? rule.text}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div ref={ref} className="relative">
      {editing ? (
        <div className={`flex gap-3 items-start rounded-lg border-l-4 px-3.5 py-2.5 ring-2 ring-[var(--color-primary)]/40 ${tone.rule}`}>
          {body}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle();
            }
          }}
          className={`flex gap-3 items-start rounded-lg border-l-4 px-3.5 py-2.5 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 ${tone.rule} ${open ? 'ring-2 ring-[var(--color-primary)]/30' : ''}`}
        >
          {body}
        </div>
      )}

      {open && !editing && (
        <div role="dialog" aria-label="منبع قاعده" className="absolute z-30 top-full left-0 mt-2 w-full sm:w-[min(36rem,100%)] rounded-xl bg-white shadow-xl ring-1 ring-black/10 p-4 space-y-3">
          <span aria-hidden className="absolute -top-1.5 left-6 w-3 h-3 rotate-45 bg-white border-t border-l border-black/10" />
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${tone.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} /> {tone.label}
            </span>
            <button type="button" onClick={close} aria-label="بستن" className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <FiX size={14} />
            </button>
          </div>

          <ol className="flex flex-wrap items-center gap-1 text-sm font-bold text-gray-800 leading-7">
            {d.path.map((part, i) => (
              <li key={i} className="inline-flex items-center gap-1">
                {i > 0 && <FiChevronLeft size={13} className="text-gray-300" />}
                {part}
              </li>
            ))}
          </ol>
          {d.note && <p className="text-xs font-bold text-gray-500 leading-6">{d.note}</p>}
          {partial && (
            <p className="text-xs font-bold text-amber-700 leading-6">
              بخشی از متنِ ذخیره‌شده‌ی این منبع تکرارِ قاعده‌ای پیش از آن است و در پرامپت نمی‌آید؛ ویرایش روی کلِ متنِ ذخیره‌شده انجام می‌شود.
            </p>
          )}
          <p className="text-[11px] font-bold text-gray-400">
            جایگاه در پرامپت: <span dir="ltr" className="font-mono">{placement}</span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {d.editable && canEdit && (
              <Button size="sm" icon={<FiEdit3 size={13} />} onClick={startEdit}>ویرایش قاعده</Button>
            )}
            {d.href && (
              <Link href={d.href} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-[var(--admin-radius)] border border-[var(--admin-border)] text-gray-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                باز کردن در تنظیمات <FiExternalLink size={12} />
              </Link>
            )}
            {d.editable && !canEdit && (
              <span className="text-[11px] font-bold text-gray-400">برای ویرایش، دسترسی «ویرایش تنظیمات پرامپت» لازم است.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
