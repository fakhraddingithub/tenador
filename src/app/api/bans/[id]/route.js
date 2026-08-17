import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Ban from "base/models/Ban";
import requireAdminPermission from "@/lib/requireAdminPermission";

// ⚠️ `params` در Next 16 یک Promise است. بدون await مقدارِ id برابر undefined
// می‌شد و findById خطای Cast و ۵۰۰ می‌داد — یعنی این هندلرها اصلاً کار
// نمی‌کردند. اصلاح آن از افزودنِ گیت جدا نیست: روتِ خرابِ محافظت‌شده هم
// همچنان خراب است.
export async function GET(req, { params }) {
  // فهرستِ مسدودسازی‌ها با کلید محافظت می‌شود؛ خواندنِ *یک* رکورد هم همان
  // داده را (با user و bannedByِ populate شده) برمی‌گرداند.
  const { denied } = await requireAdminPermission("users.ban");
  if (denied) return denied;

  try {
    await connectToDB();
    const { id } = await params;
    const ban = await Ban.findById(id).populate('user bannedBy');
    if (!ban) {
      return NextResponse.json({ error: "Ban not found" }, { status: 404 });
    }
    return NextResponse.json({ ban });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const { actor, denied } = await requireAdminPermission("users.ban");
  if (denied) return denied;

  try {
    await connectToDB();
    const { id } = await params;
    const body = await req.json();
    const { user, reason, banDuration, isActive } = body;

    // Validation
    if (!user || !reason) {
      return NextResponse.json({ error: "User and reason are required" }, { status: 400 });
    }

    const updatedBan = await Ban.findByIdAndUpdate(
      id,
      {
        user,
        reason: String(reason).trim(),
        // ردپای ممیزی از گیت، نه از بدنه (توضیح در POST /api/bans).
        bannedBy: actor.userId,
        banDuration: banDuration || 0,
        isActive: isActive !== undefined ? isActive : true
      },
      { new: true }
    );

    if (!updatedBan) {
      return NextResponse.json({ error: "Ban not found" }, { status: 404 });
    }

    return NextResponse.json({ ban: updatedBan });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("users.ban");
  if (denied) return denied;

  try {
    await connectToDB();
    const { id } = await params;
    const deletedBan = await Ban.findByIdAndDelete(id);
    if (!deletedBan) {
      return NextResponse.json({ error: "Ban not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Ban deleted successfully" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
