'use client';

/**
 * صفحه‌ی «پرامپت پایه»: هر بخش (نقش، قواعد کلی، قالب خروجی، زبان و هر فیلدِ محصول)
 * یک تب است و فقط قواعدِ همان تب دیده می‌شود. بخشی که با پیش‌فرض برابر است ذخیره
 * نمی‌شود تا پیش‌فرض‌های کد را دنبال کند (undefined ≠ []).
 */

import { useState } from 'react';
import { FiArrowRight, FiLock, FiRotateCcw, FiSave, FiSliders } from 'react-icons/fi';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import {
  AddRuleButton, PROMPTS_HOME, PromptTabs, RuleCard, errorMap, uid, usePromptConfig, useUnsavedGuard,
} from '@/components/admin/productPrompts/promptSettingsUi';
import {
  BASE_PROMPT_SECTIONS, DEFAULT_BASE_PROMPT, resolveBasePrompt, validatePromptConfig,
} from '@/lib/productPromptConfig';

const toRules = (texts) => texts.map((text) => ({ uid: uid(), text }));

const sameAsDefault = (key, rules) => {
  const def = DEFAULT_BASE_PROMPT[key];
  return rules.length === def.length && rules.every((r, i) => r.text.trim() === def[i].trim());
};

const fromConfig = (config) =>
  Object.fromEntries(Object.entries(resolveBasePrompt(config.base)).map(([key, texts]) => [key, toRules(texts)]));

/** فقط بخش‌هایی که با پیش‌فرض فرق دارند. */
const toPayload = (sections) =>
  BASE_PROMPT_SECTIONS.filter(({ key }) => !sameAsDefault(key, sections[key])).map(({ key }) => ({
    section: key,
    rules: sections[key].map((r) => r.text),
  }));

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
  const [active, setActive] = useState('task');
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

  const section = BASE_PROMPT_SECTIONS.find((s) => s.key === active);
  const rules = sections[active];
  const setRules = (next) => {
    setServerErrors({});
    setSections((s) => ({ ...s, [active]: next }));
  };
  const addRule = () => {
    const rule = { uid: uid(), text: '' };
    setFocusUid(rule.uid);
    setRules([...rules, rule]);
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
        label="بخش‌های پرامپت پایه"
        active={active}
        onChange={setActive}
        rows={[
          { label: 'قواعد عمومی', tabs: BASE_PROMPT_SECTIONS.filter((s) => !s.field).map(tab) },
          { label: 'فیلدهای محصول', tabs: BASE_PROMPT_SECTIONS.filter((s) => s.field).map(tab) },
        ]}
      />

      <section id="prompt-tabpanel" role="tabpanel" aria-labelledby={`tab-${active}`} className="a-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{section.title}</h2>
            <p className="text-xs font-bold text-gray-400 mt-0.5 [direction:ltr] text-right">{section.field ? `${section.field}:` : section.key}</p>
          </div>
          {canEdit && !sameAsDefault(active, rules) && (
            <Button size="sm" variant="secondary" icon={<FiRotateCcw size={13} />} onClick={() => setRules(toRules(DEFAULT_BASE_PROMPT[active]))}>
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
