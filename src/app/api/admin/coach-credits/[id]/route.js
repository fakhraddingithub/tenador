// app/api/admin/coach-credits/[id]/route.js
import connectToDB from "base/configs/db";
import CoachCredit from "base/models/CoachCredit";
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

// PATCH /api/admin/coach-credits/[id]
export async function PATCH(req, { params }) {
  const admin = getAdminFromRequest(req);
  // if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDB();
  const body = await req.json();

  const rule = await CoachCredit.findByIdAndUpdate(
    params.id,
    { $set: body },
    { new: true, runValidators: true }
  ).populate("coach", "name lastName phone coachCode");

  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json(rule);
}

// DELETE /api/admin/coach-credits/[id]
export async function DELETE(req, { params }) {
  const admin = getAdminFromRequest(req);
  // if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDB();
  const rule = await CoachCredit.findByIdAndDelete(params.id);
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({ success: true });
}
