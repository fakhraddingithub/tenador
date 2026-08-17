import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import connectToDB from "base/configs/db";
import SiteSetting from "base/models/SiteSetting";
import Article from "base/models/Article";
import "base/models/registerModels";

import requireAdminPermission, { forbidden } from "@/lib/requireAdminPermission";
import { resolveSiteSettingPermission } from "@/lib/apiPermissions";
import { revalidateContent } from "@/lib/revalidate";
import { publicArticleFilter } from "base/utils/articleRoutes";

// مسیرهایی که با تغییر یک کلید تنظیم باید دوباره ساخته شوند
const REVALIDATE_PATHS = {
  secondhand_header_image: ["/second-hand"],
  home_featured_article_ids: ["/"],
};

// GET /api/admin/site-settings?key=secondhand_header_image  →  { value }
export async function GET(req) {
  // ۱) هویت اول — تا درخواستِ ناشناس ۴۰۱ بگیرد، نه ۴۰۳ ناشی از شکلِ کوئری.
  const identity = await requireAdminPermission();
  if (identity.denied) return identity.denied;

  // ۲) یک endpoint، چند مالک: هر کلیدِ تنظیمات دسترسیِ خودش را دارد و کلیدِ
  //    ناشناخته/غایب fail-closed است (بدون این، «پاداش نظر» به «حساب بانکی»
  //    هم دسترسی می‌داد).
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const resolved = resolveSiteSettingPermission(key, "view");
  if (!resolved.allowed) return forbidden();

  const { denied } = await requireAdminPermission(resolved.permissions, {
    mode: resolved.mode,
  });
  if (denied) return denied;

  try {
    await connectToDB();
    const setting = await SiteSetting.findOne({ key }).lean();
    return NextResponse.json({ value: setting?.value ?? null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PUT /api/admin/site-settings  { key, value }  →  upsert + revalidate
export async function PUT(req) {
  const identity = await requireAdminPermission();
  if (identity.denied) return identity.denied;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است" }, { status: 400 });
  }
  const { key, value } = body || {};

  const resolved = resolveSiteSettingPermission(key, "edit");
  if (!resolved.allowed) return forbidden();

  const { denied } = await requireAdminPermission(resolved.permissions, {
    mode: resolved.mode,
  });
  if (denied) return denied;

  try {
    await connectToDB();

    if (key === "home_featured_article_ids") {
      const articleIds = Array.isArray(value) ? value.map(String) : [];
      if (articleIds.length !== 8 || articleIds.some((id) => !/^[a-f\d]{24}$/i.test(id))) {
        return NextResponse.json(
          { error: "برای هر ۸ جایگاه باید یک مقاله انتخاب شود" },
          { status: 400 }
        );
      }
      if (new Set(articleIds).size !== 8) {
        return NextResponse.json(
          { error: "هر مقاله فقط در یک جایگاه قابل انتخاب است" },
          { status: 400 }
        );
      }
      const publishedCount = await Article.countDocuments({
        _id: { $in: articleIds },
        "cover.url": { $nin: ["", null] },
        ...publicArticleFilter(),
      });
      if (publishedCount !== 8) {
        return NextResponse.json(
          { error: "همه جایگاه‌ها باید شامل مقالات منتشرشده دارای تصویر باشند" },
          { status: 400 }
        );
      }
    }

    const setting = await SiteSetting.findOneAndUpdate(
      { key },
      { value: value ?? null },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    for (const path of REVALIDATE_PATHS[key] || []) {
      try {
        revalidatePath(path);
      } catch {
        // در محیط‌هایی که revalidatePath در دسترس نیست بی‌صدا رد شو
      }
    }
    if (key === "home_featured_article_ids") {
      revalidateContent(["home-featured-articles"]);
    }

    return NextResponse.json({ value: setting.value });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
