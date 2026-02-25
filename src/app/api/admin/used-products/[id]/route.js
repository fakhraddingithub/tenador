import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import UsedProduct from "base/models/UsedProduct";
import Product from "base/models/Product";
import { validateHealthScores, calcOverallScore } from "@/lib/healthcard";

export async function GET(_, { params }) {
  try {
    await connectToDB();
    const { id } = await params;
    const item = await UsedProduct.findById(id)
      .populate({
        path: "baseProduct",
        select: "name mainImage sku category",
        populate: { path: "category", select: "title" },
      })
      .lean();
    if (!item) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();
    const { id } = await params;
    const body = await req.json();
    const {
      healthScores = [],
      customFields = [],
      price,
      description,
      images,
      status,
    } = body;

    if (price != null && price < 0) {
      return NextResponse.json(
        { error: "قیمت معتبر الزامی است" },
        { status: 400 },
      );
    }

    const existing = await UsedProduct.findById(id)
      .select("baseProduct")
      .lean();
    if (!existing)
      return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

    const product = await Product.findById(existing.baseProduct)
      .select("category")
      .lean();

    const validationError = await validateHealthScores(
      product.category,
      healthScores,
    );
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 422 });
    }

    const overallScore = calcOverallScore(healthScores, customFields);

    const updated = await UsedProduct.findByIdAndUpdate(
      id,
      {
        healthScores,
        customFields,
        overallScore,
        price,
        description,
        images,
        status,
      },
      { new: true, runValidators: true },
    ).populate({
      path: "baseProduct",
      select: "name mainImage sku category",
      populate: { path: "category", select: "title" },
    });

    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  try {
    await connectToDB();
    const { id } = await params;
    const item = await UsedProduct.findByIdAndDelete(id);
    if (!item) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
