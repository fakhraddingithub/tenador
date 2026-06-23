import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import PageContent from "base/models/PageContent";
import { getPageDefault } from "@/lib/pageDefaults";

/**
 * محتوای یک صفحه‌ی CMS را برمی‌گرداند.
 *
 * منطق ادغام: اگر سندِ منتشرشده‌ای در دیتابیس وجود داشته باشد، sections/seo/title
 * آن جایگزین پیش‌فرض می‌شود؛ در غیر این صورت محتوای پیش‌فرض (src/lib/pageDefaults)
 * سرو می‌شود تا صفحه همیشه کامل و زیبا رندر شود.
 *
 * `accent` (شخصیتِ رنگیِ هر صفحه) همیشه از پیش‌فرض می‌آید.
 */
async function _getPageContent(slug) {
  const fallback = getPageDefault(slug);
  if (!fallback) return null;

  await connectToDB();

  const doc = await PageContent.findOne({ pageSlug: slug, published: true })
    .select("pageSlug title sections seo updatedAt")
    .lean();

  // بدون سند یا بدون بلوک ذخیره‌شده → پیش‌فرض
  const hasContent =
    doc && Array.isArray(doc.sections) && doc.sections.length > 0;

  const sections = hasContent ? doc.sections : fallback.sections;
  const seo = {
    title: doc?.seo?.title || fallback.seo.title,
    description: doc?.seo?.description || fallback.seo.description,
    ogImage: doc?.seo?.ogImage || fallback.seo.ogImage,
  };

  return {
    slug,
    title: doc?.title || fallback.title,
    accent: fallback.accent,
    seo,
    sections: JSON.parse(JSON.stringify(sections)),
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export const getPageContent = unstable_cache(_getPageContent, ["page-content"], {
  revalidate: 300,
  tags: ["pages"],
});

/**
 * نسخه‌ی بدون کش — برای پنل مدیریت که باید آخرین وضعیت (حتی منتشرنشده) را ببیند.
 * sections را همیشه برمی‌گرداند: اگر سندی نباشد، پیش‌فرض را به‌عنوان نقطه‌ی شروع.
 */
export async function getPageForAdmin(slug) {
  const fallback = getPageDefault(slug);
  if (!fallback) return null;

  await connectToDB();
  const doc = await PageContent.findOne({ pageSlug: slug }).lean();

  if (!doc) {
    return {
      slug,
      title: fallback.title,
      accent: fallback.accent,
      seo: { ...fallback.seo },
      sections: JSON.parse(JSON.stringify(fallback.sections)),
      published: true,
      isDefault: true,
      updatedAt: null,
    };
  }

  const sections =
    Array.isArray(doc.sections) && doc.sections.length > 0
      ? doc.sections
      : fallback.sections;

  return {
    slug,
    title: doc.title || fallback.title,
    accent: fallback.accent,
    seo: {
      title: doc.seo?.title || "",
      description: doc.seo?.description || "",
      ogImage: doc.seo?.ogImage || "",
    },
    sections: JSON.parse(JSON.stringify(sections)),
    published: doc.published !== false,
    isDefault: false,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}
