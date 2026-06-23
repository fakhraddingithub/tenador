import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import connectToDB from "base/configs/db";
import UsedProduct from "base/models/UsedProduct";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import { validateHealthScores, calcOverallScore } from "@/lib/healthcard";
import { broadcastPush } from "@/lib/push";

// trailing slash را حذف می‌کنیم تا URLها به //path تبدیل نشوند
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");
// آیکن نوتیفیکیشن باید PNG باشد — مرورگرها SVG را به‌عنوان آیکن نوتیفیکیشن رندر نمی‌کنند
const NOTIF_ICON_URL = `${SITE_URL}/android-chrome-192x192.png`;

export async function GET(req) {
  try {
    await connectToDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 20;

    const query = {};
    if (status === "available" || status === "sold") query.status = status;

    const [items, total] = await Promise.all([
      UsedProduct.find(query)
        .populate({
          path: "baseProduct",
          select: "name mainImage category sku",
          populate: { path: "category", select: "title" },
        })
        .populate({
          path: "baseVariant",
          select: "size color sku price",
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UsedProduct.countDocuments(query),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectToDB();
    const body = await req.json();
    const {
      name,
      baseProduct,
      baseVariant = null,
      healthScores = [],
      customFields = [],
      price,
      description,
      images,
      status,
      tested = false,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "نام محصول را وارد کنید" }, { status: 400 });
    }
    if (!baseProduct) {
      return NextResponse.json({ error: "محصول پایه الزامی است" }, { status: 400 });
    }
    if (price == null || price < 0) {
      return NextResponse.json({ error: "قیمت معتبر الزامی است" }, { status: 400 });
    }

    const product = await Product.findById(baseProduct)
      .select("category variants")
      .lean();
    if (!product) {
      return NextResponse.json({ error: "محصول پایه یافت نشد" }, { status: 404 });
    }

    // اگر واریانت ارسال شده، بررسی کن متعلق به همین محصول باشه
    if (baseVariant) {
      const variantExists = product.variants.some(
        (v) => v.toString() === baseVariant,
      );
      if (!variantExists) {
        return NextResponse.json(
          { error: "واریانت انتخاب‌شده متعلق به محصول پایه نیست" },
          { status: 422 },
        );
      }
    }

    const validationError = await validateHealthScores(
      product.category,
      healthScores,
    );
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 422 });
    }

    const overallScore = calcOverallScore(healthScores, customFields);

    const item = await UsedProduct.create({
      name,
      baseProduct,
      baseVariant,
      healthScores,
      customFields,
      overallScore,
      price,
      description,
      images: images || [],
      status: status || "available",
      tested: !!tested,
    });

    try { revalidatePath("/second-hand"); } catch {}

    // ─── ارسال Web Push به همهٔ مشترکین (فقط برای محصولاتِ available) ───
    // fire-and-forget: با after() بعد از ارسالِ پاسخ اجرا می‌شود تا save ادمین را بلاک نکند،
    // اما روی Vercel/serverless هم تا پایان کامل ادامه می‌یابد.
    if (item.status === "available") {
      const briefDesc =
        (item.description && item.description.trim()) ||
        "همین حالا در بازار دست‌دوم تنادور ببینید";
      const productUrl = item.slug
        ? `${SITE_URL}/second-hand/${encodeURIComponent(item.slug)}`
        : `${SITE_URL}/second-hand`;

      after(async () => {
        try {
          await broadcastPush({
            title: "محصول دست دوم جدید در تنادور",
            body: `${item.name} — ${briefDesc}`,
            icon: NOTIF_ICON_URL,
            url: productUrl,
            tag: `used-${item._id}`,
            data: { usedProductId: String(item._id) },
          });
        } catch (pushErr) {
          console.error("[used-products] push broadcast failed:", pushErr);
        }
      });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}