import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Otp from "base/models/Otp";
import requireAdminPermission from "@/lib/requireAdminPermission";

/** توضیحِ کامل در src/app/api/otps/route.js — این روت باید حذف شود. */

// ⚠️ `params` در Next 16 یک Promise است؛ بدون await مقدارِ id برابر undefined
// می‌شد و هندلر عملاً کار نمی‌کرد.
export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("admins.managePermissions");
  if (denied) return denied;

  try {
    await connectToDB();
    const { id } = await params;
    const otp = await Otp.findById(id);
    if (!otp) {
      return NextResponse.json({ error: "Otp not found" }, { status: 404 });
    }
    return NextResponse.json({ otp });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const { denied } = await requireAdminPermission("admins.managePermissions");
  if (denied) return denied;

  try {
    await connectToDB();
    const { id } = await params;
    const body = await req.json();
    const { phone, code, expTime, waitTime, useTimes } = body;

    // Validation
    if (!phone || !code || !expTime) {
      return NextResponse.json({ error: "Phone, code, and expTime are required" }, { status: 400 });
    }

    const updatedOtp = await Otp.findByIdAndUpdate(
      id,
      {
        phone,
        code,
        expTime,
        waitTime: waitTime || 0,
        useTimes: useTimes || 0
      },
      { new: true }
    );

    if (!updatedOtp) {
      return NextResponse.json({ error: "Otp not found" }, { status: 404 });
    }

    return NextResponse.json({ otp: updatedOtp });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("admins.managePermissions");
  if (denied) return denied;

  try {
    await connectToDB();
    const { id } = await params;
    const deletedOtp = await Otp.findByIdAndDelete(id);
    if (!deletedOtp) {
      return NextResponse.json({ error: "Otp not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Otp deleted successfully" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
