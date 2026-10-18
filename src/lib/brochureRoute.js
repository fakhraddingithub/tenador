import connectToDB from "base/configs/db";
import { NextResponse } from "next/server";
import { purgeSportPagesCdn, revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import { sanitizeBrandBrochure } from "@/lib/brandBrochure";
import requireAdminPermission from "@/lib/requireAdminPermission";

/**
 * GET/PUT ـِ بروشور برای هر صاحبی (برند، ورزش) — یک پیاده‌سازی، تا بروشورِ ورزش
 * دقیقاً همان قواعدِ بروشورِ برند را داشته باشد: همان مجوزِ ویرایشِ صاحب، همان
 * پاک‌سازی (sanitizeBrandBrochure → بلوک‌های مقاله + دو وضعیت)، همان پاسخ.
 *
 * GET پیش‌نویس را هم برمی‌گرداند، پس پشتِ مجوزِ ویرایش است؛ نسخه‌ی عمومی فقط از
 * miniArticle.service و فقط با status = published خوانده می‌شود.
 */
export function brochureRouteHandlers({ Model, param, permission, noun, revalidateTags }) {
  const notFound = () => apiError(`${noun} پیدا نشد`, 404);

  async function GET(req, { params }) {
    const { denied } = await requireAdminPermission(permission);
    if (denied) return denied;

    try {
      await connectToDB();
      const id = (await params)[param];
      const doc = await Model.findById(id).select("+brochure name title slug").lean();
      if (!doc) return notFound();
      return NextResponse.json({
        owner: { _id: doc._id, name: doc.name, title: doc.title, slug: doc.slug },
        brochure: doc.brochure || { status: "draft", blocks: [] },
      });
    } catch (error) {
      return handleApiError(error, `خطا در دریافت بروشور ${noun}`);
    }
  }

  async function PUT(req, { params }) {
    const { denied } = await requireAdminPermission(permission);
    if (denied) return denied;

    try {
      await connectToDB();
      const id = (await params)[param];
      const doc = await Model.findById(id).select("+brochure");
      if (!doc) return notFound();

      const errors = {};
      const brochure = sanitizeBrandBrochure(await req.json(), errors);
      if (Object.keys(errors).length > 0) {
        return apiError("محتوای بروشور معتبر نیست", 400, { fieldErrors: errors });
      }
      doc.brochure = brochure;
      await doc.save();

      revalidateContent(revalidateTags);
      // صفحه‌های /[sport]/… (از جمله ریشه‌ی ورزش) یک ساعت روی CDN کش می‌شوند و
      // فقط با برچسبشان پاک می‌شوند؛ صفحه‌ی ریشه‌ی برند کش نمی‌شود ولی پاک‌سازی
      // بی‌ضرر است. خارج از Vercel بی‌اثر است.
      await purgeSportPagesCdn();

      return NextResponse.json({ message: `بروشور ${noun} ذخیره شد`, brochure: doc.brochure });
    } catch (error) {
      return handleApiError(error, `خطا در ذخیره بروشور ${noun}`);
    }
  }

  return { GET, PUT };
}
