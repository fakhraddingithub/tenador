/**
 * بررسیِ optimisticReorder — قلبِ جابه‌جاییِ خوش‌بینانه در صفحه‌های مدیریت.
 * jest در این مخزن کار نمی‌کند (tests/setup.js وجود ندارد)، پس assert خالص.
 *
 *   node scripts/check-admin-cache.mjs
 */
import assert from "node:assert/strict";
import { optimisticReorder } from "../src/lib/adminCache.js";

/** mutate قلابی — همان قراردادی که SWR دارد: (fn, options) */
function fakeMutate() {
  const calls = [];
  const mutate = async (fn, options) => {
    calls.push({ options });
    // SWR تابع را اجرا می‌کند و خطایش را به فراخوان پس می‌دهد
    const value = await fn();
    calls[calls.length - 1].value = value;
    return value;
  };
  mutate.calls = calls;
  return mutate;
}

const NEXT = { sports: [{ _id: "b" }, { _id: "a" }] };

// ۱) مسیر موفق — کش با nextCache پر می‌شود و persist دقیقاً یک بار صدا می‌خورد
{
  const mutate = fakeMutate();
  let persistCalls = 0;
  const value = await optimisticReorder(mutate, NEXT, async () => {
    persistCalls++;
    return { ok: true };
  });

  assert.equal(persistCalls, 1, "persist باید یک بار صدا شود");
  assert.deepEqual(value, NEXT, "مقدارِ نهاییِ کش باید nextCache باشد");
  assert.deepEqual(mutate.calls[0].value, NEXT);
}

// ۲) گزینه‌ها — بدونِ این‌ها نه جابه‌جاییِ فوری داریم نه بازگردانی
{
  const mutate = fakeMutate();
  await optimisticReorder(mutate, NEXT, async () => ({ ok: true }));
  const opts = mutate.calls[0].options;

  assert.deepEqual(opts.optimisticData, NEXT, "optimisticData باید همان nextCache باشد");
  assert.equal(opts.rollbackOnError, true, "بدون rollbackOnError خطا برنمی‌گردد");
  assert.equal(opts.populateCache, true);
  assert.equal(opts.revalidate, false, "بعد از ذخیره نباید دوباره واکشی شود");
}

// ۳) پاسخِ ناموفقِ سرور (ok=false) باید throw کند تا SWR رول‌بک کند
{
  const mutate = fakeMutate();
  await assert.rejects(
    () => optimisticReorder(mutate, NEXT, async () => ({ ok: false })),
    /reorder failed/,
    "res.ok=false باید خطا بدهد",
  );
}

// ۴) خطای شبکه (fetch خودش throw می‌کند) هم باید عبور کند، نه بلعیده شود
{
  const mutate = fakeMutate();
  await assert.rejects(
    () =>
      optimisticReorder(mutate, NEXT, async () => {
        throw new Error("network down");
      }),
    /network down/,
  );
}

// ۵) پاسخِ undefined (مثلاً fetch لغو شده) نباید به‌عنوان موفقیت جا بزند
{
  const mutate = fakeMutate();
  await assert.rejects(
    () => optimisticReorder(mutate, NEXT, async () => undefined),
    /reorder failed/,
  );
}

console.log("✓ optimisticReorder — همه‌ی بررسی‌ها موفق");
