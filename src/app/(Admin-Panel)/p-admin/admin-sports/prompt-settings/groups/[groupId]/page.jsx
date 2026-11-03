'use client';

/**
 * صفحه‌ی یک «گروه پرامپت دسته» (groupId = "new" برای ساخت).
 *
 *   قواعد عمومی گروه : بخش‌های خودِ گروه (افزودن/حذف/ویرایش)، مستقل از گروه‌های دیگر؛ برای دسته‌های
 *                      همین گروه جایی می‌آیند که در پرامپت پایه تعیین شده است.
 *   قواعد فیلدها     : هر فیلدِ محصول یک تب دارد: فیلدهای ثابت + فیلدهای پویای دسته‌های این گروه
 *                      (ویژگی‌ها، شاخص‌ها، آیتم‌های تب). خودِ فیلدها مالِ مدیریتِ محصول/دسته‌اند و از
 *                      اینجا کم و زیاد نمی‌شوند؛ فقط قواعدشان. قاعده‌ای که فیلدش از همه‌ی دسته‌های گروه
 *                      حذف شده چیزی را خراب نمی‌کند و در تبِ «فیلدهای ناموجود» دیده می‌شود.
 *
 * ذخیره فقط `groups` را می‌فرستد؛ گروه‌های دیگر همان‌طور که از سرور آمده‌اند فرستاده می‌شوند و
 * updatedAt جلوی بازنویسی را می‌گیرد.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { arrayMove } from '@dnd-kit/sortable';
import { FiArrowRight, FiEdit3, FiLayers, FiPlus, FiSave, FiTrash2 } from 'react-icons/fi';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import {
  AddRuleButton, CategoryPicker, PROMPTS_HOME, PromptTabs, RuleCard, SectionHeadFields, SortableRuleList, TokenHelp, UnknownTokensNote,
  categoryName, errorMap, newSectionKey, storedGroupPayload, swalTheme, uid, usePromptConfig, useUnsavedGuard,
} from '@/components/admin/productPrompts/promptSettingsUi';
import {
  DYNAMIC_FIELD_KINDS, PRODUCT_PROMPT_FIELDS, dynamicFieldKey, fieldTitle, moveWithinSlots, parseFieldKey, unknownTokens, validatePromptConfig,
} from '@/lib/productPromptConfig';

const ORPHAN_TAB = '__orphans';

const localRule = (r) => ({ uid: uid(), text: r.text, categories: [...(r.categories || [])] });

const toLocal = (g) => ({
  title: g?.title || '',
  categories: [...(g?.categories || [])],
  rules: (g?.rules || []).map((r) => ({ ...localRule(r), field: r.field })),
  sections: (g?.sections || []).map((s) => ({ ...s, rules: s.rules.map(localRule) })),
});

const toPayload = (local, _id) => ({
  ...(_id ? { _id } : {}),
  title: local.title,
  categories: local.categories,
  rules: local.rules.map((r) => ({ field: r.field, text: r.text, categories: r.categories })),
  sections: local.sections.map((s) => ({ ...s, rules: s.rules.map((r) => ({ text: r.text, categories: r.categories })) })),
});

const Notice = ({ children }) => (
  <div dir="rtl" className="a-card p-8 text-center space-y-3">
    <p className="text-sm font-bold text-gray-500">{children}</p>
    <Link href={PROMPTS_HOME} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)]">
      <FiArrowRight size={14} /> بازگشت به تنظیمات پرامپت
    </Link>
  </div>
);

export default function PromptGroupPage() {
  const { groupId } = useParams();
  const isNew = groupId === 'new';
  const { can } = useAdminPermissions();
  const canEdit = can('productPrompts.edit');
  const ctx = usePromptConfig();

  if (ctx.loadError) return <div className="a-card p-8 text-center text-sm font-bold text-red-500">{ctx.loadError}</div>;
  if (!ctx.config) return <AdminLoader />;
  if (isNew && !canEdit) return <Notice>برای ساختِ گروه، دسترسی «ویرایش تنظیمات پرامپت» لازم است.</Notice>;
  const stored = isNew ? null : ctx.config.groups.find((g) => g._id === groupId);
  if (!isNew && !stored) return <Notice>این گروه پیدا نشد؛ ممکن است حذف شده باشد.</Notice>;

  return <GroupEditor key={groupId} ctx={ctx} stored={stored} canEdit={canEdit} />;
}

function GroupEditor({ ctx, stored, canEdit }) {
  const router = useRouter();
  const { config, categories, categoryById, knownCategoryIds, save } = ctx;
  const isNew = !stored;
  const groupIdOf = stored?._id;

  const [group, setGroup] = useState(() => toLocal(stored));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(toPayload(toLocal(stored), groupIdOf)));
  // پیوندِ مستقیم به یک تب (مثلاً از پیش‌نمایش): …/groups/<id>#name یا #section:<key>. این
  // ویرایشگر فقط پس از بارگذاریِ تنظیمات و فقط در مرورگر mount می‌شود
  const [active, setActive] = useState(() => decodeURIComponent(window.location.hash.slice(1)) || PRODUCT_PROMPT_FIELDS[0].key);
  const [editCategories, setEditCategories] = useState(!stored?.categories?.length);
  const [focusUid, setFocusUid] = useState(null);
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const mine = toPayload(group, groupIdOf);
  const dirty = JSON.stringify(mine) !== savedJson;
  const leave = useUnsavedGuard(dirty);

  // این گروه در فهرستِ کامل: جایگزینِ نسخه‌ی ذخیره‌شده، یا افزوده به انتها
  const others = config.groups.map(storedGroupPayload);
  const index = isNew ? others.length : config.groups.findIndex((g) => g._id === groupIdOf);
  const groupsPayload = isNew ? [...others, mine] : others.map((g, i) => (i === index ? mine : g));

  // مسیرهای خطای همین گروه، بدونِ پیشوندِ groups.<index>
  const prefix = `groups.${index}`;
  const localErrors = (map) =>
    Object.fromEntries(
      Object.entries(map)
        .filter(([path]) => path === prefix || path.startsWith(`${prefix}.`))
        .map(([path, message]) => [path === prefix ? 'group' : path.slice(prefix.length + 1), message]),
    );
  const clientErrors = localErrors(errorMap(validatePromptConfig({ groups: groupsPayload }, { knownCategoryIds }).errors));
  const errors = { ...localErrors(serverErrors), ...clientErrors };
  const errorCount = Object.keys(clientErrors).length;

  const update = (patch) => {
    setServerErrors({});
    setGroup((g) => ({ ...g, ...patch }));
  };
  const patchRule = (ruleUid, patch) => update({ rules: group.rules.map((r) => (r.uid === ruleUid ? { ...r, ...patch } : r)) });
  const addRule = (field) => {
    const rule = { uid: uid(), field, text: '', categories: [] };
    setFocusUid(rule.uid);
    update({ rules: [...group.rules, rule] });
  };

  // ── بخش‌های عمومیِ گروه
  const patchSection = (key, patch) => update({ sections: group.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)) });
  const addSection = () => {
    const key = newSectionKey();
    update({ sections: [...group.sections, { key, name: 'قواعد عمومی', top: '', title: '', bottom: '', description: '', blankLines: 1, rules: [] }] });
    setActive(`section:${key}`);
  };
  const removeSection = async (section) => {
    const { isConfirmed } = await Swal.fire({
      ...swalTheme,
      icon: 'warning',
      title: 'حذف این بخش؟',
      text: `بخش «${section.name}» و ${section.rules.length} قاعده‌ی آن از این گروه حذف می‌شوند. تا «ذخیره» نزنید چیزی عوض نمی‌شود.`,
      showCancelButton: true,
      confirmButtonText: 'حذف بخش',
      cancelButtonText: 'لغو',
    });
    if (!isConfirmed) return;
    update({ sections: group.sections.filter((s) => s.key !== section.key) });
    setActive(PRODUCT_PROMPT_FIELDS[0].key);
  };

  // ── فیلدهای پویا: اجتماعِ فیلدهای دسته‌های این گروه
  const inGroup = new Set(group.categories);
  const dynamicRows = DYNAMIC_FIELD_KINDS.map(({ kind, title }) => {
    const byName = new Map();
    for (const id of group.categories) {
      for (const f of categoryById.get(id)?.fields?.[kind] || []) {
        if (!byName.has(f.name)) byName.set(f.name, { key: dynamicFieldKey(kind, f.name), title: f.label || f.name });
      }
    }
    return { kind, label: title, fields: [...byName.values()] };
  });
  const offeredFields = new Set([...PRODUCT_PROMPT_FIELDS.map((f) => f.key), ...dynamicRows.flatMap((row) => row.fields.map((f) => f.key))]);

  const indexed = group.rules.map((r, i) => ({ r, i }));
  const orphanRules = indexed.filter(({ r }) => !offeredFields.has(r.field));
  const activeSection = active.startsWith('section:') ? group.sections.find((s) => `section:${s.key}` === active) : null;
  // هشِ کهنه (فیلدی که دیگر در این گروه نیست) به اولین فیلد برمی‌گردد
  const activeField = active === ORPHAN_TAB || offeredFields.has(active) ? active : PRODUCT_PROMPT_FIELDS[0].key;
  const tabRules = activeField === ORPHAN_TAB ? orphanRules : indexed.filter(({ r }) => r.field === activeField);
  const deletedCount = group.categories.filter((id) => !categoryById.has(id)).length;
  const name = group.title.trim() || (isNew ? 'گروهِ تازه' : group.categories.map((id) => categoryName(categoryById, id)).join('، '));

  const onSave = async () => {
    setSaving(true);
    const result = await save({ groups: groupsPayload }, isNew ? 'گروه ساخته شد' : 'گروه ذخیره شد');
    setSaving(false);
    if (!result.ok) return setServerErrors(result.fieldErrors || {});
    if (isNew) {
      const created = result.config.groups[result.config.groups.length - 1];
      setSavedJson(JSON.stringify(mine)); // جلوی هشدارِ «تغییرات ذخیره نشده» هنگامِ رفتن
      router.replace(`${PROMPTS_HOME}/groups/${created._id}`);
      return;
    }
    const fresh = result.config.groups.find((g) => g._id === groupIdOf);
    setGroup(toLocal(fresh));
    setSavedJson(JSON.stringify(toPayload(toLocal(fresh), groupIdOf)));
  };

  const onDelete = async () => {
    const { isConfirmed } = await Swal.fire({
      ...swalTheme,
      icon: 'warning',
      title: 'حذف این گروه؟',
      text: `گروه «${name}» و ${group.rules.length} قاعده‌ی آن حذف می‌شوند.`,
      showCancelButton: true,
      confirmButtonText: 'حذف گروه',
      cancelButtonText: 'لغو',
    });
    if (!isConfirmed) return;
    const result = await save({ groups: others.filter((g) => g._id !== groupIdOf) }, 'گروه حذف شد');
    if (result.ok) {
      setSavedJson(JSON.stringify(mine));
      router.push(PROMPTS_HOME);
    }
  };

  const ruleError = (i) => errors[`rules.${i}`];
  const fieldTab = (f) => ({
    key: f.key,
    title: f.title,
    count: indexed.filter(({ r }) => r.field === f.key).length,
    error: indexed.some(({ r, i }) => r.field === f.key && ruleError(i)),
  });
  const rows = [
    {
      label: 'قواعد عمومی گروه',
      tabs: group.sections.map((s, n) => ({
        key: `section:${s.key}`,
        title: s.name || 'بی‌نام',
        count: s.rules.length,
        error: Object.keys(errors).some((p) => p.startsWith(`sections.${n}.`) || p === `sections.${n}`),
      })),
    },
    { label: 'فیلدهای ثابت', tabs: PRODUCT_PROMPT_FIELDS.map(fieldTab) },
    ...dynamicRows.filter((row) => row.fields.length).map((row) => ({ label: row.label, tabs: row.fields.map(fieldTab) })),
  ];
  if (orphanRules.length) {
    rows.push({
      label: 'ناموجود',
      tabs: [{ key: ORPHAN_TAB, title: 'فیلدهای ناموجود', count: orphanRules.length, error: orphanRules.some(({ i }) => ruleError(i)) }],
    });
  }

  const activeParsed = parseFieldKey(activeField);
  const dynamicActive = Boolean(activeParsed) && activeParsed.kind !== 'fixed';
  const categoryHasField = (id, field) => {
    const parsed = parseFieldKey(field);
    if (!parsed || parsed.kind === 'fixed') return true;
    return (categoryById.get(id)?.fields?.[parsed.kind] || []).some((f) => f.name === parsed.name);
  };
  const activeTabKey = activeSection ? active : activeField;

  return (
    <div dir="rtl" className="space-y-5 pb-10">
      <PageHeader
        title={isNew ? 'گروه پرامپت دسته‌ی جدید' : name}
        subtitle="قواعدِ مشترکِ دسته‌های این گروه: قواعد عمومی و قواعدِ هر فیلدِ محصول"
        icon={<FiLayers size={18} />}
        actions={
          <>
            <button type="button" onClick={() => leave(PROMPTS_HOME)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-500 hover:text-[var(--color-primary)]">
              <FiArrowRight size={14} /> تنظیمات پرامپت
            </button>
            {canEdit && !isNew && (
              <Button variant="secondary" icon={<FiTrash2 size={14} />} onClick={onDelete}>حذف گروه</Button>
            )}
            {canEdit && (
              <Button icon={<FiSave size={15} />} loading={saving} disabled={!dirty || errorCount > 0} onClick={onSave}>
                {isNew ? 'ساخت گروه' : `ذخیره${dirty ? ' تغییرات' : ''}`}
              </Button>
            )}
          </>
        }
      />

      {/* عنوان و دسته‌ها */}
      <section className="a-card p-5 grid md:grid-cols-[1fr_2fr] gap-5">
        <label className="block">
          <span className="block text-sm font-bold text-gray-700 mb-1.5">عنوان گروه (اختیاری)</span>
          <input
            value={group.title}
            readOnly={!canEdit}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="مثلاً راکت‌ها"
            className="w-full px-3 py-2 text-sm font-bold rounded-xl border-2 border-gray-200 bg-gray-50 outline-none focus:bg-white focus:border-[var(--color-primary)]"
          />
          {errors.title && <p className="mt-1 text-xs font-bold text-red-500">! {errors.title}</p>}
        </label>
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-sm font-bold text-gray-700">دسته‌های این گروه ({group.categories.length})</span>
            {canEdit && group.categories.length > 0 && (
              <button type="button" onClick={() => setEditCategories((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary)]">
                <FiEdit3 size={12} /> {editCategories ? 'بستنِ فهرست' : 'ویرایش دسته‌ها'}
              </button>
            )}
          </div>
          <CategoryPicker
            selected={group.categories}
            categories={categories}
            categoryById={categoryById}
            readOnly={!canEdit || !editCategories}
            error={errors.categories}
            onChange={(next) => update({ categories: next })}
          />
          {deletedCount > 0 && (
            <p className="mt-2 text-xs font-bold text-amber-600">{deletedCount} دسته‌ی این گروه حذف شده است؛ قاعده‌هایی که فقط آن‌ها را هدف گرفته‌اند روی هیچ محصولی اعمال نمی‌شوند.</p>
          )}
          {errors.group && <p className="mt-2 text-xs font-bold text-red-500">! {errors.group}</p>}
        </div>
      </section>

      {!group.categories.length ? (
        <p className="a-card p-6 text-center text-sm font-bold text-gray-400">ابتدا دسته‌های گروه را انتخاب کنید تا فیلدهای محصول نمایش داده شوند.</p>
      ) : (
        <>
          <TokenHelp />
          <PromptTabs label="قواعد گروه" active={activeTabKey} onChange={setActive} rows={rows} />
          {canEdit && (
            <button type="button" onClick={addSection} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)]">
              <FiPlus size={14} /> افزودن بخش قواعد عمومی
            </button>
          )}

          {activeSection ? (
            <GroupSectionPanel
              section={activeSection}
              sectionIndex={group.sections.indexOf(activeSection)}
              group={group}
              inGroup={inGroup}
              categoryById={categoryById}
              canEdit={canEdit}
              errors={errors}
              focusUid={focusUid}
              setFocusUid={setFocusUid}
              patchSection={patchSection}
              removeSection={removeSection}
            />
          ) : (
            <section id="prompt-tabpanel" role="tabpanel" aria-labelledby={`tab-${activeField}`} className="a-card p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">{activeField === ORPHAN_TAB ? 'فیلدهای ناموجود' : fieldTitle(activeField)}</h2>
                <p className="text-xs font-bold text-gray-500 mt-1 leading-6">
                  {activeField === ORPHAN_TAB
                    ? 'فیلدِ این قاعده‌ها در هیچ‌کدام از دسته‌های گروه نیست (حذف یا تغییر نام داده شده) و روی هیچ محصولی اثر ندارند. می‌توانید ویرایش یا حذفشان کنید.'
                    : dynamicActive
                      ? 'این فیلد در تعریفِ دسته‌هاست و قاعده‌اش فقط روی دسته‌هایی اعمال می‌شود که این فیلد را دارند. قاعده‌ی بدونِ انتخابِ دسته روی همه‌ی آن‌ها می‌آید.'
                      : 'قاعده‌ی بدونِ انتخابِ دسته روی همه‌ی دسته‌های این گروه اعمال می‌شود؛ با انتخابِ دسته فقط روی همان‌ها.'}
                </p>
              </div>
              <UnknownTokensNote tokens={unknownTokens(tabRules.map(({ r }) => r.text).join('\n'))} />

              <div className="space-y-3">
                {/* جابه‌جایی فقط میانِ قواعدِ همین تب؛ قواعدِ فیلدهای دیگر سرِ جایشان می‌مانند */}
                <SortableRuleList
                  items={tabRules}
                  getId={({ r }) => r.uid}
                  disabled={!canEdit}
                  onMove={(from, to) => update({ rules: moveWithinSlots(group.rules, tabRules.map(({ i }) => i), from, to) })}
                  renderItem={({ r, i }, n, dragHandle) => (
                    <RuleCard
                      index={n}
                      dragHandle={dragHandle}
                      rule={r}
                      readOnly={!canEdit}
                      autoFocus={r.uid === focusUid}
                      error={ruleError(i)}
                      onChange={(text) => patchRule(r.uid, { text })}
                      onRemove={() => update({ rules: group.rules.filter((x) => x.uid !== r.uid) })}
                    >
                      {activeField === ORPHAN_TAB && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded bg-gray-100 text-[11px] font-bold text-gray-600">{fieldTitle(r.field)}</span>
                      )}
                      <RuleTargets
                        rule={r}
                        onChange={(next) => patchRule(r.uid, { categories: next })}
                        chooseFrom={group.categories.filter((id) => categoryHasField(id, r.field) || r.categories.includes(id))}
                        inGroup={inGroup}
                        categoryById={categoryById}
                        canEdit={canEdit}
                      />
                    </RuleCard>
                  )}
                />
                {!tabRules.length && <p className="text-center py-6 text-sm font-bold text-gray-400">برای این فیلد هنوز قاعده‌ای در این گروه نیست.</p>}
                {canEdit && activeField !== ORPHAN_TAB && <AddRuleButton onClick={() => addRule(activeField)} label={`افزودن قاعده برای ${fieldTitle(activeField)}`} />}
              </div>
            </section>
          )}
        </>
      )}
      {errorCount > 0 && <p className="text-xs font-bold text-red-500">{errorCount} خطا — پیش از ذخیره برطرف کنید (تب‌های دارای خطا نقطه‌ی قرمز دارند).</p>}
    </div>
  );
}

/** دسته‌هایی که یک قاعده رویشان اعمال می‌شود. قاعده هرگز به «همه» گسترش بی‌صدا پیدا نمی‌کند. */
function RuleTargets({ rule, onChange, chooseFrom, inGroup, categoryById, canEdit }) {
  const stale = rule.categories.filter((id) => !inGroup.has(id));
  const disabled = rule.categories.length > 0 && rule.categories.every((id) => !categoryById.has(id));
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold text-gray-400">اعمال روی:</span>
        {chooseFrom.map((id) => {
          const on = rule.categories.includes(id);
          return (
            <button
              key={id}
              type="button"
              disabled={!canEdit}
              aria-pressed={on}
              onClick={() => onChange(on ? rule.categories.filter((x) => x !== id) : [...rule.categories, id])}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                on ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white text-gray-500 border-gray-200 hover:border-[var(--color-primary)]'
              }`}
            >
              {categoryName(categoryById, id)}
            </button>
          );
        })}
        {stale.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200">
            {categoryName(categoryById, id)} (خارج از گروه)
            {canEdit && (
              <button type="button" aria-label="برداشتن" onClick={() => onChange(rule.categories.filter((x) => x !== id))}>×</button>
            )}
          </span>
        ))}
        {!rule.categories.length && <span className="text-[11px] font-bold text-[var(--color-primary)]">همه‌ی دسته‌های گروه</span>}
      </div>
      {disabled && <p className="mt-1 text-xs font-bold text-amber-600">این قاعده غیرفعال است: همه‌ی دسته‌های هدفش حذف شده‌اند.</p>}
    </>
  );
}

function GroupSectionPanel({ section, sectionIndex, group, errors, focusUid, setFocusUid, patchSection, removeSection, inGroup, categoryById, canEdit }) {
  const at = `sections.${sectionIndex}`;
  const { key, rules } = section;
  const headErrors = Object.fromEntries(
    ['name', 'title', 'top', 'bottom', 'description', 'blankLines'].map((part) => [part, errors[`${at}.${part}`]]),
  );
  const setRules = (next) => patchSection(key, { rules: next });
  const unknown = unknownTokens([section.top, section.title, section.bottom, section.description, ...rules.map((r) => r.text)].join('\n'));

  return (
    <section id="prompt-tabpanel" role="tabpanel" aria-labelledby={`tab-section:${key}`} className="a-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">{section.name || 'بی‌نام'}</h2>
          <p className="text-xs font-bold text-gray-500 mt-1 leading-6">
            مخصوص همین گروه. برای دسته‌های این گروه در جای «قواعد عمومی گروه‌ها» (در ترتیب بخش‌های پرامپت پایه) می‌آید.
          </p>
        </div>
        {canEdit && <Button size="sm" variant="secondary" icon={<FiTrash2 size={13} />} onClick={() => removeSection(section)}>حذف بخش</Button>}
      </div>
      <SectionHeadFields section={section} readOnly={!canEdit} errors={headErrors} onChange={(patch) => patchSection(key, patch)} />
      <UnknownTokensNote tokens={unknown} />
      {errors[at] && <p className="text-xs font-bold text-red-500">! {errors[at]}</p>}
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
              dragHandle={dragHandle}
              readOnly={!canEdit}
              autoFocus={rule.uid === focusUid}
              error={errors[`${at}.rules.${i}`]}
              onChange={(text) => setRules(rules.map((r) => (r.uid === rule.uid ? { ...r, text } : r)))}
              onRemove={() => setRules(rules.filter((r) => r.uid !== rule.uid))}
            >
              <RuleTargets
                rule={rule}
                onChange={(next) => setRules(rules.map((r) => (r.uid === rule.uid ? { ...r, categories: next } : r)))}
                chooseFrom={group.categories}
                inGroup={inGroup}
                categoryById={categoryById}
                canEdit={canEdit}
              />
            </RuleCard>
          )}
        />
        {!rules.length && <p className="text-center py-4 text-sm font-bold text-gray-400">این بخش قاعده‌ای ندارد.</p>}
        {canEdit && (
          <AddRuleButton
            onClick={() => {
              const rule = { uid: uid(), text: '', categories: [] };
              setFocusUid(rule.uid);
              setRules([...rules, rule]);
            }}
          />
        )}
      </div>
    </section>
  );
}
