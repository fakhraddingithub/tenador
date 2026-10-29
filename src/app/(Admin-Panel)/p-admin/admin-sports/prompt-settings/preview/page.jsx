'use client';

/**
 * «پیش‌نمایش پرامپت نهایی» برای یک دسته — قواعدِ پرامپتِ ساختِ محصول، فیلد به فیلد.
 *
 * داده از GET /api/admin/product-prompts/preview می‌آید که همان composeProductPrompt
 * را صدا می‌زند که پرامپتِ واقعی از آن رندر می‌شود؛ پس هر قاعده‌ای که اینجا دیده
 * می‌شود دقیقاً همان است که به AI می‌رسد، با منبعِ دقیقش. فهرست‌های داده (برند، سری،
 * ورزشکار…)، متنِ خامِ محصول و ساختارِ JSON خروجی عمداً نمایش داده نمی‌شوند.
 *
 * کلیک روی هر قاعده منبعش را نشان می‌دهد و (با دسترسیِ ویرایش) همان منبع را ویرایش می‌کند:
 *   پایه / گروه → همان PUTِ تنظیمات (۴۰۹ و بررسیِ تکرار همان‌جا)
 *   متعلق به دسته → PATCH …/category-rule (compare-and-set روی همان یک متن)
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { FiArrowRight, FiChevronLeft, FiEdit3, FiEye, FiExternalLink, FiLock, FiX } from 'react-icons/fi';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import { getApiErrorMessage } from '@/lib/apiClientError';
import {
  PROMPTS_API, PROMPTS_HOME, categoryName, storedGroupPayload, textareaClass, usePromptConfig,
} from '@/components/admin/productPrompts/promptSettingsUi';
import { BASE_PROMPT_SECTIONS, resolveBasePrompt, storableBase } from '@/lib/productPromptConfig';

/* ─── منبع‌ها ─────────────────────────────────────────────────────────────── */

const TONES = {
  base: { label: 'پرامپت پایه', rule: 'border-sky-400 bg-sky-50/70 hover:bg-sky-50', chip: 'bg-sky-100 text-sky-800', dot: 'bg-sky-400' },
  group: { label: 'گروه پرامپت دسته', rule: 'border-violet-400 bg-violet-50/70 hover:bg-violet-50', chip: 'bg-violet-100 text-violet-800', dot: 'bg-violet-400' },
  category: { label: 'اختصاصیِ دسته', rule: 'border-amber-400 bg-amber-50/70 hover:bg-amber-50', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-400' },
  system: { label: 'سیستمی (قفل)', rule: 'border-gray-300 bg-gray-50 hover:bg-gray-100/70', chip: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
};
const toneOf = (kind) => (kind === 'base' || kind === 'group' || kind === 'system' ? kind : 'category');

const SYSTEM_WHAT = {
  sportLock: 'قفلِ شناسه‌ی ورزش — از ورزشِ صاحبِ دسته ساخته می‌شود.',
  categoryLock: 'قفلِ شناسه‌ی دسته — از خودِ دسته ساخته می‌شود.',
  audienceScope: 'قاعده‌ی ویژگی‌های محدود به مخاطب هدف — از «مخاطب هدف»ِ ویژگی‌های ثابتِ دسته ساخته می‌شود.',
  multiUnit: 'دستورِ ویژگی‌های چندواحدی — از ویژگی‌های متغیرِ چندواحدیِ دسته ساخته می‌شود.',
  customTabInstruction: 'دستورِ ثابتِ انتخابِ آیتم‌های تب سفارشی؛ همراهِ فهرستِ آیتم‌ها می‌آید.',
  precedenceNote: 'یادداشتِ ترتیبِ قواعد — متنِ ثابتِ سیستم.',
};

const sectionTitle = (key) => BASE_PROMPT_SECTIONS.find((s) => s.key === key)?.title || key;
const sourceId = (s) => [s.kind, s.what, s.section, s.index, s.groupId, s.field, s.name, s.itemId].join('|');

/** همه‌ی قاعده‌های مدل، به ترتیبِ پرامپت. */
function allRules(model) {
  const { general, fields, attributes, variants, customTab } = model;
  return [
    ...general.role, ...general.task, ...general.output, ...general.language,
    ...fields.flatMap((f) => [...f.before, ...f.rules.base, ...f.after, ...f.rules.groups, ...(f.rules.category ? [f.rules.category] : [])]),
    ...attributes.flatMap((a) => (a.rule ? [a.rule] : [])),
    ...variants.flatMap((v) => (v.rule ? [v.rule] : [])),
    ...(customTab.instruction ? [customTab.instruction] : []),
    ...customTab.items.flatMap((i) => (i.rule ? [i.rule] : [])),
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
      case 'base':
        return { path: ['پرامپت پایه', `بخش «${sectionTitle(s.section)}»`, `قاعده‌ی ${s.index + 1}`], href: `${PROMPTS_HOME}/base#${encodeURIComponent(s.section)}`, editable: true };
      case 'group': {
        const order = ctx.config.groups.findIndex((g) => g._id === s.groupId);
        const targets = s.targets.length
          ? `فقط برای این دسته‌ها: ${s.targets.map((id) => categoryName(ctx.categoryById, id)).join('، ')}`
          : 'برای همه‌ی دسته‌های این گروه';
        return {
          path: ['گروه پرامپت دسته', `«${groupLabel(s.groupId, s.groupTitle)}»`, `فیلد ${fieldTitleOf(s.field)}`, `قاعده‌ی ${s.index + 1}`],
          note: `${targets}.${order >= 0 ? ` این گروه ${order + 1}‌اُمین گروه در ترتیبِ گروه‌هاست.` : ''}`,
          href: s.groupId ? `${PROMPTS_HOME}/groups/${s.groupId}#${s.field}` : '',
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
        return { path: ['سیستمی (قفل)'], note: `${SYSTEM_WHAT[s.what] || ''} قابل ویرایش نیست.`, editable: false };
    }
  };

  /** ذخیره‌ی یک قاعده در منبعِ خودش. خطا → پیامِ خطا؛ موفق → null. */
  const saveRule = async (rule, rawText) => {
    const s = rule.source;
    const text = rawText.trim();
    const stale = 'این قاعده در این فاصله تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.';

    if (s.kind === 'base' || s.kind === 'group') {
      if (!text) return 'متن قاعده خالی است؛ برای حذفِ قاعده از صفحه‌ی تنظیماتِ آن استفاده کنید.';
      let payload;
      let errorPath;
      if (s.kind === 'base') {
        const sections = resolveBasePrompt(ctx.config.base);
        if (sections[s.section]?.[s.index] !== s.value) return stale;
        sections[s.section][s.index] = text;
        payload = { base: storableBase(sections) };
        errorPath = `base.${s.section}.${s.index}`;
      } else {
        const groups = ctx.config.groups.map(storedGroupPayload);
        const gi = groups.findIndex((g) => g._id === s.groupId);
        if (gi < 0 || groups[gi].rules[s.index]?.text !== s.value) return stale;
        groups[gi] = { ...groups[gi], rules: groups[gi].rules.map((r, i) => (i === s.index ? { ...r, text } : r)) };
        payload = { groups };
        errorPath = `groups.${gi}.rules.${s.index}`;
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
      </section>

      {!categoryId ? (
        <p className="a-card p-10 text-center text-sm font-bold text-gray-400">یک دسته را انتخاب کنید تا پرامپتِ نهاییِ آن نمایش داده شود.</p>
      ) : loadError ? (
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
  );
}

const fieldTitleOf = (key) => BASE_PROMPT_SECTIONS.find((s) => s.field === key)?.title || key;

/* ─── مقاله ──────────────────────────────────────────────────────────────── */

function PromptArticle({ data, loading, categoryLabel, groupLabel, ruleProps }) {
  const { model } = data;
  // فیلترِ منبع: منبع‌های انتخاب‌شده — خالی یعنی «همه»؛ با انتخاب، فقط همان‌ها
  // دیده می‌شوند. به‌علاوه (اختیاری) فقط یک گروهِ مشخص.
  const [tones, setTones] = useState(() => new Set());
  const [groupFilter, setGroupFilter] = useState('');

  const rules = allRules(model);
  const counts = rules.reduce((acc, r) => ({ ...acc, [toneOf(r.source.kind)]: (acc[toneOf(r.source.kind)] || 0) + 1 }), {});
  const groupIds = [...new Set(rules.filter((r) => r.source.kind === 'group').map((r) => r.source.groupId ?? ''))];
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

  const precedence = { text: model.precedenceNote, source: { kind: 'system', what: 'precedenceNote' } };

  const definitionRules = (key) => {
    if (key === 'attributes') {
      return { title: 'قواعدِ ویژگی‌های ثابت', placement: 'CATEGORY DEFINITION › Category Attributes', items: model.attributes.filter((a) => a.rule).map((a) => ({ rule: a.rule, caption: `${a.label} · ${a.name}` })) };
    }
    if (key === 'variantOptions') {
      return { title: 'قواعدِ ویژگی‌های متغیر', placement: 'CATEGORY DEFINITION › Variant Attributes', items: model.variants.filter((v) => v.rule).map((v) => ({ rule: v.rule, caption: `${v.label} · ${v.name}` })) };
    }
    if (key === 'customTabItems') {
      return {
        title: `آیتم‌های تب «${model.customTab.name}»`,
        placement: 'CATEGORY DEFINITION › custom tab items',
        items: [
          ...(model.customTab.instruction ? [{ rule: model.customTab.instruction }] : []),
          ...model.customTab.items.filter((i) => i.rule).map((i) => ({ rule: i.rule, caption: i.title })),
        ],
      };
    }
    return null;
  };

  const general = [
    { key: 'role', title: 'نقش مدل', placement: 'ابتدای پرامپت', rules: model.general.role },
    { key: 'task', title: 'قواعد کلی', placement: 'Your task', rules: model.general.task },
    { key: 'output', title: 'قالب خروجی', placement: 'CRITICAL OUTPUT FORMAT RULES', rules: model.general.output, numbered: true },
    { key: 'language', title: 'زبان', placement: 'LANGUAGE RULE', rules: model.general.language },
  ];
  // در حالتِ فیلتر، بخشی که قاعده‌ی دیده‌شونده ندارد کلاً پنهان می‌شود
  const visibleGeneral = general.filter((g) => !filtering || only(g.rules).length);

  const fields = model.fields.map((f) => {
    const def = definitionRules(f.key);
    const view = {
      ...f,
      def: def && { ...def, items: def.items.filter(({ rule }) => shown(rule)) },
      before: only(f.before),
      after: only(f.after),
      base: only(f.rules.base),
      groups: groupBy(only(f.rules.groups)),
      category: f.rules.category && shown(f.rules.category) ? f.rules.category : null,
      // «No specific rule defined.» وضعیتِ خودِ پرامپت است، نه نتیجه‌ی فیلتر
      empty: !f.before.length && !f.rules.base.length && !f.after.length && !f.rules.groups.length && !f.rules.category,
    };
    view.count = view.before.length + view.base.length + view.after.length + view.groups.reduce((n, [, list]) => n + list.length, 0) + (view.category ? 1 : 0) + (view.def?.items.length || 0);
    return view;
  });
  const visibleFields = fields.filter((f) => !filtering || f.count);
  const nothing = filtering && !visibleGeneral.length && !visibleFields.length && !shown(precedence);

  return (
    <div className={`grid lg:grid-cols-[minmax(0,1fr)_240px] gap-6 items-start transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <article className="a-card px-5 py-7 sm:px-10 sm:py-10 min-w-0">
        <header className="pb-6 border-b border-gray-100 space-y-3">
          <p className="text-xs font-bold text-[var(--color-primary)]">پرامپت ساخت محصول</p>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">{categoryLabel}</h1>
          <p className="text-sm font-medium text-gray-500 leading-7">
            قواعد به همان ترتیبی آمده‌اند که به هوش مصنوعی می‌رسند. روی هر قاعده کلیک کنید تا منبعش را ببینید و ویرایشش کنید.
            فهرست‌های داده (برندها، سری‌ها، ورزشکاران، لیمیتد ادیشن‌ها)، متنِ خامِ محصول و ساختارِ JSON خروجی اینجا نمایش داده نمی‌شوند.
          </p>
          {filtering && (
            <p className="text-xs font-bold text-amber-700">
              فیلتر فعال است: فقط قواعدِ {tones.size ? [...tones].map((t) => TONES[t].label).join('، ') : 'همه‌ی منبع‌ها'}
              {activeGroup !== '' && ` (فقط گروه «${groupLabel(activeGroup)}»)`} نمایش داده می‌شوند.
            </p>
          )}
        </header>

        {nothing && <p className="pt-10 text-center text-sm font-bold text-gray-400">هیچ قاعده‌ای با این فیلتر وجود ندارد.</p>}

        {visibleGeneral.length > 0 && (
          <section id="general" className="pt-8 scroll-mt-40">
            <h2 className="text-xl font-black text-gray-900 mb-1">قواعد عمومی</h2>
            <p className="text-xs font-bold text-gray-400 mb-6">برای همه‌ی فیلدها؛ پیش از قواعدِ فیلدها می‌آیند.</p>
            <div className="space-y-7">
              {visibleGeneral.map((g) => (
                <div key={g.key}>
                  <SubHeading title={g.title} meta={g.placement} />
                  {g.rules.length ? (
                    <RuleList rules={only(g.rules)} placement={g.placement} numbered={g.numbered} ruleProps={ruleProps} />
                  ) : (
                    <Empty>این بخش خالی است و از پرامپت حذف می‌شود.</Empty>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {(visibleFields.length > 0 || shown(precedence)) && (
          <section id="fields" className="pt-12 scroll-mt-40">
            <h2 className="text-xl font-black text-gray-900 mb-1">قواعد فیلدها</h2>
            <p className="text-xs font-bold text-gray-400 mb-4">هر فیلد: پرامپت پایه ← گروه‌ها ← اختصاصیِ دسته. در تعارض، قاعده‌ی خاص‌تر برنده است.</p>
            {shown(precedence) && <RuleList rules={[precedence]} placement="FIELD RULES" ruleProps={ruleProps} />}

            <div className="mt-4 divide-y divide-gray-100">
              {visibleFields.map((f) => {
                const placement = `FIELD RULES › ${f.key}`;
                return (
                  <article key={f.key} id={`field-${f.key}`} className="py-8 scroll-mt-40 space-y-5">
                    <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-lg font-black text-gray-900">{f.title}</h3>
                      <code dir="ltr" className="px-1.5 py-0.5 rounded bg-gray-100 text-xs font-bold text-gray-500">{f.key}</code>
                    </header>
                    {f.empty && !filtering && <Empty>قاعده‌ای ندارد — در پرامپت «No specific rule defined.» می‌آید.</Empty>}
                    {f.before.length > 0 && <Layer tone="system" title="قیدِ قفل"><RuleList rules={f.before} placement={placement} ruleProps={ruleProps} /></Layer>}
                    {f.base.length > 0 && <Layer tone="base" title="پرامپت پایه"><RuleList rules={f.base} placement={placement} ruleProps={ruleProps} /></Layer>}
                    {f.after.length > 0 && <Layer tone="system" title="قیدِ قفل"><RuleList rules={f.after} placement={placement} ruleProps={ruleProps} /></Layer>}
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
                      <Layer tone="category" title={f.def.title} meta="در بخشِ «تعریف دسته»">
                        <div className="space-y-2">
                          {f.def.items.map(({ rule, caption }, i) => (
                            <Rule key={i} rule={rule} caption={caption} placement={f.def.placement} {...ruleProps} />
                          ))}
                        </div>
                      </Layer>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
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

        <nav aria-label="فهرستِ فیلدها" className="border-t border-gray-100 pt-3">
          <p className="text-[11px] font-bold text-gray-400 mb-2">فهرست</p>
          <div className="flex flex-wrap lg:block gap-1">
            {visibleGeneral.length > 0 && (
              <a href="#general" className="block px-2 py-1.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50">قواعد عمومی</a>
            )}
            {(visibleFields.length > 0 || shown(precedence)) && (
              <a href="#fields" className="block px-2 py-1.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50">قواعد فیلدها</a>
            )}
          </div>
          <ul className="mt-1 flex flex-wrap gap-1 lg:block lg:border-r lg:border-gray-100 lg:pr-2 lg:space-y-0.5">
            {visibleFields.map((f) => (
              <li key={f.key}>
                <a href={`#field-${f.key}`} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs font-bold text-gray-500 bg-gray-50 lg:bg-transparent hover:bg-gray-50 hover:text-[var(--color-primary)]">
                  {f.title}
                  <span className="text-[10px] text-gray-400">{f.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
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

function RuleList({ rules, placement, numbered, ruleProps }) {
  return (
    <div className="space-y-2">
      {rules.map((rule, i) => (
        <Rule key={i} rule={rule} marker={numbered ? `${i + 1}.` : null} placement={placement} {...ruleProps} />
      ))}
    </div>
  );
}

/* ─── یک قاعده: متن + پنجره‌ی منبع/ویرایش ──────────────────────────────── */

function Rule({ rule, marker, caption, placement, openId, setOpenId, describe, canEdit, onSave }) {
  const id = `${placement}::${sourceId(rule.source)}`;
  const open = openId === id;
  const tone = TONES[toneOf(rule.source.kind)];
  const d = describe(rule.source);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  const close = () => {
    setEditing(false);
    setError('');
    setOpenId(null);
  };
  const toggle = () => {
    setEditing(false);
    setError('');
    setOpenId(open ? null : id);
  };

  // بستن با Escape یا کلیک بیرون — جز در حالِ ویرایش، تا متنِ نوشته‌شده از دست نرود
  useEffect(() => {
    if (!open) return;
    const dismiss = () => {
      setEditing(false);
      setError('');
      setOpenId(null);
    };
    const onDown = (e) => { if (!editing && !ref.current?.contains(e.target)) dismiss(); };
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, editing, setOpenId]);

  const startEdit = () => {
    setDraft(rule.source.value ?? rule.text);
    setError('');
    setEditing(true);
  };
  const submit = async () => {
    setBusy(true);
    const message = await onSave(rule, draft);
    setBusy(false);
    if (message) setError(message);
    else close();
  };

  const isSystem = rule.source.kind === 'system';
  const partial = !isSystem && typeof rule.source.value === 'string' && rule.source.value.trim() !== rule.text.trim();
  const categoryOwned = toneOf(rule.source.kind) === 'category';

  return (
    <div ref={ref} className="relative">
      <div
        dir="ltr"
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
        className={`flex gap-3 items-start rounded-lg border-l-4 text-left px-3.5 py-2.5 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 ${tone.rule} ${open ? 'ring-2 ring-[var(--color-primary)]/30' : ''}`}
      >
        {marker && <span className="mt-0.5 shrink-0 w-6 text-center text-xs font-bold text-gray-400">{marker}</span>}
        <div className="flex-1 min-w-0">
          {caption && <p dir="auto" className="mb-0.5 text-left text-[11px] font-bold text-gray-500">{caption}</p>}
          <div
            dir="auto"
            className={`whitespace-pre-wrap break-words text-left text-[13px] leading-7 ${isSystem ? 'text-gray-500 max-h-48 overflow-y-auto' : 'text-gray-800'}`}
          >
            {rule.text}
          </div>
        </div>
        {isSystem && <FiLock className="mt-1.5 shrink-0 text-gray-400" size={12} aria-label="قفل" />}
      </div>

      {open && (
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

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                autoFocus
                rows={Math.min(14, Math.max(3, draft.split('\n').length + 1))}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="متن قاعده"
                className={`${textareaClass} ${error ? 'border-red-400' : 'border-gray-200'}`}
              />
              {categoryOwned && <p className="text-[11px] font-bold text-gray-400">خالی گذاشتن یعنی حذفِ این متن از دسته.</p>}
              {error && <p className="text-xs font-bold text-red-500">! {error}</p>}
              <div className="flex gap-2">
                <Button size="sm" loading={busy} disabled={draft === rule.source.value} onClick={submit}>ذخیره</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setEditing(false); setError(''); }}>انصراف</Button>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}
