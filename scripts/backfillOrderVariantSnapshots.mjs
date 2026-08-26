/**
 * scripts/backfillOrderVariantSnapshots.mjs
 *
 * برخی خطوطِ سفارش واریانتشان را «نامشخص» نشان می‌دهند. علتش این نیست که
 * واریانت ثبت نشده — ثبت شده، ولی سندِ آن واریانت بعداً حذف شده و populate
 * نتیجهٔ null می‌دهد. ریشه‌اش همان باگِ ویرایشِ محصول بود که واریانت‌ها را
 * delete/create می‌کرد (حالا در src/lib/variantReconcile.js اصلاح شده).
 *
 * فیلدِ order.items[].variantSnapshot دقیقاً برای همین اضافه شده بود، ولی
 * سفارش‌های پیش از آن خالی‌اند و نمایش به variant.attributes برمی‌گردد که
 * دیگر وجود ندارد.
 *
 * این اسکریپت فقط جایی را پر می‌کند که مدرکِ قطعی دارد: خطِ سفارشِ دیگری که
 * *همان* _id واریانتِ حذف‌شده را دارد و اسنپ‌شاتش پر است. یک _id یعنی یک سندِ
 * واریانت، پس ویژگی‌ها قطعاً یکی بوده‌اند. هیچ حدسی زده نمی‌شود؛ خطی که مدرک
 * ندارد دست‌نخورده و «نامشخص» می‌ماند.
 *
 *   npm run check:order-variant-snapshots    # فقط گزارش
 *   npm run backfill:order-variant-snapshots # اعمال
 *
 * idempotent است: خطی که اسنپ‌شات دارد دیگر دیده نمی‌شود.
 */

import mongoose from "mongoose";
import { writeFileSync } from "node:fs";

try {
  process.loadEnvFile(".env");
} catch {
  // متغیرهای محیطی از خودِ runtime می‌آیند
}

const apply = process.argv.includes("--apply");
const id = (v) => (v == null ? "" : String(v));

const hasSnapshot = (item) =>
  Array.isArray(item?.variantSnapshot) && item.variantSnapshot.length > 0;

/** اسنپ‌شات‌ها فقط وقتی «یکی» شمرده می‌شوند که محتوایشان دقیقاً یکی باشد */
const snapshotFingerprint = (snapshot) =>
  JSON.stringify(
    snapshot.map((e) => ({
      name: e?.name ?? null,
      label: e?.label ?? null,
      value: e?.value ?? null,
      image: e?.image ?? null,
      units: e?.units ?? null,
    })),
  );

async function main() {
  const uri = process.env.MONGODB_URI_TENADOR;
  if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است.");

  const conn = await mongoose
    .createConnection(uri, { bufferCommands: false })
    .asPromise();

  try {
    const ordersCol = conn.collection("orders");
    const orders = await ordersCol.find({}).toArray();
    const variantIds = new Set(
      (
        await conn.collection("variants").find({}, { projection: { _id: 1 } }).toArray()
      ).map((v) => id(v._id)),
    );

    // ─── بانکِ مدرک: _id واریانتِ حذف‌شده → اسنپ‌شات‌هایی که جای دیگر ثبت شده‌اند ───
    const donors = new Map();
    for (const order of orders) {
      for (const item of order.items || []) {
        if (!item.variant || !hasSnapshot(item)) continue;
        const key = id(item.variant);
        if (!donors.has(key)) donors.set(key, new Map());
        donors
          .get(key)
          .set(snapshotFingerprint(item.variantSnapshot), item.variantSnapshot);
      }
    }

    // ─── خطوطی که «نامشخص» نشان داده می‌شوند ───
    const planned = [];
    const unresolved = [];
    let danglingLines = 0;

    for (const order of orders) {
      for (const [index, item] of (order.items || []).entries()) {
        if (!item.variant) continue;
        if (variantIds.has(id(item.variant))) continue; // واریانت زنده است
        if (hasSnapshot(item)) continue; // نمایش سالم است
        danglingLines++;

        const candidates = donors.get(id(item.variant));
        const row = {
          orderId: id(order._id),
          trackingCode: order.trackingCode,
          index,
          deadVariant: id(item.variant),
          product: id(item.product),
        };

        if (!candidates || candidates.size === 0) {
          unresolved.push({ ...row, reason: "هیچ خطِ دیگری این واریانت را ثبت نکرده" });
        } else if (candidates.size > 1) {
          unresolved.push({
            ...row,
            reason: `مدرکِ متناقض — ${candidates.size} اسنپ‌شاتِ متفاوت برای یک واریانت`,
          });
        } else {
          planned.push({ ...row, snapshot: [...candidates.values()][0] });
        }
      }
    }

    // ─── گزارش ───
    console.log("─── وضعیت ───");
    console.log(`   سفارش‌ها                         : ${orders.length}`);
    console.log(`   خطوطِ «نامشخص» (واریانت حذف‌شده)  : ${danglingLines}`);
    console.log(`   قابلِ بازیابی با مدرک             : ${planned.length}`);
    console.log(`   بدونِ مدرک — دست‌نخورده می‌ماند     : ${unresolved.length}`);

    if (planned.length) {
      console.log("\n─── بازیابی ───");
      for (const p of planned) {
        const shown = p.snapshot
          .map((e) => `${e.label || e.name}: ${e.value}`)
          .join("، ");
        console.log(`   ${p.trackingCode} item[${p.index}]  →  ${shown}`);
        console.log(`      سفارش=${p.orderId} واریانتِ حذف‌شده=${p.deadVariant}`);
      }
    }

    if (unresolved.length) {
      console.log("\n─── بدونِ مدرک ───");
      for (const u of unresolved) {
        console.log(`   ${u.trackingCode} item[${u.index}] — ${u.reason}`);
        console.log(`      سفارش=${u.orderId} واریانتِ حذف‌شده=${u.deadVariant}`);
      }
    }

    if (!apply) {
      console.log("\nحالتِ read-only — هیچ سندی تغییر نکرد. برای اعمال: --apply");
      return;
    }
    if (!planned.length) {
      console.log("\nچیزی برای بازیابی نبود.");
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rollbackFile = `order-variant-snapshot-rollback-${stamp}.json`;
    writeFileSync(rollbackFile, JSON.stringify(planned, null, 2), "utf8");
    console.log(`\nفایلِ rollback نوشته شد: ${rollbackFile}`);

    const ops = planned.map((p) => ({
      updateOne: {
        // شرطِ خالی‌بودن، اسکریپت را در برابرِ اجرای هم‌زمان امن می‌کند.
        // روی سفارش‌های قدیمی این فیلد اصلاً وجود ندارد (نه آرایهٔ خالی)، پس
        // «$size: 0» به‌تنهایی هیچ سندی را نمی‌گرفت.
        filter: {
          _id: new mongoose.Types.ObjectId(p.orderId),
          $or: [
            { [`items.${p.index}.variantSnapshot`]: { $exists: false } },
            { [`items.${p.index}.variantSnapshot`]: { $size: 0 } },
          ],
        },
        update: { $set: { [`items.${p.index}.variantSnapshot`]: p.snapshot } },
      },
    }));
    const result = await ordersCol.bulkWrite(ops, { ordered: false });
    console.log(`بازیابی شد: ${result.modifiedCount} خط از ${planned.length}`);
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
