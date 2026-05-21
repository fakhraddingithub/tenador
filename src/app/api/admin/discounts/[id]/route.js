// app/api/admin/discounts/[id]/route.js
import connectToDB from "base/configs/db";
import DiscountRule from "base/models/DiscountRule";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

function getAdminFromRequest(req) {
  const token =
    req.cookies.get("token")?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/admin/discounts/[id]
export async function GET(req, { params }) {
  const admin = getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDB();
  const rule = await DiscountRule.findById(params.id).lean();
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json(rule);
}

// PATCH /api/admin/discounts/[id]
export async function PATCH(req, { params }) {
  const admin = getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDB();
  const body = await req.json();

  if (body.startAt && body.endAt && new Date(body.startAt) >= new Date(body.endAt)) {
    return NextResponse.json({ error: "تاریخ شروع باید قبل از تاریخ پایان باشد" }, { status: 400 });
  }

  const rule = await DiscountRule.findByIdAndUpdate(
    params.id,
    { $set: body },
    { new: true, runValidators: true }
  );
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json(rule);
}

// DELETE /api/admin/discounts/[id]
export async function DELETE(req, { params }) {
  const admin = getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDB();
  const rule = await DiscountRule.findByIdAndDelete(params.id);
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({ success: true });
}
