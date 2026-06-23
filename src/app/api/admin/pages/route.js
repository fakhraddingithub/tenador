import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import PageContent from "base/models/PageContent";
import { revalidateContent } from "@/lib/revalidate";
import { PAGE_SLUGS, getPageDefault } from "@/lib/pageDefaults";
import { getPageForAdmin } from "base/services/pageContent.service";

export const runtime = "nodejs";

/**
 * GET /api/admin/pages           → فهرست ۸ صفحه (عنوان، وضعیت، آخرین به‌روزرسانی)
 * GET /api/admin/pages?slug=about → محتوای کاملِ یک صفحه برای ویرایش
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (slug) {
    const page = await getPageForAdmin(slug);
    if (!page)
      return NextResponse.json({ error: "صفحه یافت نشد" }, { status: 404 });
    return NextResponse.json({ page });
  }

  await connectToDB();
  const docs = await PageContent.find({})
    .select("pageSlug title published updatedAt")
    .lean();
  const bySlug = Object.fromEntries(docs.map((d) => [d.pageSlug, d]));

  const pages = PAGE_SLUGS.map((s) => {
    const def = getPageDefault(s);
    const doc = bySlug[s];
    return {
      slug: s,
      title: doc?.title || def?.title || s,
      published: doc ? doc.published !== false : true,
      hasCustomContent: !!doc,
      updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    };
  });

  return NextResponse.json({ pages });
}

/**
 * PUT /api/admin/pages → ذخیره (upsert) محتوای یک صفحه + باطل‌سازی کش
 * body: { slug, title, sections, seo, published }
 */
export async function PUT(req) {
  try {
    const body = await req.json();
    const slug = String(body.slug || "").trim();

    if (!PAGE_SLUGS.includes(slug))
      return NextResponse.json({ error: "اسلاگ نامعتبر" }, { status: 400 });

    if (!Array.isArray(body.sections))
      return NextResponse.json(
        { error: "ساختار بلوک‌ها نامعتبر است" },
        { status: 400 }
      );

    await connectToDB();
    await PageContent.findOneAndUpdate(
      { pageSlug: slug },
      {
        pageSlug: slug,
        title: String(body.title || "").trim(),
        sections: body.sections,
        published: body.published !== false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // باطل‌سازیِ کشِ صفحات (tag «pages») تا تغییرات بلافاصله دیده شوند
    revalidateContent(["pages"]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("SAVE PAGE ERROR:", err);
    return NextResponse.json({ error: "خطا در ذخیره‌سازی" }, { status: 500 });
  }
}
