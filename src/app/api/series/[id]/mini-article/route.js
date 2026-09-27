import connectToDB from "base/configs/db";
import Serie from "base/models/Serie";
import { NextResponse } from "next/server";
import { purgeSportPagesCdn, revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import { sanitizeArticleBlocks } from "@/lib/articleValidation";
import requireAdminPermission from "@/lib/requireAdminPermission";

/**
 * مینی‌مقاله‌ی یک سری، روی صفحه‌ی خودش — دقیقاً همان قراردادِ بروشورِ برند:
 * GET بلوک‌ها را می‌دهد، PUT جایشان می‌گذارد. داده همان `Serie.articleBlocks`
 * قبلی است (select:false)، پس محتوای موجود بدونِ هیچ مهاجرتی همین‌جا باز می‌شود.
 */
export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("series.edit");
  if (denied) return denied;

  try {
    await connectToDB();
    const { id: serieId } = await params;
    const serie = await Serie.findById(serieId).select("+articleBlocks +articleBlocksBottom name title slug brand").lean();
    if (!serie) return apiError("سری پیدا نشد", 404);
    return NextResponse.json({
      serie: { _id: serie._id, name: serie.name, title: serie.title, slug: serie.slug, brand: serie.brand },
      blocks: serie.articleBlocks || [],
      blocksBottom: serie.articleBlocksBottom || [],
    });
  } catch (error) {
    return handleApiError(error, "خطا در دریافت مینی‌مقاله سری");
  }
}

export async function PUT(req, { params }) {
  const { denied } = await requireAdminPermission("series.edit");
  if (denied) return denied;

  try {
    await connectToDB();
    const { id: serieId } = await params;
    const serie = await Serie.findById(serieId).select("+articleBlocks +articleBlocksBottom");
    if (!serie) return apiError("سری پیدا نشد", 404);

    const body = await req.json();
    const errors = {};
    // undefined ≠ []: نبودِ کلید یعنی «این درخواست درباره‌ی آن بخش نیست». هر بخش
    // جدا سنجیده می‌شود، پس ذخیره‌ی یکی هرگز دیگری را پاک نمی‌کند — همان چیزی
    // که می‌گذارد پیش‌نمایش فقط بخشِ خودش را بفرستد.
    const sections = [["blocks", "articleBlocks"], ["blocksBottom", "articleBlocksBottom"]];
    const touched = sections.filter(([key]) => body?.[key] !== undefined);
    for (const [key, field] of touched) serie[field] = sanitizeArticleBlocks(body[key], errors);
    if (Object.keys(errors).length > 0) return apiError("محتوای مینی‌مقاله معتبر نیست", 400, { fieldErrors: errors });
    if (touched.length) await serie.save();

    revalidateContent(["navbar", "series", "products", "sports"]);
    // صفحه‌ی سری زیرِ مسیرهای ورزشی است و یک ساعت روی CDN کش می‌شود.
    await purgeSportPagesCdn();

    return NextResponse.json({ message: "مینی‌مقاله سری ذخیره شد", blocks: serie.articleBlocks, blocksBottom: serie.articleBlocksBottom });
  } catch (error) {
    return handleApiError(error, "خطا در ذخیره مینی‌مقاله سری");
  }
}
