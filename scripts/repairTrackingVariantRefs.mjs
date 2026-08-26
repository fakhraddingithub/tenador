/**
 * scripts/repairTrackingVariantRefs.mjs
 *
 * ویرایشِ محصول در پنل ادمین، واریانت‌ها را حذف و از نو می‌سازد
 * (src/app/api/product/[productId]/route.js) — پس _id واریانت‌ها عوض می‌شود،
 * حتی وقتی خودِ ترکیبِ ویژگی‌ها هیچ تغییری نکرده باشد. اما دیتابیسِ انبار
 * `variantRef` را به‌صورت ObjectId نگه داشته و همان _id قدیمی را دارد.
 *
 * نتیجه: هنگام اسکنِ بارکد روی سفارش، این بررسی در
 * src/app/api/admin/orders/[orderId]/tracking/route.js شکست می‌خورد:
 *     «این بارکد متعلق به واریانت دیگری از این محصول است»
 * در حالی که بارکد و آیتمِ سفارش دقیقاً یک واریانت‌اند.
 *
 * این اسکریپت variantRef های یتیم (بدون سند واریانتِ متناظر) را به _id جدیدِ
 * همان واریانت وصل می‌کند. مرجعِ تطبیق، فیلدِ `variantKey` است که خودِ پروژه‌ی
 * انبار روی هر بارکد به‌صورت اسنپ‌شات ذخیره می‌کند (مثل "grip=l2").
 *
 *   npm run check:tracking-variant-refs    # فقط گزارش
 *   npm run repair:tracking-variant-refs   # اعمال
 *
 * اسکریپت idempotent است: فقط سطرهایی را می‌بیند که variantRef شان یتیم است.
 * در حالتِ اعمال، یک فایلِ rollback کنارِ پروژه نوشته می‌شود.
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
const norm = (v) => String(v ?? "").trim().toLowerCase();

/**
 * ساختِ همان کلیدی که پروژه‌ی انبار در `variantKey` ذخیره می‌کند:
 * جفت‌های «نام=مقدار» با حروفِ کوچک، مرتب بر اساسِ نام، جداشده با «|»
 */
function variantKeyOf(attributes) {
  const attrs =
    attributes instanceof Map ? Object.fromEntries(attributes) : attributes || {};
  return Object.entries(attrs)
    .map(([k, v]) => [norm(k), norm(v)])
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}

/** مقادیرِ یک variantKey بدونِ نامِ ویژگی‌ها — برای وقتی نامِ ویژگی عوض شده */
function valuesOf(key) {
  return key
    .split("|")
    .map((pair) => pair.slice(pair.indexOf("=") + 1))
    .sort()
    .join("|");
}

async function main() {
  const tenadorUri = process.env.MONGODB_URI_TENADOR;
  const warehouseUri = process.env.MONGODB_URI_WAREHOUSE;
  if (!tenadorUri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است.");
  if (!warehouseUri) throw new Error("MONGODB_URI_WAREHOUSE تعریف نشده است.");

  const tenador = await mongoose
    .createConnection(tenadorUri, { bufferCommands: false })
    .asPromise();
  const warehouse = await mongoose
    .createConnection(warehouseUri, { bufferCommands: false })
    .asPromise();

  try {
    const trackings = warehouse.collection("itemtrackings");
    const rows = await trackings.find({ variantRef: { $ne: null } }).toArray();
    const variants = await tenador.collection("variants").find({}).toArray();

    const variantById = new Map(variants.map((v) => [id(v._id), v]));
    const variantsByProduct = new Map();
    for (const v of variants) {
      const key = id(v.productId);
      if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
      variantsByProduct.get(key).push(v);
    }

    // ─── گاردِ ایمنی ───────────────────────────────────────────────
    // قبل از هر نوشتنی، فرضِ اصلی روی سطرهای سالم آزموده می‌شود: اگر
    // variantKeyOf() با آنچه انبار ذخیره کرده هم‌خوان نباشد، تطبیق
    // بی‌معنی است و اسکریپت نباید چیزی را عوض کند.
    //
    // سطرهایی که در اجرای قبلی با ردهٔ «تغییرِ نامِ ویژگی» وصل شده‌اند،
    // variantKey شان همچنان نامِ قدیمی را دارد («string gauge=1.25» در برابرِ
    // «gauge=1.25»). این ناسازگاریِ موردِ انتظار است، نه خطا — پس معیارِ گارد
    // همان تساهلِ آن رده است: مقدارها و تعدادِ ویژگی‌ها باید یکی باشند.
    let checked = 0;
    const keyMismatches = [];
    for (const row of rows) {
      if (!row.variantKey) continue;
      const v = variantById.get(id(row.variantRef));
      if (!v) continue; // یتیم — همان چیزی که قرار است تعمیر شود
      checked++;
      const actual = variantKeyOf(v.attributes);
      const sameKey = actual === row.variantKey;
      const sameValues =
        actual.split("|").length === row.variantKey.split("|").length &&
        valuesOf(actual) === valuesOf(row.variantKey);
      if (!sameKey && !sameValues) {
        keyMismatches.push(
          `${row.trackingId}: انبار="${row.variantKey}" محاسبه‌شده="${actual}"`
        );
      }
    }
    console.log("─── اعتبارسنجیِ منطقِ تطبیق روی سطرهای سالم ───");
    console.log(`   بررسی‌شده: ${checked} | ناسازگار: ${keyMismatches.length}`);
    if (keyMismatches.length) {
      for (const m of keyMismatches.slice(0, 10)) console.log(`   ! ${m}`);
      throw new Error(
        "منطقِ ساختِ variantKey با داده‌ی انبار هم‌خوان نیست؛ هیچ تغییری اعمال نشد."
      );
    }

    // ─── تفکیکِ سطرهای یتیم ────────────────────────────────────────
    const orphans = rows.filter((r) => !variantById.has(id(r.variantRef)));
    const planned = [];
    const skipped = [];

    for (const row of orphans) {
      const candidates = variantsByProduct.get(id(row.productRef)) || [];
      const label = `${row.trackingId} (بارکد ${row.barcode})`;

      if (!candidates.length) {
        skipped.push({ row, label, reason: "این محصول دیگر هیچ واریانتی ندارد" });
        continue;
      }
      if (!row.variantKey) {
        skipped.push({
          row,
          label,
          candidates,
          reason: "بارکد اسنپ‌شاتِ variantKey/variantText ندارد (بارکدهای قدیمی)",
        });
        continue;
      }

      // ۱) تطبیقِ دقیقِ کلید
      let hits = candidates.filter(
        (v) => variantKeyOf(v.attributes) === row.variantKey
      );
      let how = "کلیدِ دقیق";

      // ۲) نامِ ویژگی عوض شده ولی مقدارها یکی‌اند (مثلاً «String gauge» → «gauge»)
      if (hits.length === 0) {
        const wanted = valuesOf(row.variantKey);
        const arity = row.variantKey.split("|").length;
        hits = candidates.filter((v) => {
          const k = variantKeyOf(v.attributes);
          return k.split("|").length === arity && valuesOf(k) === wanted;
        });
        how = "تغییرِ نامِ ویژگی — تطبیق با مقدار";
      }

      if (hits.length === 1) {
        planned.push({ row, target: hits[0], how, label });
      } else if (hits.length === 0) {
        skipped.push({
          row,
          label,
          candidates,
          reason: `ترکیبِ «${row.variantKey}» دیگر روی این محصول وجود ندارد`,
        });
      } else {
        skipped.push({
          row,
          label,
          candidates: hits,
          reason: `مبهم — ${hits.length} واریانت با همین ترکیب`,
        });
      }
    }

    // ─── گزارش ────────────────────────────────────────────────────
    console.log("\n─── وضعیت ───");
    console.log(`   کل بارکدهای دارای variantRef : ${rows.length}`);
    console.log(`   یتیم (واریانتش حذف شده)      : ${orphans.length}`);
    console.log(`   قابلِ تعمیر                   : ${planned.length}`);
    console.log(`   نیازمندِ تصمیمِ انسانی          : ${skipped.length}`);

    if (planned.length) {
      console.log("\n─── نگاشتِ تعمیر ───");
      const groups = new Map();
      for (const p of planned) {
        const k = `${id(p.row.productRef)}|${id(p.row.variantRef)}|${id(p.target._id)}|${p.how}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(p.row.trackingId);
      }
      for (const [k, ids] of groups) {
        const [product, from, to, how] = k.split("|");
        const target = variantById.get(to);
        console.log(
          `   محصول ${product} — «${variantKeyOf(target.attributes)}» (${how})`
        );
        console.log(`      ${from}  →  ${to}   [${ids.length} بارکد] ${ids.join("، ")}`);
      }
    }

    if (skipped.length) {
      console.log("\n─── دست‌نخورده ماند ───");
      for (const s of skipped) {
        console.log(`   ${s.label} — ${s.reason}`);
        console.log(
          `      محصول=${id(s.row.productRef)}` +
            ` variantRefِ مرده=${id(s.row.variantRef)}` +
            ` variantKey=${JSON.stringify(s.row.variantKey ?? null)}` +
            ` سفارش=${s.row.tenadorOrderId ?? "—"}`
        );
        if (s.candidates?.length) {
          console.log(
            `      واریانت‌های فعلی: ${s.candidates
              .map((v) => `${id(v._id)}[${variantKeyOf(v.attributes)}]`)
              .join("  ")}`
          );
        }
      }
    }

    // ─── اعمال ────────────────────────────────────────────────────
    if (!apply) {
      console.log("\nحالتِ read-only — هیچ سندی تغییر نکرد. برای اعمال: --apply");
      return;
    }
    if (!planned.length) {
      console.log("\nچیزی برای تعمیر نبود.");
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rollbackFile = `tracking-variantref-rollback-${stamp}.json`;
    writeFileSync(
      rollbackFile,
      JSON.stringify(
        planned.map((p) => ({
          _id: id(p.row._id),
          trackingId: p.row.trackingId,
          barcode: p.row.barcode,
          productRef: id(p.row.productRef),
          variantKey: p.row.variantKey,
          oldVariantRef: id(p.row.variantRef),
          newVariantRef: id(p.target._id),
        })),
        null,
        2
      ),
      "utf8"
    );
    console.log(`\nفایلِ rollback نوشته شد: ${rollbackFile}`);

    const ops = planned.map((p) => ({
      updateOne: {
        // شرطِ variantRef قدیمی، اسکریپت را در برابرِ اجرای هم‌زمان امن می‌کند
        filter: { _id: p.row._id, variantRef: p.row.variantRef },
        update: { $set: { variantRef: p.target._id } },
      },
    }));
    const result = await trackings.bulkWrite(ops, { ordered: false });
    console.log(`تعمیر شد: ${result.modifiedCount} بارکد از ${planned.length}`);

    const remaining = await trackings.find({ variantRef: { $ne: null } }).toArray();
    const stillOrphan = remaining.filter((r) => !variantById.has(id(r.variantRef)));
    console.log(`یتیمِ باقی‌مانده: ${stillOrphan.length} (انتظار: ${skipped.length})`);
  } finally {
    await warehouse.close().catch(() => {});
    await tenador.close().catch(() => {});
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
