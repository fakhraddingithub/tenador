/**
 * /api/admin/instagram/unread
 *
 * GET → فقط مجموعِ پیام‌های خوانده‌نشده (سبک، برای بَجِ سایدبارِ پنل).
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { getTotalUnread } from "base/services/instagramService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDB();
    const unread = await getTotalUnread();
    return NextResponse.json({ unread }, { status: 200 });
  } catch (error) {
    console.error("[admin/instagram/unread GET]", error);
    return NextResponse.json({ unread: 0 }, { status: 200 });
  }
}
