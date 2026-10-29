import "base/models/registerModels";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import ProductPromptConfig from "base/models/ProductPromptConfig";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { composeProductPrompt } from "@/lib/buildProductTemplate";

// GET /api/admin/product-prompts/preview?categoryId=…
// → { category, updatedAt, model } — همان مدلی که پرامپتِ ساختِ محصول از آن رندر می‌شود
// (composeProductPrompt)، با منبعِ دقیقِ هر قاعده. فهرست‌های داده (برند، سری، ورزشکار…)
// و متنِ خامِ محصول جزوِ مدل نیستند.
export async function GET(req) {
  const { denied } = await requireAdminPermission("productPrompts.view");
  if (denied) return denied;

  const categoryId = new URL(req.url).searchParams.get("categoryId") || "";
  if (!/^[a-f\d]{24}$/i.test(categoryId)) {
    return Response.json({ error: "دسته‌ی نامعتبر" }, { status: 400 });
  }

  try {
    await connectToDB();
    const [category, config] = await Promise.all([
      Category.findById(categoryId).populate({ path: "sport", select: "name title" }).lean(),
      ProductPromptConfig.findOne({ key: "product" }).sort({ createdAt: 1 }).lean(),
    ]);
    if (!category) return Response.json({ error: "دسته پیدا نشد" }, { status: 404 });
    if (!category.sport?._id || !category.sport.name?.trim()) {
      return Response.json(
        { error: "ورزش اصلی این دسته‌بندی معتبر نیست؛ ابتدا ورزش دسته‌بندی را اصلاح کنید" },
        { status: 400 },
      );
    }

    const model = composeProductPrompt({ category, promptConfig: config });
    return Response.json({
      category: {
        _id: String(category._id),
        title: category.title,
        name: category.name,
        sport: { name: category.sport.name, title: category.sport.title },
      },
      updatedAt: config?.updatedAt ? new Date(config.updatedAt).toISOString() : null,
      model: {
        ...model,
        // فقط آنچه پیش‌نمایش لازم دارد — نه کلِ تعریفِ ویژگی
        attributes: model.attributes.map(({ attr, scope, rule }) => ({ name: attr.name, label: attr.label, scope, rule })),
        variants: model.variants.map(({ attr, units, multiUnit, rule }) => ({ name: attr.name, label: attr.label, units, multiUnit, rule })),
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "خطای سرور" }, { status: 500 });
  }
}
