// src/app/api/admin/discounts/[id]/route.js
import connectToDB from "base/configs/db";
import DiscountRule from "base/models/DiscountRule";
import { NextResponse } from "next/server";

// GET /api/admin/discounts/[id]
export async function GET(req, { params }) {
  await connectToDB();
  const { id } = await params;
  const rule = await DiscountRule.findById(id).lean();
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json(rule);
}

// PATCH /api/admin/discounts/[id]
export async function PATCH(req, { params }) {
  await connectToDB();
  const { id } = await params;
  const body = await req.json();

  if (body.startAt && body.endAt && new Date(body.startAt) >= new Date(body.endAt)) {
    return NextResponse.json(
      { error: "تاریخ شروع باید قبل از تاریخ پایان باشد" },
      { status: 400 }
    );
  }

  const rule = await DiscountRule.findByIdAndUpdate(
    id,
    { $set: body },
    { new: true, runValidators: true }
  );
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json(rule);
}

// DELETE /api/admin/discounts/[id]
export async function DELETE(req, { params }) {
  await connectToDB();
  const { id } = await params;
  const rule = await DiscountRule.findByIdAndDelete(id);
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({ success: true });
}
