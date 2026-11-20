import "base/models/registerModels";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { PRODUCT_PROMPT_FIELDS } from "@/lib/productPromptConfig";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const FIELD_KEYS = new Set(PRODUCT_PROMPT_FIELDS.map((f) => f.key));
// سه قاعده‌ی تب سفارشی: انتخاب، عنوان و توضیحاتِ هر آیتم
const TAB_PROMPT_PATH = { customTab: "prompt", customTabTitle: "titlePrompt", customTabDescription: "descriptionPrompt" };
const STALE ="این قاعده در این فاصله تغییر کرده است؛ پیش‌نمایش را دوباره بارگذاری کنید";

/** مقدارِ قبلی: "" یعنی «خالی یا ذخیره‌نشده». */
const was = (previous) => (previous === "" ? { $in: [null, ""] } : previous);

/**
 * فیلتر و به‌روزرسانیِ اتمیکِ یک منبعِ پرامپتِ دسته. فیلتر مقدارِ قبلی را هم
 * می‌خواهد (compare-and-set)، پس اگر کسی در این فاصله همان متن را عوض کرده باشد
 * هیچ چیز نوشته نمی‌شود. فقط همان یک مسیر نوشته می‌شود؛ ویژگی‌ها و آیتم‌ها با
 * نام پیدا می‌شوند، نه با اندیس، تا جابه‌جاییِ هم‌زمان قاعده‌ی دیگری را عوض نکند.
 * @returns {{filter, update, options}|{error: string}}
 */
function plan(source, previous, text) {
  switch (source?.kind) {
    case "categoryField": {
      const { field } = source;
      if (!FIELD_KEYS.has(field)) return { error: "فیلدِ ناشناخته" };
      const match = { field, context: was(previous) };
      // متنِ خالی = حذفِ پرامپتِ این فیلد، همان کاری که فرمِ دسته با پرامپتِ خالی می‌کند
      if (!text) return { filter: { prompts: { $elemMatch: match } }, update: { $pull: { prompts: match } } };
      return {
        filter: { prompts: { $elemMatch: match } },
        update: { $set: { "prompts.$[p].context": text } },
        options: { arrayFilters: [{ "p.field": field, "p.context": was(previous) }] },
      };
    }
    case "technicalStats":
      return { filter: { technicalStatsPrompt: was(previous) }, update: { $set: { technicalStatsPrompt: text } } };
    case "attribute":
    case "variantAttribute": {
      const path = source.kind === "attribute" ? "attributes" : "variantAttributes";
      if (typeof source.name !== "string" || !source.name) return { error: "ویژگیِ نامعتبر" };
      return {
        filter: { [path]: { $elemMatch: { name: source.name, prompt: was(previous) } } },
        update: { $set: { [`${path}.$[a].prompt`]: text } },
        options: { arrayFilters: [{ "a.name": source.name, "a.prompt": was(previous) }] },
      };
    }
    case "customTab":
    case "customTabTitle":
    case "customTabDescription": {
      const path = `customTab.${TAB_PROMPT_PATH[source.kind]}`;
      return { filter: { [path]: was(previous) }, update: { $set: { [path]: text } } };
    }
    default:
      return { error: "این منبع از اینجا قابل ویرایش نیست" };
  }
}

// PATCH /api/admin/product-prompts/category-rule
// { categoryId, source: { kind, field? | name? }, previous, text }
// ویرایشِ یک قاعده‌ی متعلق به دسته از صفحه‌ی پیش‌نمایش. فقط همان متن عوض می‌شود.
export async function PATCH(req) {
  const { denied } = await requireAdminPermission("productPrompts.edit");
  if (denied) return denied;

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "بدنه‌ی درخواست نامعتبر است" }, { status: 400 });
  }

  const { categoryId, source, previous, text } = body || {};
  if (!OBJECT_ID.test(String(categoryId ?? ""))) return Response.json({ error: "دسته‌ی نامعتبر" }, { status: 400 });
  if (typeof previous !== "string" || typeof text !== "string") {
    return Response.json({ error: "متنِ قاعده نامعتبر است" }, { status: 400 });
  }
  const planned = plan(source, previous, text.trim());
  if (planned.error) return Response.json({ error: planned.error }, { status: 400 });

  try {
    await connectToDB();
    const result = await Category.updateOne(
      { _id: categoryId, ...planned.filter },
      planned.update,
      planned.options,
    );
    if (!result.matchedCount) {
      const exists = await Category.exists({ _id: categoryId });
      return exists
        ? Response.json({ error: STALE }, { status: 409 })
        : Response.json({ error: "دسته پیدا نشد" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "خطای سرور" }, { status: 500 });
  }
}
