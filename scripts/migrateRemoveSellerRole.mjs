/**
 * scripts/migrateRemoveSellerRole.mjs
 *
 * حذفِ نقشِ «فروشنده» (seller) از داده‌ها.
 *
 * نقشِ seller با نقشِ store (فروشگاه) هم‌پوشان و اضافی بود و از enumهای
 * models/User.js ، models/UserNotification.js و models/DiscountRule.js برداشته
 * شده است. این اسکریپت هر جایی که آن مقدار در دیتابیس مانده را به "store"
 * منتقل می‌کند تا:
 *   ۱) هیچ سندی با enum جدید ناسازگار نماند (ذخیره‌ی بعدیِ آن سند شکست نخورد)،
 *   ۲) هدف‌گیری‌های قدیمی (تخفیف/اعلان) بی‌صدا از کار نیفتند.
 *
 * چهار جا بررسی می‌شود:
 *   users.role                       "seller" → "store"
 *   discountrules.targetRoles[]      "seller" → "store" (بدون تکرار)
 *   usernotifications.targetRole     "seller" → "store"
 *   sitesettings[review_credit_config].value.eligibleRoles[]  "seller" → "store"
 *
 *   npm run check:remove-seller-role     # فقط گزارش (هیچ نوشتنی)
 *   npm run migrate:remove-seller-role   # اعمال
 *
 * idempotent است: اجرای دوباره هیچ سندی پیدا نمی‌کند.
 *
 * ⚠️ عمداً با درایورِ خام (conn.collection) کار می‌کند، نه با مدل‌های Mongoose:
 * مدل‌ها دیگر "seller" را در enum ندارند، پس خواندن/نوشتنِ آن از مسیرِ مدل
 * اعتبارسنجی را می‌شکست. درایورِ خام دقیقاً همان چیزی را می‌بیند که در دیتابیس است.
 */

import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // متغیرهای محیطی از خودِ runtime می‌آیند
}

const apply = process.argv.includes("--apply");

const OLD_ROLE = "seller";
const NEW_ROLE = "store";
const REVIEW_CREDIT_CONFIG_KEY = "review_credit_config";

async function main() {
  const uri = process.env.MONGODB_URI_TENADOR;
  if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است.");

  const conn = await mongoose
    .createConnection(uri, { bufferCommands: false })
    .asPromise();

  try {
    /* ─── ۱) کاربران ───────────────────────────────────────────────── */
    const users = conn.collection("users");
    const userCount = await users.countDocuments({ role: OLD_ROLE });
    console.log(`کاربران با نقش «${OLD_ROLE}»: ${userCount}`);

    /* ─── ۲) قوانین تخفیف ──────────────────────────────────────────── */
    const rules = conn.collection("discountrules");
    const ruleDocs = await rules
      .find({ targetRoles: OLD_ROLE }, { projection: { _id: 1, title: 1, targetRoles: 1 } })
      .toArray();
    console.log(`قوانین تخفیفِ هدف‌گرفته‌ی «${OLD_ROLE}»: ${ruleDocs.length}`);
    for (const r of ruleDocs) {
      console.log(`   • ${r.title || r._id}: [${(r.targetRoles || []).join(", ")}]`);
    }

    /* ─── ۳) اعلان‌های کاربری ──────────────────────────────────────── */
    const notifications = conn.collection("usernotifications");
    const notifCount = await notifications.countDocuments({ targetRole: OLD_ROLE });
    console.log(`اعلان‌های هدف‌گرفته‌ی «${OLD_ROLE}»: ${notifCount}`);

    /* ─── ۴) تنظیماتِ پاداش نقدیِ نظر ──────────────────────────────── */
    const settings = conn.collection("sitesettings");
    const creditConfig = await settings.findOne({ key: REVIEW_CREDIT_CONFIG_KEY });
    const creditRoles = creditConfig?.value?.eligibleRoles;
    const creditNeedsFix =
      Array.isArray(creditRoles) && creditRoles.includes(OLD_ROLE);
    console.log(
      `تنظیمات پاداش نظر شاملِ «${OLD_ROLE}»: ${creditNeedsFix ? "بله" : "خیر"}`
    );

    const total = userCount + ruleDocs.length + notifCount + (creditNeedsFix ? 1 : 0);

    if (total === 0) {
      console.log("\n✅ هیچ ارجاعی به نقشِ حذف‌شده باقی نمانده است.");
      return;
    }

    if (!apply) {
      console.log(
        `\nℹ️  حالت گزارش. برای اعمال: npm run migrate:remove-seller-role` +
          `\n   (${total} مورد به «${NEW_ROLE}» منتقل می‌شود)`
      );
      return;
    }

    /* ─── اعمال ───────────────────────────────────────────────────── */
    const userRes = await users.updateMany(
      { role: OLD_ROLE },
      { $set: { role: NEW_ROLE } }
    );
    console.log(`\nکاربران منتقل‌شده: ${userRes.modifiedCount}`);

    // دو مرحله‌ای تا اگر قانونی هم‌زمان seller و store داشت، store تکراری نشود:
    // اول seller حذف، بعد store اضافه (addToSet مقدارِ تکراری نمی‌سازد).
    const pullRes = await rules.updateMany(
      { targetRoles: OLD_ROLE },
      { $pull: { targetRoles: OLD_ROLE } }
    );
    const addRes = await rules.updateMany(
      { _id: { $in: ruleDocs.map((r) => r._id) } },
      { $addToSet: { targetRoles: NEW_ROLE } }
    );
    console.log(
      `قوانین تخفیف: ${pullRes.modifiedCount} پاک‌سازی، ${addRes.modifiedCount} به «${NEW_ROLE}» منتقل`
    );

    const notifRes = await notifications.updateMany(
      { targetRole: OLD_ROLE },
      { $set: { targetRole: NEW_ROLE } }
    );
    console.log(`اعلان‌های منتقل‌شده: ${notifRes.modifiedCount}`);

    if (creditNeedsFix) {
      const nextRoles = Array.from(
        new Set(creditRoles.map((r) => (r === OLD_ROLE ? NEW_ROLE : r)))
      );
      await settings.updateOne(
        { key: REVIEW_CREDIT_CONFIG_KEY },
        { $set: { "value.eligibleRoles": nextRoles } }
      );
      console.log(`تنظیمات پاداش نظر به‌روزرسانی شد: [${nextRoles.join(", ")}]`);
    }

    console.log("\n✅ انجام شد.");
  } finally {
    await conn.close().catch(() => {});
  }
}

try {
  await main();
} catch (error) {
  console.error("\n❌", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
