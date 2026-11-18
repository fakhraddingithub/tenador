import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import SiteSetting from "base/models/SiteSetting";
import {
  normalizeSiteFooter,
  SITE_FOOTER_CACHE_TAG,
  SITE_FOOTER_SETTING_KEY,
} from "@/lib/siteFooter";

// فوتر در همه‌ی صفحات است؛ خطای DB نباید کلِ صفحه را بیندازد — پیش‌فرض نمایش داده می‌شود.
const readFooter = unstable_cache(
  async () => {
    await connectToDB();
    const setting = await SiteSetting.findOne({ key: SITE_FOOTER_SETTING_KEY }).lean();
    return normalizeSiteFooter(setting?.value);
  },
  ["site-footer"],
  { revalidate: 3600, tags: [SITE_FOOTER_CACHE_TAG] }
);

export async function getSiteFooter() {
  try {
    return await readFooter();
  } catch (err) {
    console.error("getSiteFooter error:", err);
    return normalizeSiteFooter(null);
  }
}
