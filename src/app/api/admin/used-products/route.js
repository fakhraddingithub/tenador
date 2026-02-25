import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import UsedProduct from "base/models/UsedProduct";
import Product from "base/models/Product";
import { validateHealthScores, calcOverallScore } from "@/lib/healthcard";

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
      baseProduct,
      healthScores = [],
      customFields = [],
      price,
      description,
      images,
      status,
    } = body;

    if (!baseProduct) {
      return NextResponse.json(
        { error: "محصول پایه الزامی است" },
        { status: 400 },
      );
    }
    if (price == null || price < 0) {
      return NextResponse.json(
        { error: "قیمت معتبر الزامی است" },
        { status: 400 },
      );
    }

    // Get product's category for validation
    const product = await Product.findById(baseProduct)
      .select("category")
      .lean();
    if (!product) {
      return NextResponse.json(
        { error: "محصول پایه یافت نشد" },
        { status: 404 },
      );
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
      baseProduct,
      healthScores,
      customFields,
      overallScore,
      price,
      description,
      images: images || [],
      status: status || "available",
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
