import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import Category from "base/models/Category";

export async function GET(req, { params }) {
  try {
    await connectToDB();
    const resolvedParams = await params();
    const productId = resolvedParams.productId || resolvedParams.id;

    const variants = await Variant.find({ productId }).lean();

    return NextResponse.json({
      variants,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req, { params }) {
  await connectToDB();

  try {
    const resolvedParams = await params();
    const productId = resolvedParams.productId || resolvedParams.id;
    const body = await req.json();

    const { sku, price, images = [], attributes } = body;

    if (!sku || !price || !attributes) {
      return NextResponse.json(
        { error: "sku, price و attributes الزامی هستند" },
        { status: 400 }
      );
    }

    // پیدا کردن محصول
    const product = await Product.findById(productId).lean();
    if (!product) {
      return NextResponse.json(
        { error: "محصول پیدا نشد" },
        { status: 404 }
      );
    }

    // پیدا کردن کتگوری محصول
    const category = await Category.findById(product.category).lean();
    if (!category) {
      return NextResponse.json(
        { error: "کتگوری محصول یافت نشد" },
        { status: 404 }
      );
    }

    // ولیدیشن داینامیک attributes طبق Category.attributes
    const requiredAttrs = category.attributes
      .filter((a) => a.required)
      .map((a) => a.name);

    const providedAttrs = Object.keys(attributes);

    const missing = requiredAttrs.filter((key) => !providedAttrs.includes(key));

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "attributes ناقص است",
          missing,
        },
        { status: 400 }
      );
    }

    // ساخت واریانت
    const variant = await Variant.create({
      productId,
      categoryId: category._id,
      sku,
      price,
      images,
      attributes,
    });

    // اضافه کردن واریانت به محصول
    await Product.findByIdAndUpdate(productId, {
      $push: { variants: variant._id },
    });

    return NextResponse.json(
      {
        message: "واریانت با موفقیت ایجاد شد",
        variant,
      },
      { status: 201 }
    );
  } catch (err) {
    console.log(err)
    return NextResponse.json(
      { error: "مشکل سمت سرور", detail: err.message },
      { status: 500 }
    );
  }
}
