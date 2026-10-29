'use client';

/**
 * صفحه‌ی «پرامپت پایه»: هر بخش (نقش، قواعد کلی، قالب خروجی، زبان و هر فیلدِ محصول)
 * یک تب است و فقط قواعدِ همان تب دیده می‌شود؛ «نمایش همه‌ی قواعد» همه‌ی بخش‌ها را
 * زیرِ هم با عنوانِ هر بخش نشان می‌دهد (همان ویرایشگر، فقط چیدمانِ دیگر). بخشی که با
 * پیش‌فرض برابر است ذخیره نمی‌شود تا پیش‌فرض‌های کد را دنبال کند (undefined ≠ []).
 * `#<section>` در آدرس (مثلاً از پیش‌نمایش) همان تب را باز می‌کند.
 */

import { useState } from 'react';
import { FiArrowRight, FiColumns, FiList, FiLock, FiRotateCcw, FiSave, FiSliders } from 'react-icons/fi';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import {
  AddRuleButton, PROMPTS_HOME, PromptTabs, RuleCard, errorMap, uid, usePromptConfig, useUnsavedGuard,
} from '@/components/admin/productPrompts/promptSettingsUi';
import {
  BASE_PROMPT_SECTIONS, DEFAULT_BASE_PROMPT, isDefaultSection, resolveBasePrompt, storableBase, validatePromptConfig,
} from '@/lib/productPromptConfig';

const toRules = (texts) => texts.map((text) => ({ uid: uid(), text }));
const texts = (rules) => rules.map((r) => r.text);
const sameAsDefault = (key, rules) => isDefaultSection(key, texts(rules));

const fromConfig = (config) =>
  Object.fromEntries(Object.entries(resolveBasePrompt(config.base)).map(([key, list]) => [key, toRules(list)]));

/** فقط بخش‌هایی که با پیش‌فرض فرق دارند. */
const toPayload = (sections) =>
  storableBase(Object.fromEntries(Object.entries(sections).map(([key, rules]) => [key, texts(rules)])));

const ROWS = [
  { label: 'قواعد عمومی', sections: BASE_PROMPT_SECTIONS.filter((s) => !s.field) },
  { label: 'فیلدهای محصول', sections: BASE_PROMPT_SECTIONS.filter((s) => s.field) },
];

export default function BasePromptPage() {
  const { can } = useAdminPermissions();
  const canEdit = can('productPrompts.edit');
  const { config, loadError, save } = usePromptConfig();

  return loadError ? (
    <div className="a-card p-8 text-center text-sm font-bold text-red-500">{loadError}</div>
  ) : !config ? (
    <AdminLoader />
  ) : (
    <BaseEditor config={config} save={save} canEdit={canEdit} />
  );
}

function BaseEditor({ config, save, canEdit }) {
  const [sections, setSections] = useState(() => fromConfig(config));
  const [savedPayload, setSavedPayload] = useState(() => JSON.stringify(toPayload(fromConfig(config))));
  // پیوندِ مستقیم به یک بخش: …/base#field:name — این ویرایشگر فقط پس از
  // بارگذاریِ تنظیمات و فقط در مرورگر mount می‌شود، پس window در دسترس است
  const [active, setActive] = useState(() => {
    const key = decodeURIComponent(window.location.hash.slice(1));
    return BASE_PROMPT_SECTIONS.some((s) => s.key === key) ? key : 'task';
  });
  const [showAll, setShowAll] = useState(false);
  const [focusUid, setFocusUid] = useState(null);
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const payload = toPayload(sections);
  const dirty = JSON.stringify(payload) !== savedPayload;
  const leave = useUnsavedGuard(dirty);
  const clientErrors = errorMap(validatePromptConfig({ base: payload }).errors);
  const errors = { ...serverErrors, ...clientErrors };
  const errorCount = Object.keys(clientErrors).length;
  const hasError = (key) => Object.keys(errors).some((p) => p === `base.${key}` || p.startsWith(`base.${key}.`));

  const setRules = (key, next) => {
    setServerErrors({});
    setSections((s) => ({ ...s, [key]: next }));
  };
  const addRule = (key) => {
    const rule = { uid: uid(), text: '' };
    setFocusUid(rule.uid);
    setRules(key, [...sections[key], rule]);
  };

  const onSave = async () => {
    setSaving(true);
    const result = await save({ base: payload }, 'پرامپت پایه ذخیره شد');
    if (result.ok) {
      // آنچه سرور نگه داشته (پاک‌سازی‌شده) مبنای «تغییر نکرده» می‌شود؛ تبِ فعال می‌ماند
      setSections(fromConfig(result.config));
      setSavedPayload(JSON.stringify(toPayload(fromConfig(result.config))));
    } else setServerErrors(result.fieldErrors || {});
    setSaving(false);
  };

  const tab = (s) => ({
    key: s.key,
    title: s.title,
    count: sections[s.key].length,
    error: hasError(s.key),
    note: sameAsDefault(s.key, sections[s.key]) ? '' : 'سفارشی',
  });
  // در نمایشِ همه، تب‌ها فهرستِ پرش به هر بخش‌اند
  const onTab = (key) => {
    setActive(key);
    if (showAll) document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const panelProps = { sections, errors, canEdit, focusUid, setRules, addRule };

  return (
    <div dir="rtl" className="space-y-5 pb-10">
      <PageHeader
        title="پرامپت پایه"
        subtitle="قواعدی که برای همه‌ی محصولات در پرامپتِ ساختِ محصول می‌آیند"
        icon={<FiSliders size={18} />}
        actions={
          <>
            <button type="button" onClick={() => leave(PROMPTS_HOME)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-500 hover:text-[var(--color-primary)]">
              <FiArrowRight size={14} /> تنظیمات پرامپت
            </button>
            <Button
              variant="secondary"
              icon={showAll ? <FiColumns size={14} /> : <FiList size={14} />}
              aria-pressed={showAll}
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'نمایش تب‌به‌تب' : 'نمایش همه‌ی قواعد'}
            </Button>
            {canEdit && (
              <Button icon={<FiSave size={15} />} loading={saving} disabled={!dirty || errorCount > 0} onClick={onSave}>
                ذخیره{dirty ? ' تغییرات' : ''}
              </Button>
            )}
          </>
        }
      />

      <div className="flex gap-2 items-start p-3 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-500 leading-6">
        <FiLock className="mt-1 shrink-0" size={13} />
        <span>
          بخش‌های داده‌محورِ پرامپت قابل ویرایش نیستند و همیشه از داده ساخته می‌شوند: شناسه‌ی ورزش و دسته، تعریف دسته،
          فهرستِ برندها، ورزشکاران، سری‌ها و لیمیتد ادیشن‌ها، متنِ خامِ محصول، ساختارِ JSON خروجی و یادداشتِ ترتیبِ قواعد.
          {errorCount > 0 && <b className="text-red-500"> — {errorCount} خطا؛ پیش از ذخیره برطرف کنید.</b>}
        </span>
      </div>

      <PromptTabs
        label={showAll ? 'پرش به بخش' : 'بخش‌های پرامپت پایه'}
        active={active}
        onChange={onTab}
        rows={ROWS.map((row) => ({ label: row.label, tabs: row.sections.map(tab) }))}
      />

      {showAll ? (
        ROWS.map((row) => (
          <div key={row.label} className="space-y-3">
            <h2 className="flex items-center gap-3 pt-2 text-sm font-bold text-gray-500">
              {row.label}
              <span className="flex-1 h-px bg-gray-200" />
            </h2>
            {row.sections.map((s) => <SectionPanel key={s.key} section={s} {...panelProps} />)}
          </div>
        ))
      ) : (
        <SectionPanel
          section={BASE_PROMPT_SECTIONS.find((s) => s.key === active)}
          tabPanel
          {...panelProps}
        />
      )}
    </div>
  );
}

/** قواعدِ یک بخش؛ در حالتِ تب، پنلِ همان تب است و در «نمایش همه» یکی از بخش‌های زیرِ هم. */
function SectionPanel({ section, tabPanel, sections, errors, canEdit, focusUid, setRules, addRule }) {
  const { key } = section;
  const rules = sections[key];
  const a11y = tabPanel ? { id: 'prompt-tabpanel', role: 'tabpanel', 'aria-labelledby': `tab-${key}` } : { id: `section-${key}` };

  return (
    <section {...a11y} className="a-card p-5 space-y-4 scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">
            {section.title}
            {!sameAsDefault(key, rules) && <span className="mr-2 align-middle px-1.5 py-0.5 rounded bg-amber-50 text-[10px] text-amber-700">سفارشی</span>}
          </h3>
          <p className="text-xs font-bold text-gray-400 mt-0.5 [direction:ltr] text-right">{section.field ? `${section.field}:` : key}</p>
        </div>
        {canEdit && !sameAsDefault(key, rules) && (
          <Button size="sm" variant="secondary" icon={<FiRotateCcw size={13} />} onClick={() => setRules(key, toRules(DEFAULT_BASE_PROMPT[key]))}>
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
      {key === 'task' && (
        <p className="text-xs font-bold text-gray-500 leading-6">قواعدی که روی همه‌ی محصولات اعمال می‌شوند. در پرامپت زیرِ «Your task:» می‌آیند.</p>
      )}

      <div className="space-y-3">
        {rules.map((rule, i) => (
          <RuleCard
            key={rule.uid}
            index={i}
            rule={rule}
            readOnly={!canEdit}
            autoFocus={rule.uid === focusUid}
            error={errors[`base.${key}.${i}`]}
            onChange={(text) => setRules(key, rules.map((r) => (r.uid === rule.uid ? { ...r, text } : r)))}
            onRemove={() => setRules(key, rules.filter((r) => r.uid !== rule.uid))}
          />
        ))}
        {!rules.length && (
          <p className="text-center py-6 text-sm font-bold text-gray-400">
            این بخش قاعده‌ای ندارد{section.field ? ' — اگر گروه یا دسته هم قاعده‌ای نداشته باشد «No specific rule defined.» می‌آید' : ' و از پرامپت حذف می‌شود'}.
          </p>
        )}
        {errors[`base.${key}`] && <p className="text-xs font-bold text-red-500">! {errors[`base.${key}`]}</p>}
        {canEdit && <AddRuleButton onClick={() => addRule(key)} />}
      </div>
    </section>
  );
}
