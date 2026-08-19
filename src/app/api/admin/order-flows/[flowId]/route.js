import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import OrderFlow from "base/models/OrderFlow";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { normalizeFlowNodes, validateFlowNodes } from "@/lib/serviceConfig";
import { validateNodeConditions } from "@/lib/flowConditions";

export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("orderFlows.view");
  if (denied) return denied;

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
  const { denied } = await requireAdminPermission("orderFlows.edit");
  if (denied) return denied;

  try {
    await connectToDB();
    const {flowId}= await params

    const body = await req.json();
    const { name, description, rootCategory, edges, isActive } = body;
    const nodes = normalizeFlowNodes(body.nodes);

    const optionErrors = [...validateFlowNodes(nodes), ...validateNodeConditions(nodes)];
    if (optionErrors.length > 0) {
      return NextResponse.json({ message: optionErrors.join(" • ") }, { status: 400 });
    }

    const flow = await OrderFlow.findByIdAndUpdate(
      flowId,
      { name, description, rootCategory, nodes, edges, isActive },
      // returnDocument: "after" جایگزینِ new: true است (رفتار یکسان، بدون هشدارِ deprecation)
      { returnDocument: "after", runValidators: true }
    ).populate("rootCategory", "title name");

    if (!flow)
      return NextResponse.json({ message: "فرایند یافت نشد" }, { status: 404 });

    return NextResponse.json({ flow });
  } catch (error) {
    // بدون این لاگ، هر ۵۰۰ در پروداکشن بدون stack trace بود و ریشه‌یابی ناممکن.
    console.error("PUT /api/admin/order-flows/[flowId] error:", error);
    return NextResponse.json({ message: "خطا در ویرایش فرایند" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("orderFlows.delete");
  if (denied) return denied;

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
