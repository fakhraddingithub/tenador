import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import requireAdmin from "@/lib/requireAdmin";
import Product from "base/models/Product";
import SiteSetting from "base/models/SiteSetting";
import { HOME_SLIDER_KEYS } from "base/services/product.service";
import { revalidateContent } from "@/lib/revalidate";

/**
 * مدیریت اسلایدرهای محصولِ صفحه‌ی اصلی (پرفروش‌ها و پیشنهادهای شگفت‌انگیز).
 *
 * هر اسلایدر فهرستِ مرتب و مستقلی از شناسه‌ی محصولات را در SiteSetting نگه می‌دارد.
 *   GET → خلاصه‌ی محصولاتِ هر دو اسلایدر (مرتب، برای نمایش در پنل)
 *   PUT → ذخیره‌ی فهرستِ مرتبِ یک اسلایدر  { slider, productIds }
 */

// شناسه‌ها → خلاصه‌ی نمایشی، با حفظِ ترتیب و حذفِ محصولاتِ ناموجود/غیرفعال
async function resolveProducts(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const docs = await Product.find({ _id: { $in: ids }, isActive: true })
    .select("_id name mainImage brand")
    .populate("brand", "title name")
    .lean();
  const byId = new Map(docs.map((p) => [String(p._id), p]));
  return ids
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map((p) => ({
      _id: String(p._id),
      label: p.name,
      sub: p.brand?.title || p.brand?.name || "",
      image: p.mainImage || null,
    }));
}

async function readIds(key) {
  const setting = await SiteSetting.findOne({ key }).lean();
  return Array.isArray(setting?.value) ? setting.value.map(String) : [];
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await connectToDB();

    const [bestIds, offerIds] = await Promise.all([
      readIds(HOME_SLIDER_KEYS.bestsellers),
      readIds(HOME_SLIDER_KEYS.offers),
    ]);

    const [bestsellers, offers] = await Promise.all([
      resolveProducts(bestIds),
      resolveProducts(offerIds),
    ]);

    return NextResponse.json({ bestsellers, offers });
  } catch (err) {
    console.error("home-sliders GET error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const { slider, productIds } = await req.json();

    const key = HOME_SLIDER_KEYS[slider];
    if (!key) {
      return NextResponse.json({ error: "نوع اسلایدر معتبر نیست" }, { status: 400 });
    }
    if (!Array.isArray(productIds)) {
      return NextResponse.json({ error: "فهرست محصولات معتبر نیست" }, { status: 400 });
    }

    await connectToDB();

    // فقط شناسه‌های معتبر و یکتا — ترتیب حفظ می‌شود، تکراری‌ها حذف می‌شوند
    const seen = new Set();
    const cleanIds = [];
    for (const id of productIds) {
      const s = String(id);
      if (seen.has(s) || !mongoose.Types.ObjectId.isValid(s)) continue;
      seen.add(s);
      cleanIds.push(s);
    }

    // فقط محصولاتِ موجود و فعال ذخیره می‌شوند تا فهرستِ ذخیره‌شده دقیقاً با آنچه
    // در پنل و صفحه‌ی اصلی نمایش داده می‌شود یکی بماند (حذفِ شناسه‌های نامعتبر/غیرفعال)
    let finalIds = cleanIds;
    if (cleanIds.length) {
      const existing = await Product.find({ _id: { $in: cleanIds }, isActive: true })
        .select("_id")
        .lean();
      const existingSet = new Set(existing.map((p) => String(p._id)));
      finalIds = cleanIds.filter((id) => existingSet.has(id));
    }

    await SiteSetting.findOneAndUpdate(
      { key },
      { value: finalIds },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // باطل‌سازیِ کشِ صفحه‌ی اصلی تا تغییر بلافاصله اعمال شود
    revalidateContent(["products", "home-sliders"]);

    const items = await resolveProducts(finalIds);
    return NextResponse.json({ slider, items });
  } catch (err) {
    console.error("home-sliders PUT error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
