'use client';

/**
 * صفحه‌ی «پرامپت پایه»: ادمین کلِ متنِ پرامپت را می‌سازد.
 *   بخش‌ها          : افزودن، حذف، سربرگ و قواعد؛ «ترتیب بخش‌ها» ترتیبشان را
 *   بخش‌های داده‌ای : برندها، متن خام، ویژگی‌ها… — داده را برنامه درج می‌کند و فقط سربرگ و جایشان با ادمین است
 *   فیلدهای محصول  : سربرگ و قواعدِ هر فیلد — خودِ فیلدها مالِ مدلِ محصول‌اند و شناسه‌شان باید در سربرگ بماند
 *   قالب‌های داده   : متنِ سطرهایی که از داده ساخته می‌شوند (ویژگی‌ها، شاخص‌ها، تب سفارشی…)
 * سربرگ‌ها و قواعد دقیقاً همان‌طور که نوشته شده‌اند در پرامپت می‌آیند؛ خطِ خالی هم جزوِ متن است.
 * قواعدِ عمومیِ گروه‌ها اینجا نیستند: فقط در صفحه‌ی هر گروه‌اند.
 * `#section:<key>` و `#field:<key>` و `#__templates` در آدرس (مثلاً از پیش‌نمایش) همان تب را باز می‌کنند.
 */

import { useState } from 'react';
import Swal from 'sweetalert2';
import { arrayMove } from '@dnd-kit/sortable';
import { FiArrowRight, FiColumns, FiDatabase, FiList, FiMenu, FiPlus, FiRotateCcw, FiSave, FiSliders, FiTrash2 } from 'react-icons/fi';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import {
  AddRuleButton, HeadingAccordion, PROMPTS_HOME, PromptTabs, RuleCard, SortableRuleList, TokenHelp, UnknownTokensNote,
  errorMap, newSectionKey, swalTheme, textareaClass, uid, usePromptConfig, useUnsavedGuard,
} from '@/components/admin/productPrompts/promptSettingsUi';
import { PRODUCT_PROMPT_FIELDS, TEMPLATE_DEFS, unknownTokens, validatePromptConfig } from '@/lib/productPromptConfig';
import { PROMPT_SEED } from '@/lib/productPromptResolve';

const ORDER_TAB = '__order';
const TEMPLATES_TAB = '__templates';
const toRules = (list) => (list || []).map((text) => ({ uid: uid(), text }));
const texts = (rules) => rules.map((r) => r.text);

const toLocalSection = (s) => ({ ...s, rules: toRules(s.rules) });
const fromConfig = (config) => ({
  document: config.document.map(toLocalSection),
  fields: Object.fromEntries(
    PRODUCT_PROMPT_FIELDS.map(({ key }) => {
      const entry = config.fieldRules.find((f) => f.field === key);
      return [key, { heading: entry?.heading ?? '', rules: toRules(entry?.rules) }];
    }),
  ),
  templates: { ...config.templates },
});

const toPayload = (draft) => ({
  document: draft.document.map((s) => ({ key: s.key, kind: s.kind, name: s.name, heading: s.heading, rules: texts(s.rules) })),
  fieldRules: Object.entries(draft.fields).map(([field, f]) => ({ field, heading: f.heading, rules: texts(f.rules) })),
  templates: draft.templates,
});

const seedSection = (key) => PROMPT_SEED.document.find((s) => s.key === key);
const seedField = (field) => PROMPT_SEED.fieldRules.find((f) => f.field === field);

// مقدارها به ترتیبِ ثابت: ترتیبِ کلیدها در seed و پاسخِ API یکی نیست
const sectionPayload = (s) => JSON.stringify([s.name, s.heading, texts(s.rules)]);
const sectionIsSeed = (s) => {
  const seed = seedSection(s.key);
  return Boolean(seed) && sectionPayload(s) === sectionPayload(toLocalSection(seed));
};
const fieldIsSeed = (key, f) => {
  const seed = seedField(key);
  return f.heading === seed?.heading && JSON.stringify(texts(f.rules)) === JSON.stringify(seed?.rules || []);
};

const TEMPLATE_GROUPS = [...new Set(TEMPLATE_DEFS.map((t) => t.group))];

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
  const [draft, setDraft] = useState(() => fromConfig(config));
  const [savedPayload, setSavedPayload] = useState(() => JSON.stringify(toPayload(fromConfig(config))));
  // پیوندِ مستقیم: این ویرایشگر فقط پس از بارگذاریِ تنظیمات و فقط در مرورگر mount می‌شود
  const [active, setActive] = useState(() => {
    const key = decodeURIComponent(window.location.hash.slice(1));
    const known = key === TEMPLATES_TAB || key === ORDER_TAB || key.startsWith('section:') || PRODUCT_PROMPT_FIELDS.some((f) => `field:${f.key}` === key);
    return known ? key : `section:${config.document[0]?.key}`;
  });
  const [showAll, setShowAll] = useState(false);
  const [focusUid, setFocusUid] = useState(null);
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const payload = toPayload(draft);
  const dirty = JSON.stringify(payload) !== savedPayload;
  const leave = useUnsavedGuard(dirty);
  const clientErrors = errorMap(validatePromptConfig(payload).errors);
  const errors = { ...serverErrors, ...clientErrors };
  const errorCount = Object.keys(clientErrors).length;
  const hasErrorUnder = (prefix) => Object.keys(errors).some((p) => p === prefix || p.startsWith(`${prefix}.`));

  const change = (patch) => {
    setServerErrors({});
    setDraft((d) => ({ ...d, ...patch }));
  };
  const patchSection = (key, patch) => change({ document: draft.document.map((s) => (s.key === key ? { ...s, ...patch } : s)) });
  const patchField = (key, patch) => change({ fields: { ...draft.fields, [key]: { ...draft.fields[key], ...patch } } });

  const addSection = () => {
    const key = newSectionKey();
    const after = draft.document.findIndex((s) => `section:${s.key}` === active);
    const next = [...draft.document];
    next.splice(after < 0 ? next.length : after + 1, 0, { key, kind: 'text', name: 'بخش تازه', heading: '', rules: [] });
    change({ document: next });
    setActive(`section:${key}`);
  };
  const removeSection = async (section) => {
    const { isConfirmed } = await Swal.fire({
      ...swalTheme,
      icon: 'warning',
      title: 'حذف این بخش؟',
      text: `بخش «${section.name}» و ${section.rules.length} قاعده‌ی آن حذف می‌شوند. تا «ذخیره» نزنید چیزی در پرامپت عوض نمی‌شود.`,
      showCancelButton: true,
      confirmButtonText: 'حذف بخش',
      cancelButtonText: 'لغو',
    });
    if (!isConfirmed) return;
    const next = draft.document.filter((s) => s.key !== section.key);
    change({ document: next });
    setActive(`section:${next[0]?.key}`);
  };
  const restoreAll = async () => {
    const { isConfirmed } = await Swal.fire({
      ...swalTheme,
      icon: 'warning',
      title: 'بازگردانی کلِ پرامپت پایه؟',
      text: 'همه‌ی بخش‌ها، سربرگ‌ها، قواعد فیلدها و قالب‌ها به نقطه‌ی شروع برمی‌گردند و بخش‌های افزوده حذف می‌شوند. گروه‌ها و تنظیمات دسته‌ها دست نمی‌خورند. تا «ذخیره» نزنید چیزی عوض نمی‌شود.',
      showCancelButton: true,
      confirmButtonText: 'بازگردانی',
      cancelButtonText: 'لغو',
    });
    if (!isConfirmed) return;
    setServerErrors({});
    setDraft(fromConfig(PROMPT_SEED));
    setActive(`section:${PROMPT_SEED.document[0].key}`);
  };

  const onSave = async () => {
    setSaving(true);
    const result = await save(payload, 'پرامپت پایه ذخیره شد');
    if (result.ok) {
      // آنچه سرور نگه داشته مبنای «تغییر نکرده» می‌شود؛ تبِ فعال می‌ماند
      setDraft(fromConfig(result.config));
      setSavedPayload(JSON.stringify(toPayload(fromConfig(result.config))));
    } else setServerErrors(result.fieldErrors || {});
    setSaving(false);
  };

  const sectionTab = (s) => ({
    key: `section:${s.key}`,
    title: s.name || 'بی‌نام',
    count: s.kind === 'text' ? s.rules.length : undefined,
    error: hasErrorUnder(`document.${s.key}`),
    note: sectionIsSeed(s) ? '' : 'سفارشی',
  });
  const fieldTabs = PRODUCT_PROMPT_FIELDS.map((f) => ({
    key: `field:${f.key}`,
    title: f.title,
    count: draft.fields[f.key].rules.length,
    error: hasErrorUnder(`fieldRules.${f.key}`),
    note: fieldIsSeed(f.key, draft.fields[f.key]) ? '' : 'سفارشی',
  }));
  const structureTabs = [
    { key: ORDER_TAB, title: 'ترتیب بخش‌ها' },
    { key: TEMPLATES_TAB, title: 'قالب‌های داده', error: hasErrorUnder('templates') },
  ];
  // در نمایشِ همه، تب‌ها فهرستِ پرش به هر بخش‌اند
  const onTab = (key) => {
    setActive(key);
    if (showAll) document.getElementById(`panel-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sectionProps = { canEdit, errors, focusUid, setFocusUid, patchSection, removeSection };
  const fieldProps = { canEdit, errors, focusUid, setFocusUid, patchField };
  const activeField = active.startsWith('field:') ? active.slice(6) : null;
  // پیوندِ کهنه به بخشی که دیگر نیست، اولین بخش را نشان می‌دهد نه پنلِ خالی
  const activeSection = draft.document.find((s) => `section:${s.key}` === active) ?? draft.document[0];

  return (
    <div dir="rtl" className="space-y-5 pb-10">
      <PageHeader
        title="پرامپت پایه"
        subtitle="کلِ متنِ پرامپتِ ساختِ محصول: سربرگ‌ها، قواعد و قالب‌ها — دقیقاً همان‌طور که اینجا نوشته می‌شوند"
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
              <Button variant="secondary" icon={<FiRotateCcw size={14} />} onClick={restoreAll}>بازگردانی کل</Button>
            )}
            {canEdit && (
              <Button icon={<FiSave size={15} />} loading={saving} disabled={!dirty || errorCount > 0} onClick={onSave}>
                ذخیره{dirty ? ' تغییرات' : ''}
              </Button>
            )}
          </>
        }
      />

      {errors.document && <p className="a-card p-3 text-sm font-bold text-red-500">! {errors.document}</p>}
      {errorCount > 0 && <p className="text-xs font-bold text-red-500">{errorCount} خطا — پیش از ذخیره برطرف کنید (تب‌های دارای خطا نقطه‌ی قرمز دارند).</p>}

      <TokenHelp />

      <PromptTabs
        label={showAll ? 'پرش به بخش' : 'بخش‌های پرامپت پایه'}
        active={active}
        onChange={onTab}
        rows={[
          { label: 'بخش‌های قواعد', tabs: draft.document.filter((s) => s.kind !== 'data').map(sectionTab) },
          { label: 'بخش‌های داده‌ای', tabs: draft.document.filter((s) => s.kind === 'data').map(sectionTab) },
          { label: 'فیلدهای محصول', tabs: fieldTabs },
          { label: 'ساختار', tabs: structureTabs },
        ]}
      />
      {canEdit && (
        <button type="button" onClick={addSection} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)]">
          <FiPlus size={14} /> افزودن بخش تازه
        </button>
      )}

      {showAll ? (
        <>
          <PanelHeading>بخش‌های پرامپت</PanelHeading>
          {draft.document.map((s) => <SectionPanel key={s.key} section={s} {...sectionProps} />)}
          <PanelHeading>فیلدهای محصول</PanelHeading>
          {PRODUCT_PROMPT_FIELDS.map((f) => <FieldPanel key={f.key} field={f} state={draft.fields[f.key]} {...fieldProps} />)}
        </>
      ) : active === ORDER_TAB ? (
        <OrderPanel draft={draft} canEdit={canEdit} onMove={(from, to) => change({ document: arrayMove(draft.document, from, to) })} />
      ) : active === TEMPLATES_TAB ? (
        <TemplatesPanel
          templates={draft.templates}
          canEdit={canEdit}
          errors={errors}
          onChange={(key, value) => change({ templates: { ...draft.templates, [key]: value } })}
        />
      ) : activeField ? (
        <FieldPanel tabPanel field={PRODUCT_PROMPT_FIELDS.find((f) => f.key === activeField)} state={draft.fields[activeField]} {...fieldProps} />
      ) : activeSection ? (
        <SectionPanel tabPanel section={activeSection} {...sectionProps} />
      ) : null}
    </div>
  );
}

const PanelHeading = ({ children }) => (
  <h2 className="flex items-center gap-3 pt-2 text-sm font-bold text-gray-500">
    {children}
    <span className="flex-1 h-px bg-gray-200" />
  </h2>
);

const panelA11y = (tabPanel, key) =>
  tabPanel ? { id: 'prompt-tabpanel', role: 'tabpanel', 'aria-labelledby': `tab-${key}` } : { id: `panel-${key}` };

function SectionPanel({ section, tabPanel, canEdit, errors, focusUid, setFocusUid, patchSection, removeSection }) {
  const { key, kind, rules } = section;
  const at = `document.${key}`;
  const seed = seedSection(key);
  const unknown = unknownTokens([section.heading, ...texts(rules)].join('\n'));
  const setRules = (next) => patchSection(key, { rules: next });

  return (
    <section {...panelA11y(tabPanel, `section:${key}`)} className="a-card p-5 space-y-4 scroll-mt-40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-bold text-gray-900">{section.name || 'بی‌نام'}</h3>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {seed && !sectionIsSeed(section) && (
              <Button size="sm" variant="secondary" icon={<FiRotateCcw size={13} />} onClick={() => patchSection(key, toLocalSection(seed))}>
                بازگردانی پیش‌فرض
              </Button>
            )}
            {kind === 'text' && (
              <Button size="sm" variant="secondary" icon={<FiTrash2 size={13} />} onClick={() => removeSection(section)}>حذف بخش</Button>
            )}
          </div>
        )}
      </div>

      <HeadingAccordion
        heading={section.heading}
        onHeading={(heading) => patchSection(key, { heading })}
        name={section.name}
        onName={(name) => patchSection(key, { name })}
        readOnly={!canEdit}
        headingError={errors[`${at}.heading`]}
        nameError={errors[`${at}.name`]}
      />
      <UnknownTokensNote tokens={unknown} />
      {errors[at] && <p className="text-xs font-bold text-red-500">! {errors[at]}</p>}

      {kind === 'fields' && (
        <p className="text-xs font-bold text-gray-500 leading-6">
          فیلدها زیر همین سربرگ می‌آیند و قواعد عمومیِ گروه‌ها درست بالای آن. سربرگ و قواعدِ هر فیلد در تب‌های «فیلدهای محصول» است.
        </p>
      )}
      {kind === 'data' && (
        <p className="flex gap-2 items-start p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-600 leading-6">
          <FiDatabase className="mt-1 shrink-0" size={13} />
          داده‌ی این بخش را برنامه زیرِ سربرگ درج می‌کند و این بخش حذف نمی‌شود؛ فقط سربرگ و جایش در «ترتیب بخش‌ها» با شماست.
        </p>
      )}

      {kind === 'text' && (
        <div className="space-y-3">
          <SortableRuleList
            items={rules}
            getId={(r) => r.uid}
            disabled={!canEdit}
            onMove={(from, to) => setRules(arrayMove(rules, from, to))}
            renderItem={(rule, i, dragHandle) => (
              <RuleCard
                index={i}
                rule={rule}
                readOnly={!canEdit}
                autoFocus={rule.uid === focusUid}
                dragHandle={dragHandle}
                error={errors[`${at}.rules.${i}`]}
                onChange={(text) => setRules(rules.map((r) => (r.uid === rule.uid ? { ...r, text } : r)))}
                onRemove={() => setRules(rules.filter((r) => r.uid !== rule.uid))}
              />
            )}
          />
          {!rules.length && <p className="text-center py-4 text-sm font-bold text-gray-400">این بخش قاعده‌ای ندارد.</p>}
          {canEdit && (
            <AddRuleButton
              onClick={() => {
                const rule = { uid: uid(), text: '' };
                setFocusUid(rule.uid);
                setRules([...rules, rule]);
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}

function FieldPanel({ field, state, tabPanel, canEdit, errors, focusUid, setFocusUid, patchField }) {
  const { key } = field;
  const { heading, rules } = state;
  const at = `fieldRules.${key}`;
  const setRules = (next) => patchField(key, { rules: next });
  const seed = seedField(key);
  return (
    <section {...panelA11y(tabPanel, `field:${key}`)} className="a-card p-5 space-y-4 scroll-mt-40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">{field.title}</h3>
          <p dir="ltr" className="text-xs font-bold text-gray-400 mt-0.5 text-right">{key}</p>
        </div>
        {canEdit && !fieldIsSeed(key, state) && (
          <Button size="sm" variant="secondary" icon={<FiRotateCcw size={13} />} onClick={() => patchField(key, { heading: seed.heading, rules: toRules(seed.rules) })}>
            بازگردانی پیش‌فرض
          </Button>
        )}
      </div>
      <HeadingAccordion
        heading={heading}
        onHeading={(next) => patchField(key, { heading: next })}
        readOnly={!canEdit}
        headingError={errors[`${at}.heading`]}
        hint={<>شناسه‌ی <code dir="ltr" className="px-1 rounded bg-gray-100 font-mono">{key}</code> نامِ این فیلد در مدلِ محصول است و باید در متن بماند؛ هر چیزی می‌توانید دورش بنویسید.</>}
      />
      <UnknownTokensNote tokens={unknownTokens([heading, ...texts(rules)].join('\n'))} />
      <div className="space-y-3">
        <SortableRuleList
          items={rules}
          getId={(r) => r.uid}
          disabled={!canEdit}
          onMove={(from, to) => setRules(arrayMove(rules, from, to))}
          renderItem={(rule, i, dragHandle) => (
            <RuleCard
              index={i}
              rule={rule}
              readOnly={!canEdit}
              autoFocus={rule.uid === focusUid}
              dragHandle={dragHandle}
              error={errors[`${at}.${i}`]}
              onChange={(text) => setRules(rules.map((r) => (r.uid === rule.uid ? { ...r, text } : r)))}
              onRemove={() => setRules(rules.filter((r) => r.uid !== rule.uid))}
            />
          )}
        />
        {!rules.length && <p className="text-center py-4 text-sm font-bold text-gray-400">این فیلد قاعده‌ی پایه ندارد.</p>}
        {errors[at] && <p className="text-xs font-bold text-red-500">! {errors[at]}</p>}
        {canEdit && (
          <AddRuleButton
            onClick={() => {
              const rule = { uid: uid(), text: '' };
              setFocusUid(rule.uid);
              setRules([...rules, rule]);
            }}
          />
        )}
      </div>
    </section>
  );
}

/** ترتیبِ بخش‌ها همان ترتیبشان در پرامپت است. */
function OrderPanel({ draft, canEdit, onMove }) {
  return (
    <section id="prompt-tabpanel" role="tabpanel" aria-labelledby={`tab-${ORDER_TAB}`} className="a-card p-5 space-y-3">
      <h3 className="text-base font-bold text-gray-900">ترتیب بخش‌ها در پرامپت</h3>
      <SortableRuleList
        items={draft.document}
        getId={(s) => s.key}
        disabled={!canEdit}
        onMove={onMove}
        renderItem={(section, i, handle) => (
          <div className="flex items-center gap-2 p-2 mb-2 rounded-xl border border-gray-200 bg-white">
            {handle && (
              <button type="button" {...handle} aria-label={`جابه‌جایی ${section.name}`} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 cursor-grab active:cursor-grabbing touch-none">
                <FiMenu size={14} />
              </button>
            )}
            <span className="w-6 text-center text-xs font-bold text-gray-400">{i + 1}</span>
            <span className="text-sm font-bold text-gray-800">{section.name}</span>
            {section.kind === 'data' && <span className="px-2 py-0.5 rounded bg-gray-100 text-[11px] font-bold text-gray-500">داده‌ای</span>}
            {section.kind === 'fields' && <span className="px-2 py-0.5 rounded bg-gray-100 text-[11px] font-bold text-gray-500">فیلدها</span>}
          </div>
        )}
      />
    </section>
  );
}

/** متنِ سطرهایی که از داده ساخته می‌شوند. فاصله‌ها و خط‌های خالی جزوِ متن‌اند و دست نمی‌خورند. */
function TemplatesPanel({ templates, canEdit, errors, onChange }) {
  return (
    <section id="prompt-tabpanel" role="tabpanel" aria-labelledby={`tab-${TEMPLATES_TAB}`} className="a-card p-5 space-y-6">
      <p className="text-xs font-bold text-gray-500 leading-6">
        این متن‌ها قالبِ سطرهایی‌اند که برنامه از داده می‌سازد؛ آنچه داخلِ {'{{ }}'} است با داده پر می‌شود. فاصله‌ها و خط‌های خالی دقیقاً همان‌طور چاپ می‌شوند و متنِ خالی یعنی چیزی چاپ نشود.
      </p>
      {TEMPLATE_GROUPS.map((group) => (
        <div key={group} className="space-y-4">
          <h3 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2">{group}</h3>
          {TEMPLATE_DEFS.filter((t) => t.group === group).map(({ key, label, tokens, required = [] }) => {
            const value = templates[key] ?? '';
            const seed = PROMPT_SEED.templates[key] ?? '';
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={`template-${key}`} className="text-xs font-bold text-gray-700">{label}</label>
                  {canEdit && value !== seed && (
                    <button type="button" onClick={() => onChange(key, seed)} className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary)]">
                      <FiRotateCcw size={11} /> بازگردانی
                    </button>
                  )}
                </div>
                <textarea
                  id={`template-${key}`}
                  value={value}
                  readOnly={!canEdit}
                  rows={Math.min(14, Math.max(1, value.split('\n').length))}
                  onChange={(e) => onChange(key, e.target.value)}
                  className={`${textareaClass} ${errors[`templates.${key}`] ? 'border-red-400' : 'border-gray-200'}`}
                />
                {tokens.length > 0 && (
                  <p dir="ltr" className="text-right text-[11px] font-mono text-gray-400">
                    {tokens.map((t) => <span key={t} className={required.includes(t) ? 'font-bold text-gray-600' : ''}>{`{{${t}}} `}</span>)}
                  </p>
                )}
                {errors[`templates.${key}`] && <p className="text-xs font-bold text-red-500">! {errors[`templates.${key}`]}</p>}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
