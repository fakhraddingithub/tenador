/**
 * src/lib/push.js
 *
 * ابزار سمت‌سرورِ ارسال Web Push با کتابخانهٔ `web-push` و کلیدهای VAPID.
 *
 * استفاده:
 *   import { broadcastPush } from "@/lib/push";
 *   await broadcastPush({ title, body, url, icon });
 *
 * - فقط در محیط Node اجرا می‌شود (نه Edge) چون به crypto نیتیو نیاز دارد.
 * - اشتراک‌های منقضی (پاسخ 404/410 از سرویس پوش) به‌صورت خودکار از DB حذف می‌شوند.
 */

import webpush from "web-push";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import PushSubscription from "base/models/PushSubscription";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT =
  process.env.VAPID_SUBJECT ||
  `mailto:${process.env.ADMIN_EMAIL || "tenadorapp@gmail.com"}`;

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    console.warn(
      "[push] VAPID keys missing — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. Skipping push."
    );
    return false;
  }
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

/**
 * ارسال یک نوتیفیکیشن به یک اشتراکِ مشخص.
 * در صورت منقضی‌بودن (404/410) اشتراک را از DB حذف می‌کند.
 * @returns {Promise<{ok:boolean, removed?:boolean, status?:number}>}
 */
async function sendToSubscription(sub, payloadString) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      payloadString
    );
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    // 404 Not Found / 410 Gone → اشتراک دیگر معتبر نیست، پاکش کن
    if (status === 404 || status === 410) {
      try {
        await PushSubscription.deleteOne({ endpoint: sub.endpoint });
      } catch (delErr) {
        console.error("[push] failed to remove expired subscription:", delErr);
      }
      return { ok: false, removed: true, status };
    }
    console.error(
      `[push] send failed (status ${status ?? "?"}) for endpoint ${sub.endpoint?.slice(0, 40)}…:`,
      err?.body || err?.message || err
    );
    return { ok: false, status };
  }
}

/**
 * ارسال نوتیفیکیشن به همهٔ اشتراک‌های ثبت‌شده.
 * @param {{title:string, body:string, url?:string, icon?:string, badge?:string, tag?:string, data?:object}} payload
 * @returns {Promise<{sent:number, failed:number, removed:number, total:number}>}
 */
export async function broadcastPush(payload) {
  if (!ensureVapid()) return { sent: 0, failed: 0, removed: 0, total: 0 };

  await connectToDB();
  const subs = await PushSubscription.find({}).lean();
  if (subs.length === 0) return { sent: 0, failed: 0, removed: 0, total: 0 };

  const payloadString = JSON.stringify(payload);

  let sent = 0;
  let failed = 0;
  let removed = 0;

  // ارسالِ موازی اما کنترل‌شده (تعداد اشتراک‌ها معمولاً متوسط است)
  const results = await Promise.allSettled(
    subs.map((sub) => sendToSubscription(sub, payloadString))
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) sent++;
    else {
      failed++;
      if (r.status === "fulfilled" && r.value.removed) removed++;
    }
  }

  console.log(
    `[push] broadcast → total ${subs.length}, sent ${sent}, failed ${failed}, removed ${removed}`
  );
  return { sent, failed, removed, total: subs.length };
}

export { ensureVapid };
