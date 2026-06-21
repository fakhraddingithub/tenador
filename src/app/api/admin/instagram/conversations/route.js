/**
 * /api/admin/instagram/conversations
 *
 * GET → فهرستِ گفتگوهای دایرکتِ اینستاگرام (جدیدترین فعالیت اول) + مجموعِ نخوانده‌ها.
 *       این مسیر را UIِ پنل برای پولینگِ سبکِ فهرست صدا می‌زند.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import {
  listConversations,
  getTotalUnread,
} from "base/services/instagramService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit");

    const [conversations, totalUnread] = await Promise.all([
      listConversations({ limit }),
      getTotalUnread(),
    ]);

    return NextResponse.json({ conversations, totalUnread }, { status: 200 });
  } catch (error) {
    console.error("[admin/instagram/conversations GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
