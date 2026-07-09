import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import { revalidateContent } from "@/lib/revalidate";

export async function PUT(req) {
  try {
    await connectToDB();

    const body = await req.json();

    const products = body.products;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid data" },
        { status: 400 }
      );
    }

    // اعتبارسنجی سبک: هر آیتم باید id و order عددی داشته باشد — قبل از هر
    // نوشتنی در دیتابیس رد می‌شود تا داده‌ی ناقص/خراب هیچ رکوردی را دستکاری نکند.
    const isValid = products.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        item.id.length > 0 &&
        Number.isFinite(item.order)
    );

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Invalid data" },
        { status: 400 }
      );
    }

    await Promise.all(
      products.map((item) =>
        Product.findByIdAndUpdate(item.id, {
          order: item.order,
        })
      )
    );

    revalidateContent(["products"]);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Server Error",
      },
      { status: 500 }
    );
  }
}
