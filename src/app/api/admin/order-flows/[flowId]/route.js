import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import OrderFlow from "base/models/OrderFlow";

export async function GET(req, { params }) {
  try {
    await connectToDB();
    const {flowId}= await params
    const flow = await OrderFlow.findById(flowId).populate(
      "rootCategory",
      "title name"
    );
    if (!flow)
      return NextResponse.json({ message: "فرایند یافت نشد" }, { status: 404 });
    return NextResponse.json({ flow });
  } catch (error) {
    return NextResponse.json({ message: "خطا در دریافت فرایند" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();
    const {flowId}= await params

    const body = await req.json();
    const { name, description, rootCategory, nodes, edges, isActive } = body;

    const flow = await OrderFlow.findByIdAndUpdate(
      flowId,
      { name, description, rootCategory, nodes, edges, isActive },
      { new: true, runValidators: true }
    ).populate("rootCategory", "title name");

    if (!flow)
      return NextResponse.json({ message: "فرایند یافت نشد" }, { status: 404 });

    return NextResponse.json({ flow });
  } catch (error) {
    return NextResponse.json({ message: "خطا در ویرایش فرایند" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const {flowId}= await params
    const flow = await OrderFlow.findByIdAndDelete(flowId);
    if (!flow)
      return NextResponse.json({ message: "فرایند یافت نشد" }, { status: 404 });
    return NextResponse.json({ message: "فرایند حذف شد" });
  } catch (error) {
    return NextResponse.json({ message: "خطا در حذف فرایند" }, { status: 500 });
  }
}
