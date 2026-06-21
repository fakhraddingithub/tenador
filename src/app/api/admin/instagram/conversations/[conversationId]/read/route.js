/**
 * /api/admin/instagram/conversations/[conversationId]/read
 *
 * POST → علامت‌گذاریِ همه‌ی پیام‌های ورودیِ گفتگو به‌عنوان خوانده‌شده و صفرکردنِ
 *        شمارشِ نخوانده. UI هنگام بازکردنِ یک گفتگو این را صدا می‌زند.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { markConversationRead } from "base/services/instagramService";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    await connectToDB();
    const { conversationId } = await params;

    await markConversationRead(conversationId);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[admin/instagram/read POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
