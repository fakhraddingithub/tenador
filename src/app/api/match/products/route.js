import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import { getCachedRate } from "@/lib/Exchangerate";
import { eurToToman } from "@/lib/currency";

export async function GET(request) {
  try {
    await connectToDB();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    if (!categoryId) {
      return NextResponse.json({ error: "شناسه دسته‌بندی الزامی است" }, { status: 400 });
    }

    const products = await Product.find({ category: categoryId, isActive: true })
      .select("name slug mainImage basePrice technicalStats")
      .lean();

    // basePrice به یورو ذخیره شده — تبدیل به تومان سمت سرور
    const rate = await getCachedRate();
    if (!rate) console.warn("Match products API: exchange rate not configured, prices omitted");

    const withPrices = products.map((p) => ({
      ...p,
      priceToman: rate ? eurToToman(p.basePrice, rate) : null,
    }));

    return NextResponse.json({ products: withPrices });
  } catch (error) {
    console.error("Match products API error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
