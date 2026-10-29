'use client';

/**
 * صفحه‌ی یک «گروه پرامپت دسته» (groupId = "new" برای ساخت).
 *
 * فقط فیلدهای بخشِ «تنظیمات هوش مصنوعی» فرمِ دسته تب دارند (CATEGORY_PROMPT_FIELDS)
 * و هر تب فقط قواعدِ همان فیلد را نشان می‌دهد. قاعده‌ای که پیش‌تر برای فیلدِ دیگری
 * ذخیره شده دست‌نخورده می‌ماند و در تبِ جداگانه‌ی «فیلدهای دیگر» دیده و ویرایش
 * می‌شود؛ قاعده‌ی تازه برای آن فیلدها ساخته نمی‌شود.
 *
 * ذخیره فقط `groups` را می‌فرستد (پرامپت پایه دست‌نخورده می‌ماند)؛ گروه‌های دیگر
 * همان‌طور که از سرور آمده‌اند فرستاده می‌شوند و updatedAt جلوی بازنویسی را می‌گیرد.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { FiArrowRight, FiEdit3, FiLayers, FiSave, FiTrash2 } from 'react-icons/fi';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import {
  AddRuleButton, CategoryPicker, PROMPTS_HOME, PromptTabs, RuleCard, categoryName, errorMap,
  storedGroupPayload, swalTheme, uid, usePromptConfig, useUnsavedGuard,
} from '@/components/admin/productPrompts/promptSettingsUi';
import { GROUP_PROMPT_FIELDS, fieldTitle, isLegacyGroupField, validatePromptConfig } from '@/lib/productPromptConfig';

const LEGACY_TAB = '__legacy';

const toLocal = (g) => ({
  title: g?.title || '',
  categories: [...(g?.categories || [])],
  rules: (g?.rules || []).map((r) => ({ uid: uid(), field: r.field, text: r.text, categories: [...r.categories] })),
});

const toPayload = (local, _id) => ({
  ...(_id ? { _id } : {}),
  title: local.title,
  categories: local.categories,
  rules: local.rules.map((r) => ({ field: r.field, text: r.text, categories: r.categories })),
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
  // پیوندِ مستقیم به تبِ یک فیلد (مثلاً از پیش‌نمایش): …/groups/<id>#name — این
  // ویرایشگر فقط پس از بارگذاریِ تنظیمات و فقط در مرورگر mount می‌شود
  const [active, setActive] = useState(() => {
    const key = decodeURIComponent(window.location.hash.slice(1));
    if (GROUP_PROMPT_FIELDS.some((f) => f.key === key)) return key;
    return isLegacyGroupField(key) ? LEGACY_TAB : GROUP_PROMPT_FIELDS[0].key;
  });
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

  const indexed = group.rules.map((r, i) => ({ r, i }));
  const legacyRules = indexed.filter(({ r }) => isLegacyGroupField(r.field));
  const tabRules = active === LEGACY_TAB ? legacyRules : indexed.filter(({ r }) => r.field === active);
  const inGroup = new Set(group.categories);
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
  const fieldHasError = (key) => indexed.some(({ r, i }) => (key === LEGACY_TAB ? isLegacyGroupField(r.field) : r.field === key) && ruleError(i));
  const tabs = GROUP_PROMPT_FIELDS.map((f) => ({
    key: f.key,
    title: f.title,
    count: indexed.filter(({ r }) => r.field === f.key).length,
    error: fieldHasError(f.key),
  }));
  if (legacyRules.length) {
    tabs.push({ key: LEGACY_TAB, title: 'فیلدهای دیگر (قدیمی)', count: legacyRules.length, error: fieldHasError(LEGACY_TAB) });
  }

  return (
    <div dir="rtl" className="space-y-5 pb-10">
      <PageHeader
        title={isNew ? 'گروه پرامپت دسته‌ی جدید' : name}
        subtitle="قواعدِ مشترکِ دسته‌های این گروه — بعد از پرامپت پایه و پیش از پرامپتِ خودِ هر دسته"
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
          <PromptTabs label="فیلدهای محصول" active={active} onChange={setActive} rows={[{ label: 'فیلدهای محصول', tabs }]} />

          <section id="prompt-tabpanel" role="tabpanel" aria-labelledby={`tab-${active}`} className="a-card p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">{active === LEGACY_TAB ? 'قواعدِ فیلدهای دیگر' : fieldTitle(active)}</h2>
              <p className="text-xs font-bold text-gray-500 mt-1 leading-6">
                {active === LEGACY_TAB
                  ? 'این قاعده‌ها پیش از محدود شدنِ گروه‌ها به فیلدهای «تنظیمات هوش مصنوعی» دسته ذخیره شده‌اند و همچنان در پرامپت اعمال می‌شوند. می‌توانید ویرایش یا حذفشان کنید؛ قاعده‌ی تازه برای این فیلدها ساخته نمی‌شود.'
                  : 'قاعده‌ی بدونِ انتخابِ دسته روی همه‌ی دسته‌های این گروه اعمال می‌شود؛ با انتخابِ دسته فقط روی همان‌ها.'}
              </p>
            </div>

            <div className="space-y-3">
              {tabRules.map(({ r, i }, n) => {
                const stale = r.categories.filter((id) => !inGroup.has(id));
                const disabled = r.categories.length > 0 && r.categories.every((id) => !categoryById.has(id));
                return (
                  <RuleCard
                    key={r.uid}
                    index={n}
                    rule={r}
                    readOnly={!canEdit}
                    autoFocus={r.uid === focusUid}
                    error={ruleError(i)}
                    onChange={(text) => patchRule(r.uid, { text })}
                    onRemove={() => update({ rules: group.rules.filter((x) => x.uid !== r.uid) })}
                  >
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {active === LEGACY_TAB && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-[11px] font-bold text-gray-600">{fieldTitle(r.field)} · {r.field}</span>
                      )}
                      <span className="text-[11px] font-bold text-gray-400">اعمال روی:</span>
                      {group.categories.map((id) => {
                        const on = r.categories.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={!canEdit}
                            aria-pressed={on}
                            onClick={() => patchRule(r.uid, { categories: on ? r.categories.filter((x) => x !== id) : [...r.categories, id] })}
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
                            <button type="button" aria-label="برداشتن" onClick={() => patchRule(r.uid, { categories: r.categories.filter((x) => x !== id) })}>×</button>
                          )}
                        </span>
                      ))}
                      {!r.categories.length && <span className="text-[11px] font-bold text-[var(--color-primary)]">همه‌ی دسته‌های گروه</span>}
                    </div>
                    {disabled && <p className="mt-1 text-xs font-bold text-amber-600">این قاعده غیرفعال است: همه‌ی دسته‌های هدفش حذف شده‌اند.</p>}
                  </RuleCard>
                );
              })}
              {!tabRules.length && <p className="text-center py-6 text-sm font-bold text-gray-400">برای این فیلد هنوز قاعده‌ای در این گروه نیست.</p>}
              {canEdit && active !== LEGACY_TAB && <AddRuleButton onClick={() => addRule(active)} label={`افزودن قاعده برای ${fieldTitle(active)}`} />}
            </div>
          </section>
        </>
      )}
      {errorCount > 0 && <p className="text-xs font-bold text-red-500">{errorCount} خطا — پیش از ذخیره برطرف کنید (تب‌های دارای خطا نقطه‌ی قرمز دارند).</p>}
    </div>
  );
}
