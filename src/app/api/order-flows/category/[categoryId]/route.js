import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import OrderFlow from "base/models/OrderFlow";

// دریافت فرایند سفارش فعال برای یک دسته‌بندی
// اگر فرایندی وجود نداشته باشد، flow: null برمی‌گردد و محصول به صورت عادی به سبد اضافه می‌شود
export async function GET(req, { params }) {
  try {
    await connectToDB();
    const { categoryId } = await params;

    if (!categoryId) {
      return NextResponse.json(
        { message: "شناسه دسته‌بندی الزامی است" },
        { status: 400 }
      );
    }

    const flow = await OrderFlow.findOne({
      rootCategory: categoryId,
      isActive: true,
    })
      .populate("rootCategory", "title name slug")
      .populate("nodes.categoryId", "title name slug")
      .lean();

    // نبود فرایند یک حالت معتبر است، نه خطا
    return NextResponse.json({ flow: flow || null });
  } catch (error) {
    console.error("GET /api/order-flows/category/[categoryId] error:", error);
    return NextResponse.json(
      { message: "خطا در دریافت فرایند سفارش" },
      { status: 500 }
    );
  }
}
