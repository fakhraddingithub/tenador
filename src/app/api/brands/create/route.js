import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import { registerSlug } from "base/actions/registerSlug";
import { revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import { sanitizeArticleBlocks } from "@/lib/articleValidation";
import requireAdmin from "@/lib/requireAdmin";

export async function POST(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("دسترسی مدیر لازم است", 401);
    await connectToDB();

    const body = await req.json();

    const {
      name,
      title,
      country = null,
      foundedYear = null,
      description = "",
      logo = "",
      icon = "",
      monochromeLogo = "",
      image = "",
      prompts = [],
      articleBlocks = [],
    } = body;

    // validation
    if (!name || !name.trim()) {
      return apiError("«نام انگلیسی برند» الزامی است", 400, {
        fieldErrors: { name: "«نام انگلیسی برند» الزامی است" },
      });
    }

    if (!title || !title.trim()) {
      return apiError("«عنوان فارسی برند» الزامی است", 400, {
        fieldErrors: { title: "«عنوان فارسی برند» الزامی است" },
      });
    }

    const normalizedName = name.trim();

    // check name regex (same as model, fail fast)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(normalizedName)) {
      return apiError(
        "نام انگلیسی باید فقط شامل حروف انگلیسی، اعداد و علائم مجاز (- _) باشد",
        400,
        { fieldErrors: { name: "فرمت نام انگلیسی نامعتبر است" } }
      );
    }


    let sanitizedPrompts = [];
    if (Array.isArray(prompts)) {
      sanitizedPrompts = prompts
        .filter(p => p.field && p.context) // فقط مواردی که هر دو فیلد را دارند نگه دار
        .map(p => ({
          field: p.field.trim(),
          context: p.context.trim()
        }));
    }

    const blockErrors = {};
    const sanitizedArticleBlocks = sanitizeArticleBlocks(articleBlocks, blockErrors);
    if (Object.keys(blockErrors).length > 0) {
      return apiError("بلوک‌های مینی مقاله معتبر نیستند", 400, {
        fieldErrors: blockErrors,
      });
    }

    // duplicate check
    const exists = await Brand.findOne({ name: normalizedName });
    if (exists) {
      return apiError("برندی با این نام قبلاً ثبت شده است", 409, {
        fieldErrors: { name: "برندی با این نام قبلاً ثبت شده است" },
      });
    }

    // create brand (در انتهای ترتیب نمایش قرار می‌گیرد)
    const lastBrand = await Brand.findOne({})
      .sort({ order: -1 })
      .select("order")
      .lean();

    const created = await Brand.create({
      order: (lastBrand?.order ?? -1) + 1,
      name: normalizedName,
      title: title.trim(),
      country,
      foundedYear,
      description: description.trim(),
      logo: logo.trim(),
      icon: icon.trim(),
      monochromeLogo: monochromeLogo.trim(),
      image: image.trim(),
      prompts: sanitizedPrompts,
      articleBlocks: sanitizedArticleBlocks,
    });

    // register slug
    await registerSlug({
      slug: created.slug,
      type: "brand",
      model: "Brand",
      refId: created._id,
      filterField: "brand",
      filterValue: created._id,
      label: created.title,
      parentSlug: null,
    });

    revalidateContent(["navbar", "brands"]);

    return Response.json(
      {
        message: "Brand created successfully",
        brand: created,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, "خطا در ایجاد برند");
  }
}
