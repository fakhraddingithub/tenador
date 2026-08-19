import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import OrderFlow from "base/models/OrderFlow";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { normalizeFlowNodes, validateFlowNodes } from "@/lib/serviceConfig";
import { validateNodeConditions } from "@/lib/flowConditions";

export async function GET(req) {
  const { denied } = await requireAdminPermission("orderFlows.view");
  if (denied) return denied;

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
  const { denied } = await requireAdminPermission("orderFlows.create");
  if (denied) return denied;

  try {
    await connectToDB();
    const body = await req.json();

    const { name, description, rootCategory, edges, isActive } = body;
    const nodes = normalizeFlowNodes(body.nodes);

    if (!name || !rootCategory) {
      return NextResponse.json(
        { message: "نام و دسته‌بندی ریشه الزامی است" },
        { status: 400 }
      );
    }

    const optionErrors = [...validateFlowNodes(nodes), ...validateNodeConditions(nodes)];
    if (optionErrors.length > 0) {
      return NextResponse.json({ message: optionErrors.join(" • ") }, { status: 400 });
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
