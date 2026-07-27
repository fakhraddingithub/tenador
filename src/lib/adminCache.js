"use client";

import { mutate as globalMutate } from "swr";

/**
 * جابه‌جاییِ خوش‌بینانه‌ی یک لیستِ مرتب + ذخیره‌ی ترتیب در سرور.
 *
 * تنها منبعِ حقیقت، کشِ SWR است (نه یک نسخه‌ی محلیِ موازی): `optimisticData`
 * لیست را بلافاصله جابه‌جا می‌کند و اگر درخواستِ ذخیره شکست بخورد،
 * `rollbackOnError` خودِ SWR ترتیبِ قبل از درگ را برمی‌گرداند.
 *
 * @param {Function} mutate      همان mutate که از useSWR گرفته شده
 * @param {*} nextCache          شکلِ کاملِ کش پس از جابه‌جایی (نه فقط آرایه)
 * @param {() => Promise<Response>} persist  درخواستِ ذخیره (سمت سرور دست‌نخورده)
 */
export function optimisticReorder(mutate, nextCache, persist) {
  return mutate(
    async () => {
      const res = await persist();
      if (!res?.ok) throw new Error("reorder failed");
      return nextCache;
    },
    {
      optimisticData: nextCache,
      rollbackOnError: true,
      populateCache: true,
      revalidate: false,
    },
  );
}

/**
 * باطل‌کردنِ کشِ SWR برای همه‌ی کلیدهایی که با prefix شروع می‌شوند.
 *
 * صفحه‌های افزودن/ویرایش با router.push به لیست برمی‌گردند و آن‌جا mount
 * نشده‌اند، پس نمی‌توانند mutate صفحه‌ی لیست را صدا بزنند. global mutate
 * نشانگرِ dedupe را پاک می‌کند (`delete FETCH[key]`)، در نتیجه لیست هم‌چنان
 * فوری از کش رسم می‌شود ولی این بار یک واکشیِ واقعی هم می‌زند و به‌روز می‌شود.
 */
export function invalidateAdminCache(prefix) {
  return globalMutate(
    (key) => typeof key === "string" && key.startsWith(prefix),
  );
}
