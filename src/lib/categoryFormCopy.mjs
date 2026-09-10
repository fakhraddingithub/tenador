/**
 * src/lib/categoryFormCopy.mjs
 *
 * منطقِ خالصِ دو کشویی «دسته والد» و «بارگذاری از دسته دیگر» در فرمِ ساختِ دسته.
 *
 * چرا بیرون از کامپوننت؟ چون «هیچ فیلدی جا نیفتد» یک قرارداد است، نه یک جزئیاتِ
 * رندر: تستِ tests/categoryFormCopy.test.mjs همین‌جا را می‌بندد و اگر روزی فیلدِ
 * تازه‌ای به models/Category.js اضافه شود و در کپی فراموش شود، صدا می‌کند.
 *
 * دو قاعده‌ی متفاوت که نباید با هم قاطی شوند:
 *   - «دسته والد»  → فقط دسته‌های همان ورزشی که در آن می‌سازیم.
 *   - «بارگذاری»   → همه‌ی ورزش‌ها، با نامِ ورزش بعد از نامِ دسته (چند دسته
 *                    هم‌نام‌اند: «راکت» تنیس و «راکت» پدل).
 */

const idOf = (value) => {
  const candidate = value?._id ?? value;
  return candidate === undefined || candidate === null ? "" : String(candidate);
};

export const categorySportId = (category) => idOf(category?.sport);

export const categorySportTitle = (category) =>
  category?.sport?.title || category?.sport?.name || "بدون ورزش";

/**
 * دسته‌های قابل انتخاب به‌عنوان والد در یک ورزش. دسته‌ی اشتراکی (که ورزش در
 * additionalSports آن است) هم واقعاً در ویترینِ همان ورزش دیده می‌شود، پس
 * دقیقاً مثل buildCategorySportMatch سمت سرور اینجا هم به حساب می‌آید.
 * بدون ورزش، والد بی‌معناست و لیست خالی برمی‌گردد.
 */
export function parentCategoryChoices(categories = [], sportId) {
  const target = idOf(sportId);
  if (!target) return [];

  return categories.filter(
    (category) =>
      categorySportId(category) === target ||
      (category.additionalSports || []).some((s) => idOf(s) === target),
  );
}

/**
 * گزینه‌های «بارگذاری از دسته دیگر»: همه‌ی ورزش‌ها، مرتب‌شده بر اساس ورزش و
 * سپس عنوان، با برچسبِ «عنوان دسته — نام ورزش».
 */
export function loadFromCategoryOptions(categories = []) {
  return [...categories]
    .sort(
      (a, b) =>
        categorySportTitle(a).localeCompare(categorySportTitle(b), "fa") ||
        String(a?.title || "").localeCompare(String(b?.title || ""), "fa"),
    )
    .map((category) => ({
      value: idOf(category?._id),
      label: `${category?.title || ""} — ${categorySportTitle(category)}`,
    }));
}

const copyList = (value) => (Array.isArray(value) ? [...value] : []);

/**
 * کلِ داده‌ی دسته‌ی مبدأ را به شکلِ استیتِ فرمِ ساخت برمی‌گرداند.
 *
 * دو فیلد عمداً کپی نمی‌شوند:
 *   - sport  : ورزشِ مقصد همان است که کاربر انتخاب/قفل کرده؛ کلِ هدفِ این قابلیت
 *              ساختِ همان دسته در ورزشِ دیگر است.
 *   - order  : ترتیبِ نمایش را سرور در محدوده‌ی ورزشِ مقصد می‌سازد.
 * و slug که سرور از روی name می‌سازد.
 */
export function buildCategoryCopy(
  source,
  { currentSportId = "", selectableParentIds = [], promptFields = [], newId } = {},
) {
  if (!source) return null;

  const makeId =
    typeof newId === "function"
      ? newId
      : (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 11)}`;

  const currentSport = idOf(currentSportId);
  // مدل، ورزشِ اصلی را در ورزش‌های نمایشی رد می‌کند؛ پس اگر مبدأ آن را داشت حذف می‌شود
  const additionalSports = (source.additionalSports || [])
    .map(idOf)
    .filter((id) => id && id !== currentSport);

  // والد فقط اگر در ورزشِ مقصد هم انتخاب‌شدنی باشد؛ وگرنه یک والدِ بین‌ورزشی
  // ذخیره می‌شد که حتی در کشویی هم دیده نمی‌شود.
  const sourceParentId = idOf(source.parent);
  const parentIds = new Set(selectableParentIds.map(idOf));
  const parent = parentIds.has(sourceParentId) ? sourceParentId : "";

  const copyAttribute = (attr, index, prefix) => ({
    ...attr,
    options: copyList(attr?.options),
    units: copyList(attr?.units),
    id: makeId(prefix),
    order: index + 1,
  });

  return {
    formData: {
      title: source.title || "",
      name: source.name || "",
      additionalSports,
      parent,
      icon: source.icon || "",
      image: source.image || "",
      attributes: (source.attributes || []).map((attr, i) =>
        copyAttribute(attr, i, "attr"),
      ),
      megaMenuFilterAttribute: source.megaMenuFilterAttribute || "",
    },
    variantAttributes: (source.variantAttributes || []).map((attr, i) =>
      copyAttribute(attr, i, "vattr"),
    ),
    technicalStats: (source.technicalStats || []).map((stat) => ({
      ...stat,
      id: makeId("stat"),
    })),
    technicalStatsPrompt: source.technicalStatsPrompt || "",
    customTab: {
      enabled: !!source.customTab?.enabled,
      name: source.customTab?.name || "",
      icon: source.customTab?.icon || "",
      // _id آیتم‌ها کپی نمی‌شود — این‌ها ساب‌داکیومنتِ دسته‌ی تازه‌اند
      items: (source.customTab?.items || []).map((item) => ({
        title: item?.title || "",
        description: item?.description || "",
        link: item?.link || "",
        image: item?.image || "",
      })),
    },
    // کپیِ وفادار: فیلدی که مبدأ برایش پرامپت ندارد خالی می‌شود، وگرنه دسته‌ی
    // تازه پرامپتِ پیش‌فرضی می‌داشت که مبدأ ندارد و کپی، کپی نمی‌بود.
    prompts: promptFields.map((field) => {
      const found = (source.prompts || []).find((p) => p?.field === field);
      return { field, context: found?.context || "" };
    }),
  };
}
