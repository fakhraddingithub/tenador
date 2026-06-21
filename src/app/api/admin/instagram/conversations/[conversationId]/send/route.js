/**
 * /api/admin/instagram/conversations/[conversationId]/send
 *
 * POST → ارسالِ پاسخِ ادمین (متن و/یا تصویر) به کاربرِ اینستاگرام از طریقِ
 *        Send API و سپس ثبتِ پیام در دیتابیس.
 *
 * بدنه: { text?: string, imageUrl?: string }
 *   - imageUrl باید یک URL عمومی باشد (از /api/upload → Cloudinary به‌دست می‌آید)
 *
 * نکته‌ی پلتفرم: ارسال فقط داخلِ پنجره‌ی ۲۴ ساعته پس از آخرین پیامِ کاربر مجاز
 * است؛ خارج از آن، Send API خطا می‌دهد و ما همان خطا را به ادمین برمی‌گردانیم.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import InstagramConversation from "base/models/InstagramConversation";
import { sendTextMessage, sendImageMessage } from "@/lib/instagram";
import { recordOutgoingMessage } from "base/services/instagramService";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    await connectToDB();
    const { conversationId } = await params;

    const body = await req.json().catch(() => ({}));
    const text = (body.text || "").trim();
    const imageUrl = (body.imageUrl || "").trim();

    if (!text && !imageUrl) {
      return NextResponse.json(
        { message: "متن یا تصویر الزامی است" },
        { status: 400 }
      );
    }

    const convo = await InstagramConversation.findById(conversationId).lean();
    if (!convo) {
      return NextResponse.json({ message: "گفتگو یافت نشد" }, { status: 404 });
    }

    const igsid = convo.igsid;
    const saved = [];

    // ترتیب: اول تصویر، بعد متن (مطابق رفتارِ معمولِ چت)
    try {
      if (imageUrl) {
        const r = await sendImageMessage(igsid, imageUrl);
        const msg = await recordOutgoingMessage({
          igsid,
          imageUrl,
          mid: r?.message_id || null,
          status: "sent",
        });
        saved.push(msg);
      }

      if (text) {
        const r = await sendTextMessage(igsid, text);
        const msg = await recordOutgoingMessage({
          igsid,
          text,
          mid: r?.message_id || null,
          status: "sent",
        });
        saved.push(msg);
      }
    } catch (sendErr) {
      // ارسال شکست خورد → پیام را با وضعیتِ failed ثبت کن تا در ترِد دیده شود
      const failed = await recordOutgoingMessage({
        igsid,
        text,
        imageUrl,
        status: "failed",
        error: sendErr?.message || "ارسال ناموفق بود",
      });
      return NextResponse.json(
        {
          message: sendErr?.message || "ارسال پیام به اینستاگرام ناموفق بود",
          failedMessage: failed,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, messages: saved }, { status: 201 });
  } catch (error) {
    console.error("[admin/instagram/send POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
