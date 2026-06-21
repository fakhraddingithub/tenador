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

// برچسبِ ثابت برای گرفتنِ آسانِ لاگ‌ها در پروداکشن (grep "[IG-WEBHOOK]")
const TAG = "[IG-WEBHOOK]";

// ─── GET: وریفایِ وبهوک ───────────────────────────────────────────────
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const hasToken = !!searchParams.get("hub.verify_token");
  console.log(
    `${TAG} GET verification hit — mode=${mode} verify_token_present=${hasToken}`
  );

  const challenge = verifyWebhookChallenge(searchParams);

  if (challenge !== null) {
    console.log(`${TAG} GET verification OK — echoing challenge`);
    // متا انتظارِ خودِ challenge را به‌صورت متنِ خام دارد
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn(
    `${TAG} GET verification FAILED — verify_token mismatch or missing params → 403`
  );
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST: رویدادِ پیامِ ورودی ────────────────────────────────────────
export async function POST(req) {
  // بدنه‌ی خام لازم است تا امضا (HMAC) دقیقاً روی همان بایت‌ها بررسی شود
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  // ✅ نخستین نشانه‌ی «متا واقعاً ما را صدا زد» — صرفِ دیدنِ این خط یعنی تحویل برقرار است
  console.log(
    `${TAG} POST received — bytes=${rawBody.length} signature_header=${
      signature ? "present" : "MISSING"
    } app_secret_set=${!!process.env.INSTAGRAM_APP_SECRET}`
  );

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn(
      `${TAG} POST REJECTED — signature verification failed → 403 (check INSTAGRAM_APP_SECRET in production)`
    );
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn(`${TAG} POST body is not valid JSON — ignored`);
    return NextResponse.json({ ok: true });
  }

  // فقط رویدادهای مربوط به اینستاگرام
  if (body?.object !== "instagram") {
    console.log(
      `${TAG} POST ignored — object=${body?.object} (expected "instagram")`
    );
    return NextResponse.json({ ok: true });
  }

  let processed = 0;
  let skipped = 0;
  try {
    await connectToDB();

    for (const entry of body.entry || []) {
      // رویدادهای پیام در آرایه‌ی messaging قرار دارند
      for (const event of entry.messaging || []) {
        const msg = event.message;
        if (!msg) {
          skipped++;
          continue;
        }

        // اکوی پیام‌های ارسالیِ خودمان را نادیده بگیر
        if (msg.is_echo) {
          console.log(`${TAG} skip — is_echo (our own outgoing message)`);
          skipped++;
          continue;
        }

        const senderId = event.sender?.id;
        if (!senderId) {
          console.log(`${TAG} skip — event has no sender.id`);
          skipped++;
          continue;
        }

        // پیوست‌های تصویری (در صورت وجود)
        let imageUrl = "";
        if (Array.isArray(msg.attachments)) {
          const img = msg.attachments.find(
            (a) => a.type === "image" && a.payload?.url
          );
          if (img) imageUrl = img.payload.url;
        }

        // پیام‌های بدونِ متن و بدونِ تصویر (مثل واکنش‌ها) را رد کن
        if (!msg.text && !imageUrl) {
          console.log(`${TAG} skip — no text and no image attachment`);
          skipped++;
          continue;
        }

        const result = await ingestIncomingMessage({
          igsid: senderId,
          mid: msg.mid || null,
          text: msg.text || "",
          imageUrl,
          timestamp: event.timestamp || entry.time * 1000 || Date.now(),
        });
        console.log(
          `${TAG} ingest — sender=${senderId} hasText=${!!msg.text} hasImage=${!!imageUrl} mid=${
            msg.mid || "none"
          } → ${result.created ? "STORED" : "duplicate/skipped"}`
        );
        processed++;
      }
    }
    console.log(
      `${TAG} POST done — events_processed=${processed} skipped=${skipped}`
    );
  } catch (err) {
    // خطای داخلی را لاگ کن ولی همچنان ۲۰۰ بده تا متا retry/disable نکند
    console.error(`${TAG} POST handler error:`, err);
  }

  return NextResponse.json({ ok: true });
}
