/**
 * scripts/linkEurReceiptRows.mjs
 *
 * پیش از اتصالِ یورو به رسید (paymentsEUR[].payment)، پنجره‌ی «تأیید رسید» یوروی همراه را
 * به‌صورت یک ردیفِ بی‌پیوند با یادداشتِ «ثبت همراه تأیید رسید» می‌ساخت؛ پس «ویرایشِ» آن رسید
 * یورویش را نمی‌شناسد. این اسکریپت هر چنین ردیفی را به رسیدش وصل می‌کند — فقط وقتی مدرک
 * قطعی است:
 *   - رسیدِ همان سفارش، PAID، با bankReceipt.reviewedAt (لحظه‌ی تأیید)
 *   - ردیف حداکثر MAX_LAG پس از تأیید ساخته شده (کلاینت بلافاصله بعد از تأیید POST می‌کرد)
 *   - دقیقاً یک رسید در این بازه، آن رسید ردیفِ پیوندخورده‌ی دیگری ندارد، و ردیفِ دیگری هم
 *     همان رسید را ادعا نمی‌کند
 * هر چیزِ مبهم دست‌نخورده می‌ماند و گزارش می‌شود. مبلغ‌ها تغییر نمی‌کنند؛ فقط `payment` ست می‌شود.
 *
 *   npm run check:eur-receipt-links     # فقط گزارش
 *   npm run migrate:eur-receipt-links   # اعمال
 *
 * idempotent است: ردیفِ وصل‌شده دیگر دیده نمی‌شود.
 */

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

export const LEGACY_NOTE = "ثبت همراه تأیید رسید";
export const MAX_LAG_MS = 10 * 60 * 1000;

const id = (v) => (v == null ? "" : String(v));
const time = (v) => (v ? new Date(v).getTime() : NaN);

/**
 * @param {Array} rows      order.paymentsEUR
 * @param {Array} receipts  Payment‌های PAIDِ همان سفارش ({ _id, bankReceipt: { reviewedAt } })
 * @returns {{ links: Array<{ rowId, paymentId }>, skipped: Array<{ rowId, reason }> }}
 */
export function matchLegacyReceiptRows(rows, receipts) {
  const list = Array.isArray(rows) ? rows : [];
  const alreadyLinked = new Set(list.filter((r) => r?.payment).map((r) => id(r.payment)));
  const candidates = [];
  const skipped = [];

  for (const row of list) {
    if (row?.payment || row?.installmentCheck || row?.note !== LEGACY_NOTE) continue;
    const at = time(row.confirmedAt ?? row.createdAt);
    const hits = (receipts || []).filter((p) => {
      const lag = at - time(p?.bankReceipt?.reviewedAt);
      return lag >= 0 && lag <= MAX_LAG_MS;
    });
    if (hits.length !== 1) {
      skipped.push({ rowId: id(row._id), reason: hits.length ? "چند رسید در بازه" : "رسیدی در بازه نیست" });
    } else if (alreadyLinked.has(id(hits[0]._id))) {
      skipped.push({ rowId: id(row._id), reason: "رسید از قبل ردیفِ یوروی وصل‌شده دارد" });
    } else {
      candidates.push({ rowId: id(row._id), paymentId: id(hits[0]._id) });
    }
  }

  const claims = new Map();
  for (const c of candidates) claims.set(c.paymentId, (claims.get(c.paymentId) || 0) + 1);
  const links = [];
  for (const c of candidates) {
    if (claims.get(c.paymentId) > 1) skipped.push({ rowId: c.rowId, reason: "چند ردیف یک رسید را ادعا می‌کنند" });
    else links.push(c);
  }
  return { links, skipped };
}

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // متغیرهای محیطی از خودِ runtime می‌آیند
  }
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI_TENADOR;
  if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است.");

  const conn = await mongoose
    .createConnection(uri, { bufferCommands: false, serverSelectionTimeoutMS: 20000 })
    .asPromise();
  try {
    const orders = conn.collection("orders");
    const payments = conn.collection("payments");
    const cursor = orders.find(
      { paymentsEUR: { $elemMatch: { note: LEGACY_NOTE, payment: { $in: [null] }, installmentCheck: { $in: [null] } } } },
      { projection: { trackingCode: 1, paymentsEUR: 1 } }
    );

    let linked = 0;
    let skippedCount = 0;
    for await (const order of cursor) {
      const receipts = await payments
        .find({ order: order._id, status: "PAID" }, { projection: { "bankReceipt.reviewedAt": 1 } })
        .toArray();
      const { links, skipped } = matchLegacyReceiptRows(order.paymentsEUR, receipts);
      for (const s of skipped) console.log(`  ✗ ${order.trackingCode || order._id} · ردیف ${s.rowId}: ${s.reason}`);
      for (const l of links) console.log(`  ✓ ${order.trackingCode || order._id} · ردیف ${l.rowId} → رسید ${l.paymentId}`);
      skippedCount += skipped.length;
      linked += links.length;

      if (apply) {
        for (const l of links) {
          // فقط اگر هنوز بی‌پیوند است (اجرای هم‌زمان یا تغییرِ پنل در این فاصله)
          await orders.updateOne(
            { _id: order._id, paymentsEUR: { $elemMatch: { _id: new mongoose.Types.ObjectId(l.rowId), payment: { $in: [null] } } } },
            { $set: { "paymentsEUR.$.payment": new mongoose.Types.ObjectId(l.paymentId) } }
          );
        }
      }
    }

    console.log(`\n${apply ? "وصل شد" : "قابل وصل"}: ${linked} · مبهم/رها‌شده: ${skippedCount}`);
    if (!apply && linked) console.log("برای اعمال: npm run migrate:eur-receipt-links");
  } finally {
    await conn.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
