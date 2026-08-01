// workers/reviewFollowUpWorker.js
//
// پیگیریِ «آیا سفارش به‌دستتان رسید؟» — REVIEW_FOLLOWUP_DAYS روز پس از
// تحویل سفارش (deliveredAt که فقط در orderFulfillmentSync.js ثبت می‌شود، نه
// PATCH دستی ادمین). این worker صف‌محور (BullMQ) نیست؛ یک «اسکنِ دوره‌ای» است
// (همان الگوی installmentReminderWorker.js) و برای اجرا با زمان‌بندِ بیرونی
// (cron / Vercel Cron / pm2) طراحی شده است:
//
//   node workers/reviewFollowUpWorker.js                              # یک‌بار اجرا و خروج (مناسب cron روزانه)
//   REVIEW_FOLLOWUP_INTERVAL_MS=3600000 node workers/reviewFollowUpWorker.js   # حلقه‌ی داخلی
//
// تنظیمات (env):
//   REVIEW_FOLLOWUP_DAYS           چند روز پس از تحویل ارسال شود   (پیش‌فرض 3)
//   REVIEW_FOLLOWUP_INTERVAL_MS    اگر ست شود، به‌جای خروج، به‌صورت حلقه اجرا می‌شود

import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Order from "base/models/Order";
import { notifyDeliveryFollowUp } from "base/src/lib/reviewRequestNotice";

const DAY_MS = 24 * 60 * 60 * 1000;

function num(envKey, fallback) {
  const v = Number(process.env[envKey]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

/**
 * یک‌بار اسکن می‌کند و پیگیری‌های سررسیده را ارسال می‌کند.
 * @returns {Promise<{processed:number, sent:number}>}
 */
export async function runReviewFollowUps(now = new Date()) {
  await connectToDB();

  const days = num("REVIEW_FOLLOWUP_DAYS", 3);
  const cutoff = new Date(now.getTime() - days * DAY_MS);

  const candidates = await Order.find({
    fulfillmentStatus: "DELIVERED",
    deliveredAt: { $ne: null, $lte: cutoff },
    reviewFollowUpSentAt: null,
  }).select("_id");

  let processed = 0;
  let sent = 0;

  for (const { _id } of candidates) {
    processed++;

    // claim اتمیک — جلوگیری از ارسال دوباره اگر دو اجرای اسکن هم‌پوشانی داشته باشند
    const res = await Order.updateOne(
      { _id, reviewFollowUpSentAt: null },
      { $set: { reviewFollowUpSentAt: now } }
    );
    if (res.modifiedCount === 0) continue; // یک اجرای دیگر همین الان claim کرد

    await notifyDeliveryFollowUp(_id);
    sent++;
  }

  return { processed, sent };
}

// ─── اجرای مستقیم به‌عنوان اسکریپت ───────────────────────────────────────────
const isMain =
  typeof process !== "undefined" &&
  process.argv?.[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("reviewFollowUpWorker.js");

if (isMain) {
  const intervalMs = Number(process.env.REVIEW_FOLLOWUP_INTERVAL_MS);

  const tick = async () => {
    const startedAt = new Date();
    try {
      const res = await runReviewFollowUps(startedAt);
      console.log(
        `[reviewFollowUp] ${startedAt.toISOString()} → بررسی ${res.processed} سفارش، ${res.sent} پیگیری ارسال شد`,
      );
    } catch (err) {
      console.error("[reviewFollowUp] خطا در اجرا:", err);
    }
  };

  (async () => {
    if (Number.isFinite(intervalMs) && intervalMs > 0) {
      // حالت حلقه‌ای — تا توقف دستی ادامه می‌یابد
      await tick();
      setInterval(tick, intervalMs);
      console.log(`[reviewFollowUp] حالت حلقه‌ای فعال شد (هر ${intervalMs} میلی‌ثانیه)`);
    } else {
      // حالت یک‌بار اجرا — مناسب cron
      await tick();
      await mongoose.connection.close().catch(() => {});
      process.exit(0);
    }
  })();
}
