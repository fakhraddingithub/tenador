// app/api/admin/coach-credits/[id]/route.js
import connectToDB from "base/configs/db";
import CoachCredit from "base/models/CoachCredit";
import { NextResponse } from "next/server";

import requireAdminPermission from "@/lib/requireAdminPermission";

// PATCH /api/admin/coach-credits/[id]
export async function PATCH(req, { params }) {
  const { denied } = await requireAdminPermission("coaches.manageCredits");
  if (denied) return denied;

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
  const { denied } = await requireAdminPermission("coaches.manageCredits");
  if (denied) return denied;

  await connectToDB();
  const rule = await CoachCredit.findByIdAndDelete(params.id);
  if (!rule) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({ success: true });
}
