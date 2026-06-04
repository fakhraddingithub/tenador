import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import OrderFlow from "base/models/OrderFlow";

export async function GET(req) {
  try {
    await connectToDB();
    const flows = await OrderFlow.find({})
      .populate("rootCategory", "title name")
      .sort({ createdAt: -1 });
    return NextResponse.json({ flows });
  } catch (error) {
    console.error("GET /api/admin/order-flows error:", error);
    return NextResponse.json({ message: "خطا در دریافت فرایندها" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectToDB();
    const body = await req.json();

    const { name, description, rootCategory, nodes, edges, isActive } = body;

    if (!name || !rootCategory) {
      return NextResponse.json(
        { message: "نام و دسته‌بندی ریشه الزامی است" },
        { status: 400 }
      );
    }

    const flow = await OrderFlow.create({
      name,
      description,
      rootCategory,
      nodes: nodes || [],
      edges: edges || [],
      isActive: isActive !== undefined ? isActive : true,
    });

    await flow.populate("rootCategory", "title name");

    return NextResponse.json({ flow }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/order-flows error:", error);
    return NextResponse.json({ message: "خطا در ایجاد فرایند" }, { status: 500 });
  }
}
