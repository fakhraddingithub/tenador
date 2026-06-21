/**
 * /api/instagram/webhook
 *
 * نقطه‌ی پایانیِ وبهوک که متا هنگام رسیدنِ دایرکتِ جدید آن را صدا می‌زند.
 *
 * GET  → handshake وریفایِ متا (hub.mode / hub.verify_token / hub.challenge)
 * POST → دریافتِ رویدادِ پیام؛ تأییدِ امضا، استخراج، ذخیره در دیتابیس و
 *         علامتِ نخوانده.
 *
 * متا انتظارِ پاسخِ سریعِ ۲۰۰ دارد؛ هر خطایی را داخلی مدیریت می‌کنیم و باز
 * هم ۲۰۰ برمی‌گردانیم تا متا وبهوک را غیرفعال نکند (مگر در وریفای که باید رد شود).
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import {
  verifyWebhookChallenge,
  verifyWebhookSignature,
} from "@/lib/instagram";
import { ingestIncomingMessage } from "base/services/instagramService";

export const runtime = "nodejs";
// وبهوک نباید کش/استاتیک شود
export const dynamic = "force-dynamic";

// ─── GET: وریفایِ وبهوک ───────────────────────────────────────────────
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const challenge = verifyWebhookChallenge(searchParams);

  if (challenge !== null) {
    // متا انتظارِ خودِ challenge را به‌صورت متنِ خام دارد
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST: رویدادِ پیامِ ورودی ────────────────────────────────────────
export async function POST(req) {
  // بدنه‌ی خام لازم است تا امضا (HMAC) دقیقاً روی همان بایت‌ها بررسی شود
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[instagram/webhook] امضای نامعتبر — درخواست رد شد");
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  // فقط رویدادهای مربوط به اینستاگرام
  if (body?.object !== "instagram") {
    return NextResponse.json({ ok: true });
  }

  try {
    await connectToDB();

    for (const entry of body.entry || []) {
      // رویدادهای پیام در آرایه‌ی messaging قرار دارند
      for (const event of entry.messaging || []) {
        const msg = event.message;
        if (!msg) continue;

        // اکوی پیام‌های ارسالیِ خودمان را نادیده بگیر
        if (msg.is_echo) continue;

        const senderId = event.sender?.id;
        if (!senderId) continue;

        // پیوست‌های تصویری (در صورت وجود)
        let imageUrl = "";
        if (Array.isArray(msg.attachments)) {
          const img = msg.attachments.find(
            (a) => a.type === "image" && a.payload?.url
          );
          if (img) imageUrl = img.payload.url;
        }

        // پیام‌های بدونِ متن و بدونِ تصویر (مثل واکنش‌ها) را رد کن
        if (!msg.text && !imageUrl) continue;

        await ingestIncomingMessage({
          igsid: senderId,
          mid: msg.mid || null,
          text: msg.text || "",
          imageUrl,
          timestamp: event.timestamp || entry.time * 1000 || Date.now(),
        });
      }
    }
  } catch (err) {
    // خطای داخلی را لاگ کن ولی همچنان ۲۰۰ بده تا متا retry/disable نکند
    console.error("[instagram/webhook POST]", err);
  }

  return NextResponse.json({ ok: true });
}
