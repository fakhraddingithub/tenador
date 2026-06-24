// workers/installmentReminderWorker.js
//
// یادآوریِ سررسید اقساط به مشتری — چک‌های نزدیک به سررسید یا سررسیدگذشته را
// پیدا کرده و برای هر سفارش یک ایمیلِ یادآوری ارسال می‌کند.
//
// این worker صف‌محور (BullMQ) نیست؛ یک «اسکنِ دوره‌ای» است و برای اجرا با
// زمان‌بندِ بیرونی (cron / Vercel Cron / pm2) طراحی شده است:
//
//   node workers/installmentReminderWorker.js          # یک‌بار اجرا و خروج (مناسب cron روزانه)
//   REMINDER_INTERVAL_MS=86400000 node workers/installmentReminderWorker.js   # حلقه‌ی داخلی
//
// تنظیمات (env):
//   REMINDER_LEAD_DAYS          روزهای پیش از سررسید که یادآوری ارسال شود   (پیش‌فرض 3)
//   REMINDER_MIN_INTERVAL_DAYS  حداقل فاصله‌ی دو یادآوری برای یک چک          (پیش‌فرض 3)
//   REMINDER_INTERVAL_MS        اگر ست شود، به‌جای خروج، به‌صورت حلقه اجرا می‌شود

import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Installment from "base/models/Installment";
import { sendInstallmentReminderEmail } from "base/src/lib/emailService";

const DAY_MS = 24 * 60 * 60 * 1000;

function num(envKey, fallback) {
  const v = Number(process.env[envKey]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

/**
 * یک‌بار اسکن می‌کند و یادآوری‌ها را ارسال می‌کند.
 * @returns {Promise<{processed:number, emailsSent:number, checksReminded:number}>}
 */
export async function runInstallmentReminders(now = new Date()) {
  await connectToDB();

  const leadDays = num("REMINDER_LEAD_DAYS", 3);
  const minIntervalDays = num("REMINDER_MIN_INTERVAL_DAYS", 3);
  const leadWindowEnd = new Date(now.getTime() + leadDays * DAY_MS);
  const minIntervalMs = minIntervalDays * DAY_MS;

  // فقط اقساطِ دارای چکِ پرداخت‌نشده (تکمیل‌شده‌ها را نادیده بگیر)
  const installments = await Installment.find({ "checks.status": "PENDING" })
    .populate({
      path: "order",
      select: "trackingCode totalPrice user fulfillmentStatus",
      populate: { path: "user", select: "email name" },
    });

  let processed = 0;
  let emailsSent = 0;
  let checksReminded = 0;

  for (const inst of installments) {
    processed++;

    const order = inst.order;
    // سفارش حذف‌شده یا لغوشده → رد شو
    if (!order || order.fulfillmentStatus === "CANCELED") continue;
    const email = order.user?.email;

    // چک‌ها را بر اساس سررسید مرتب کن تا شماره‌ی قسط ثابت بماند
    const sorted = inst.checks
      .map((c, originalIdx) => ({ c, originalIdx }))
      .sort((a, b) => new Date(a.c.dueDate) - new Date(b.c.dueDate));

    const dueChecks = [];
    const toMark = [];

    sorted.forEach(({ c }, idx) => {
      if (c.status !== "PENDING" || !c.dueDate) return;
      const due = new Date(c.dueDate);
      const isOverdue = due.getTime() < now.getTime();
      const isUpcoming = due.getTime() >= now.getTime() && due.getTime() <= leadWindowEnd.getTime();
      if (!isOverdue && !isUpcoming) return;

      // جلوگیری از ارسال تکراری در بازه‌ی کوتاه
      const last = c.lastReminderAt ? new Date(c.lastReminderAt).getTime() : 0;
      if (last && now.getTime() - last < minIntervalMs) return;

      dueChecks.push({ number: idx + 1, amount: c.amount, dueDate: c.dueDate, overdue: isOverdue });
      toMark.push(c);
    });

    if (dueChecks.length === 0) continue;

    // اگر ایمیل مشتری نداریم، علامت نزن تا بعداً (در صورت افزوده‌شدن ایمیل) ارسال شود
    if (!email) continue;

    try {
      await sendInstallmentReminderEmail(order, inst, dueChecks, email);
      emailsSent++;
      checksReminded += toMark.length;
      for (const c of toMark) c.lastReminderAt = now;
      await inst.save();
    } catch (err) {
      console.error(`[installmentReminder] failed for installment ${inst._id}:`, err?.message);
    }
  }

  return { processed, emailsSent, checksReminded };
}

// ─── اجرای مستقیم به‌عنوان اسکریپت ───────────────────────────────────────────
const isMain =
  typeof process !== "undefined" &&
  process.argv?.[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("installmentReminderWorker.js");

if (isMain) {
  const intervalMs = Number(process.env.REMINDER_INTERVAL_MS);

  const tick = async () => {
    const startedAt = new Date();
    try {
      const res = await runInstallmentReminders(startedAt);
      console.log(
        `[installmentReminder] ${startedAt.toISOString()} → بررسی ${res.processed} طرح، ` +
          `${res.emailsSent} ایمیل، ${res.checksReminded} قسط یادآوری شد`,
      );
    } catch (err) {
      console.error("[installmentReminder] خطا در اجرا:", err);
    }
  };

  (async () => {
    if (Number.isFinite(intervalMs) && intervalMs > 0) {
      // حالت حلقه‌ای — تا توقف دستی ادامه می‌یابد
      await tick();
      setInterval(tick, intervalMs);
      console.log(`[installmentReminder] حالت حلقه‌ای فعال شد (هر ${intervalMs} میلی‌ثانیه)`);
    } else {
      // حالت یک‌بار اجرا — مناسب cron
      await tick();
      await mongoose.connection.close().catch(() => {});
      process.exit(0);
    }
  })();
}
