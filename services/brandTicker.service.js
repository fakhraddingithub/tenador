/**
 * services/brandTicker.service.js
 *
 * داده‌ی نوار برندها (BrandsTicker). دو حالت:
 *  - getTickerBrands(): همه‌ی برندهایی که لوگو دارند (نوار سراسری در صفحه‌ی اصلی).
 *  - getSportTickerBrands(sportId): فقط برندهایی که در این ورزش دستِ‌کم یک محصولِ
 *    فعال دارند (نوار صفحه‌ی ورزش).
 *
 * فقط سمت سرور اجرا می‌شود و با unstable_cache کش می‌گردد؛ بعد از تغییرِ برند/محصول
 * با تگ‌های "brands"/"products" باطل می‌شود.
 */

import { unstable_cache } from "next/cache";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import Product from "base/models/Product";

const HAS_LOGO = { logo: { $type: "string", $ne: "" } };

function shape(brands) {
  return brands.map((b) => ({
    slug: b.slug,
    logo: b.logo,
    name: b.title || b.name || "",
  }));
}

async function _getTickerBrands() {
  await connectToDB();
  const brands = await Brand.find(HAS_LOGO)
    .select("_id name title slug logo order")
    .sort({ order: 1 })
    .lean();
  return shape(brands);
}

export const getTickerBrands = unstable_cache(
  async () => JSON.parse(JSON.stringify(await _getTickerBrands())),
  ["ticker-brands"],
  { revalidate: 600, tags: ["brands"] }
);

async function _getSportTickerBrands(sportId) {
  if (!sportId) return [];
  await connectToDB();

  let sid;
  try {
    sid = new mongoose.Types.ObjectId(String(sportId));
  } catch {
    return [];
  }

  // برندهایی که در این ورزش دستِ‌کم یک محصولِ فعال دارند
  const brandIds = await Product.distinct("brand", {
    sport: sid,
    isActive: true,
    brand: { $ne: null },
  });
  if (brandIds.length === 0) return [];

  const brands = await Brand.find({ _id: { $in: brandIds }, ...HAS_LOGO })
    .select("_id name title slug logo order")
    .sort({ order: 1 })
    .lean();
  return shape(brands);
}

export const getSportTickerBrands = unstable_cache(
  async (sportId) =>
    JSON.parse(JSON.stringify(await _getSportTickerBrands(sportId))),
  ["sport-ticker-brands"],
  { revalidate: 600, tags: ["brands", "products"] }
);
