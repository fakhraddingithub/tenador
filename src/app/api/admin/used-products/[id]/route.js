import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import UsedProduct from "base/models/UsedProduct";
import Product from "base/models/Product";
import { validateHealthScores, calcOverallScore } from "@/lib/healthcard";
import Category from "base/models/Category";

export async function GET(_, { params }) {
  try {
    await connectToDB();
    const { id } = await params;
    const item = await UsedProduct.findById(id)
      .populate({
        path: "baseProduct",
        populate: { path: "category" },
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
    const { name, healthScores, customFields, price, description, images, status } = body;

    // 1. پیدا کردن سند
    const usedProduct = await UsedProduct.findById(id);
    if (!usedProduct) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

    // 2. مقداردهی مستقیم فیلدها
    if (name) usedProduct.name = name;
    if (healthScores) usedProduct.healthScores = healthScores;
    if (customFields) usedProduct.customFields = customFields;
    if (price !== undefined) usedProduct.price = price;
    if (description !== undefined) usedProduct.description = description;
    if (images) usedProduct.images = images;
    if (status) usedProduct.status = status;

    // 3. ذخیره سازی (این کار باعث اجرای pre-save و محاسبه امتیاز می‌شود)
    await usedProduct.save();

    // 4. بازگرداندن داده با Populate
    const updated = await UsedProduct.findById(id).populate({
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
