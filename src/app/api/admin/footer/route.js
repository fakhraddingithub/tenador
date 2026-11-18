import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import SiteSetting from "base/models/SiteSetting";
import { purgeSportPagesCdn, revalidateContent } from "@/lib/revalidate";
import requireAdminPermission from "@/lib/requireAdminPermission";
import {
  normalizeSiteFooter,
  validateSiteFooter,
  SITE_FOOTER_CACHE_TAG,
  SITE_FOOTER_SETTING_KEY,
} from "@/lib/siteFooter";

export async function GET() {
  const { denied } = await requireAdminPermission("footer.view");
  if (denied) return denied;

  try {
    await connectToDB();
    const setting = await SiteSetting.findOne({ key: SITE_FOOTER_SETTING_KEY }).lean();
    return NextResponse.json({ footer: normalizeSiteFooter(setting?.value), saved: Boolean(setting) });
  } catch (err) {
    console.error("footer GET error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function PUT(req) {
  const { denied } = await requireAdminPermission("footer.edit");
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    const { footer, errors } = validateSiteFooter(body?.footer);
    if (errors.length) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    await connectToDB();
    await SiteSetting.findOneAndUpdate(
      { key: SITE_FOOTER_SETTING_KEY },
      { value: footer },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // فوتر در layoutِ همه‌ی صفحات است: تگِ داده + نسخه‌ی CDNِ صفحه‌های ورزش.
    revalidateContent([SITE_FOOTER_CACHE_TAG]);
    await purgeSportPagesCdn();

    return NextResponse.json({ footer });
  } catch (err) {
    console.error("footer PUT error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
