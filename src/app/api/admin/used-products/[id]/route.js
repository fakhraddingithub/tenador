/**
 * src/app/api/admin/used-products/[id]/route.js
 *
 * GET  → جزئیات یک محصول دست‌دوم
 * PUT  → ویرایش
 * DELETE → حذف (فقط اگه فروخته نشده)
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import UsedProduct from "base/models/UsedProduct";
import Product from "base/models/Product";
import { validateHealthScores, calcOverallScore } from "@/lib/healthcard";
import Category from "base/models/Category";
import { verifyToken } from "base/utils/auth";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded;
}

export async function GET(_, { params }) {
  try {
    await connectToDB();
    const { id } = await params;
    const item = await UsedProduct.findById(id)
      .populate({
        path: "baseProduct",
        populate: { path: "category" },
      })
      .populate({
        path: "order",
        select: "trackingCode paymentStatus fulfillmentStatus totalPrice createdAt",
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
    const admin = await getAdminUser();

    const { id } = await params;
    const body = await req.json();
    const { name, healthScores, customFields, price, description, images, status } = body;

    const usedProduct = await UsedProduct.findById(id);
    if (!usedProduct) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

    if (name)                    usedProduct.name = name;
    if (healthScores)            usedProduct.healthScores = healthScores;
    if (customFields)            usedProduct.customFields = customFields;
    if (price !== undefined)     usedProduct.price = price;
    if (description !== undefined) usedProduct.description = description;
    if (images)                  usedProduct.images = images;

    // تغییر وضعیت با بررسی logic
    if (status) {
      // اگر قراره از reserved به available برگرده، سفارش رو هم null کن
      if (status === "available" && usedProduct.status === "reserved") {
        usedProduct.order = null;
      }
      usedProduct.status = status;
    }

    await usedProduct.save();

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

export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

    const { id } = await params;
    const item = await UsedProduct.findById(id);
    if (!item) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

    if (item.status === "sold")
      return NextResponse.json({ error: "محصول فروخته‌شده قابل حذف نیست" }, { status: 400 });

    await UsedProduct.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}