// src/app/api/admin/variants/route.js

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Variant from "base/models/Variant";

export async function GET(req) {
  try {
    await connectToDB();
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ error: "productId الزامی است" }, { status: 400 });
    }

    const variants = await Variant.find({ productId })
      .select("sku price stock attributes images")
      .lean();

    return NextResponse.json({ variants });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}