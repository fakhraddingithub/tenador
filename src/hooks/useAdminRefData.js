"use client";

import useSWR from "swr";

/**
 * 🟢 داده‌ی مرجعِ کاتالوگ برای دراپ‌داون‌های پنل مدیریت.
 *
 * همان چیزی که در Stage 3 برای فیلترهای admin-products تأیید شد، فقط یک‌جا
 * جمع شده: ورزش/برند/دسته/ورزشکار/سری در ده‌ها فرمِ ادمین تکرار می‌شوند و
 * قبلاً هر بار باز شدنِ هر فرم همه را دوباره واکشی می‌کرد. با SWR این‌ها یک
 * کشِ مشترک دارند، پس باز کردنِ چند فرمِ پشت‌سرهم صفر درخواستِ اضافه دارد.
 *
 * صفحه‌های مدیریتِ خودِ این موجودیت‌ها (admin-sports، admin-brands و …) هم از
 * همین هوک‌ها استفاده می‌کنند؛ چون کلیدِ SWR یکی است، کش بین دراپ‌داون‌ها و
 * صفحه‌ی مدیریت مشترک است. برای همین `mutate` هم برگردانده می‌شود: هر
 * تغییری (جابه‌جایی، حذف، ویرایش) باید کش را همان‌جا به‌روز کند.
 *
 * شکلِ کشِ هر کلید، عیناً همان پاسخِ سرور است (`{ sports: [...] }` و …) — هنگام
 * نوشتنِ خوش‌بینانه باید همان شکل داده شود، نه فقط آرایه.
 */
export const ADMIN_REF_TTL = { dedupingInterval: 300_000 };
const REF_DATA = ADMIN_REF_TTL;

export function useSports() {
  const { data, error, isLoading, mutate } = useSWR("/api/sports", REF_DATA);
  return { sports: data?.sports || [], error, isLoading, mutate };
}

export function useBrands() {
  const { data, error, isLoading, mutate } = useSWR("/api/brands", REF_DATA);
  return { brands: data?.brands || [], error, isLoading, mutate };
}

/** نسخه‌ی سبک برندها برای multi-selectها؛ بدون populate شدن تمام سری‌های هر برند. */
export function useCompactBrands() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/brands?compact=1",
    REF_DATA,
  );
  return { brands: data?.brands || [], error, isLoading, mutate };
}

export function useAthletes() {
  const { data, error, isLoading, mutate } = useSWR("/api/athletes", REF_DATA);
  return { athletes: data?.athletes || [], error, isLoading, mutate };
}

/**
 * sportId اختیاری — دسته‌ها زیرِ یک ورزش محدود می‌شوند.
 * enabled=false یعنی هیچ درخواستی زده نشود (کلیدِ null در SWR).
 */
export function useCategories(sportId, enabled = true) {
  const { data, error, isLoading, mutate } = useSWR(
    !enabled
      ? null
      : sportId
        ? `/api/categories?sportId=${sportId}`
        : "/api/categories",
    REF_DATA,
  );
  return { categories: data?.categories || [], error, isLoading, mutate };
}

/** نسخه‌های محدود — محتوای کاتالوگ، هم‌ردهٔ بقیه‌ی داده‌ی مرجع. */
export function useLimitedEditions(brandId) {
  const { data, error, isLoading, mutate } = useSWR(
    brandId ? `/api/limited-editions?brand=${brandId}` : "/api/limited-editions",
    REF_DATA,
  );
  return {
    limitedEditions: data?.limitedEditions || [],
    error,
    isLoading,
    mutate,
  };
}

/** brandId اختیاری — سری‌ها زیرِ یک برند محدود می‌شوند. */
export function useSeries(brandId) {
  const { data, error, isLoading, mutate } = useSWR(
    brandId ? `/api/series?brand=${brandId}` : "/api/series",
    REF_DATA,
  );
  return { series: data?.series || [], error, isLoading, mutate };
}
