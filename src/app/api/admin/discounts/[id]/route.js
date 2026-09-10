// src/app/api/admin/discounts/[id]/route.js
import connectToDB from "base/configs/db";
import DiscountRule from "base/models/DiscountRule";
import { validateDiscountDates } from "@/lib/discountDateValidation";
import { revalidateContent } from "@/lib/revalidate";
import { NextResponse } from "next/server";

import requireAdminPermission from "@/lib/requireAdminPermission";

// GET /api/admin/discounts/[id]
export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("discounts.view");
  if (denied) return denied;

  await connectToDB();
  const { id } = await params;
  const rule = await DiscountRule.findById(id).lean();
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json(rule);
}

// PATCH /api/admin/discounts/[id]
export async function PATCH(req, { params }) {
  const { denied } = await requireAdminPermission("discounts.edit");
  if (denied) return denied;

  await connectToDB();
  const { id } = await params;
  const body = await req.json();

  const patch = { ...body };

  if (body.startAt !== undefined || body.endAt !== undefined) {
    const current = await DiscountRule.findById(id).lean();
    if (!current) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
    const { startAt, endAt, error } = validateDiscountDates(body, current);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (body.startAt !== undefined) patch.startAt = startAt;
    if (body.endAt !== undefined) patch.endAt = endAt;
  }

  const rule = await DiscountRule.findByIdAndUpdate(
    id,
    { $set: patch },
    { new: true, runValidators: true }
  );
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  revalidateContent(["products", "events"]);
  return NextResponse.json(rule);
}

// DELETE /api/admin/discounts/[id]
export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("discounts.delete");
  if (denied) return denied;

  await connectToDB();
  const { id } = await params;
  const rule = await DiscountRule.findByIdAndDelete(id);
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  revalidateContent(["products", "events"]);
  return NextResponse.json({ success: true });
}
