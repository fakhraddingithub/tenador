/**
 * /api/admin/instagram/conversations/[conversationId]
 *
 * GET → واکشیِ کاملِ پیام‌های یک گفتگو (برای پنجره‌ی چت). UI این مسیر را
 *       هنگام بازبودنِ گفتگو به‌صورت سبک پول می‌کند تا پیام‌های تازه را بگیرد.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { getThread } from "base/services/instagramService";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    await connectToDB();
    const { conversationId } = await params;

    const data = await getThread(conversationId);
    if (!data) {
      return NextResponse.json({ message: "گفتگو یافت نشد" }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[admin/instagram/conversation GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
