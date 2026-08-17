import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Ban from "base/models/Ban";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function GET(req) {
  const { denied } = await requireAdminPermission("users.ban");
  if (denied) return denied;

  try {
    await connectToDB();
    const bans = await Ban.find({}).populate('user bannedBy');
    return NextResponse.json({ bans });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const { actor, denied } = await requireAdminPermission("users.ban");
  if (denied) return denied;

  try {
    await connectToDB();
    const body = await req.json();
    const { user, reason, banDuration, isActive } = body;

    // Validation
    if (!user || !reason) {
      return NextResponse.json({ error: "User and reason are required" }, { status: 400 });
    }

    const newBan = new Ban({
      user,
      reason: String(reason).trim(),
      // ⚠️ از بدنه خوانده نمی‌شود: هرکسی می‌توانست مسدودسازی را به نامِ ادمینِ
      // دیگری ثبت کند. ردپای ممیزی همیشه از خودِ گیت می‌آید.
      bannedBy: actor.userId,
      banDuration: banDuration || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    await newBan.save();
    return NextResponse.json({ ban: newBan }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
