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
import InstagramWebhookLog from "base/models/InstagramWebhookLog";

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
  const ts = new Date().toISOString();

  // ① نخستین خط — پیش از هر اعتبارسنجی. صرفِ دیدنِ این یعنی متا واقعاً ما را صدا زد.
  console.log(
    `${TAG} ① POST ARRIVED @ ${ts} — ua="${
      req.headers.get("user-agent") || "?"
    }" content-type="${req.headers.get("content-type") || "?"}"`
  );

  // بدنه‌ی خام لازم است تا امضا (HMAC) دقیقاً روی همان بایت‌ها بررسی شود.
  // ⚠️ حتماً پیش از JSON.parse خوانده می‌شود (وگرنه امضا روی بایت‌های اصلی تأیید نمی‌شود).
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const appSecretSet = !!(process.env.INSTAGRAM_APP_SECRET || "").trim();

  // ② وضعیتِ امضا: حضور، نتیجه و دلیلِ شکست
  const sig = verifyWebhookSignature(rawBody, signature);
  console.log(
    `${TAG} ② signature — header=${
      signature ? "present" : "MISSING"
    } app_secret_loaded=${appSecretSet} result=${
      sig.ok ? "PASS" : "FAIL"
    } reason=${sig.reason}` +
      (sig.ok || sig.reason === "no-app-secret-skipped"
        ? ""
        : ` received="${sig.receivedPrefix}…" expected="${sig.expectedPrefix}…"`) +
      ` bytes=${rawBody.length}`
  );

  // ── سندِ تشخیصی که در هر مسیرِ بازگشت ذخیره می‌شود (قابل‌مشاهده در مرورگر) ──
  const debug = {
    receivedAt: new Date(),
    method: "POST",
    signaturePresent: !!signature,
    signatureResult: sig.ok
      ? "PASS"
      : sig.reason === "no-app-secret-skipped"
      ? "SKIPPED"
      : "FAIL",
    signatureReason: sig.reason,
    appSecretLoaded: appSecretSet,
    bytes: rawBody.length,
    objectType: "",
    stored: 0,
    skipped: 0,
    note: "",
    shape: null,
    rawPreview: rawBody.slice(0, 600),
  };
  // best-effort: هرگز جریانِ اصلی یا پاسخِ ۲۰۰ را نشکند
  const persistDebug = async () => {
    try {
      await connectToDB();
      await InstagramWebhookLog.create(debug);
    } catch (e) {
      console.error(`${TAG} debug-log write failed:`, e?.message || e);
    }
  };

  try {
    if (!sig.ok) {
      console.warn(
        `${TAG} ✗ POST REJECTED — signature ${sig.reason} → 403. ` +
          `اگر header موجود است ولی FAIL است، INSTAGRAM_APP_SECRET در پروداکشن با App Secret پنلِ متا یکی نیست.`
      );
      debug.note = "rejected-bad-signature";
      return new NextResponse("Invalid signature", { status: 403 });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.warn(`${TAG} ✗ body is not valid JSON — ignored (still 200)`);
      debug.note = "invalid-json";
      return NextResponse.json({ ok: true });
    }

    debug.objectType = body?.object || "";
    debug.shape = (body?.entry || []).map((e) => ({
      id: e.id,
      time: e.time,
      messaging: (e.messaging || []).length,
      changes: (e.changes || []).length,
      keys: Object.keys(e),
    }));

    // ③ ساختارِ امنِ پیلود (بدونِ متنِ پیام/داده‌ی حساس) — فقط شکل و شمارش
    console.log(
      `${TAG} ③ payload — object=${body?.object} entries=${
        (body?.entry || []).length
      } shape=${JSON.stringify(debug.shape)}`
    );

    // فقط رویدادهای مربوط به اینستاگرام
    if (body?.object !== "instagram") {
      console.log(
        `${TAG} ✗ POST ignored — object=${body?.object} (expected "instagram")`
      );
      debug.note = "non-instagram-object";
      return NextResponse.json({ ok: true });
    }

    let processed = 0;
    let skipped = 0;
    let storedCount = 0;
    await connectToDB();

    for (const entry of body.entry || []) {
      // رویدادهای پیام در آرایه‌ی messaging قرار دارند
      const events = entry.messaging || [];
      if (events.length === 0) {
        console.log(
          `${TAG} entry ${entry.id} has no messaging[] — keys=${JSON.stringify(
            Object.keys(entry)
          )}`
        );
      }
      for (const event of events) {
        const msg = event.message;
        if (!msg) {
          console.log(
            `${TAG} skip — event without message (keys=${JSON.stringify(
              Object.keys(event)
            )})`
          );
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
          console.log(
            `${TAG} skip — no text and no image (attachment types=${JSON.stringify(
              (msg.attachments || []).map((a) => a.type)
            )})`
          );
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

        // ④ نتیجه‌ی ذخیره با شناسه‌های ساخته‌شده
        if (result.created) {
          storedCount++;
          console.log(
            `${TAG} ④ ✓ STORED — sender=${senderId} hasText=${!!msg.text} hasImage=${!!imageUrl} ` +
              `conversationId=${result.conversationId} messageId=${result.messageId} mid=${
                msg.mid || "none"
              }`
          );
        } else {
          console.log(
            `${TAG} ④ • not stored — reason=${result.reason} sender=${senderId} ` +
              `conversationId=${result.conversationId || "?"} messageId=${
                result.messageId || "?"
              }`
          );
        }
        processed++;
      }
    }
    debug.stored = storedCount;
    debug.skipped = skipped + (processed - storedCount);
    if (!debug.note) {
      debug.note = processed === 0 ? "delivered-but-no-message-events" : "processed";
    }
    console.log(
      `${TAG} ⑤ POST done @ ${new Date().toISOString()} — events_processed=${processed} stored=${storedCount} skipped=${skipped} → 200`
    );
  } catch (err) {
    // خطای داخلی را لاگ کن ولی همچنان ۲۰۰ بده تا متا retry/disable نکند
    console.error(`${TAG} ✗ POST handler error (still returning 200):`, err);
    debug.note = `handler-error: ${err?.message || err}`;
  } finally {
    // در هر مسیرِ بازگشت، سندِ تشخیصی ذخیره می‌شود
    await persistDebug();
  }

  return NextResponse.json({ ok: true });
}
