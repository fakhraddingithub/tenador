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
 * نکته: این هوک فقط برای مصرفِ «فقط‌خواندنی» (گزینه‌های دراپ‌داون) است. صفحه‌های
 * مدیریتِ خودِ این موجودیت‌ها (admin-sports، admin-brands و …) عمداً دست‌نخورده
 * مانده‌اند چون لیستشان با drag-reorder به‌صورت محلی تغییر می‌کند و تبدیلشان
 * یعنی بازنویسیِ منطقِ mutation، نه صرفاً سیم‌کشیِ کش.
 */
const REF_DATA = { dedupingInterval: 300_000 };

export function useSports() {
  const { data, error, isLoading } = useSWR("/api/sports", REF_DATA);
  return { sports: data?.sports || [], error, isLoading };
}

export function useBrands() {
  const { data, error, isLoading } = useSWR("/api/brands", REF_DATA);
  return { brands: data?.brands || [], error, isLoading };
}

export function useAthletes() {
  const { data, error, isLoading } = useSWR("/api/athletes", REF_DATA);
  return { athletes: data?.athletes || [], error, isLoading };
}

/**
 * sportId اختیاری — دسته‌ها زیرِ یک ورزش محدود می‌شوند.
 * enabled=false یعنی هیچ درخواستی زده نشود (کلیدِ null در SWR).
 */
export function useCategories(sportId, enabled = true) {
  const { data, error, isLoading } = useSWR(
    !enabled
      ? null
      : sportId
        ? `/api/categories?sportId=${sportId}`
        : "/api/categories",
    REF_DATA,
  );
  return { categories: data?.categories || [], error, isLoading };
}

/** نسخه‌های محدود — محتوای کاتالوگ، هم‌ردهٔ بقیه‌ی داده‌ی مرجع. */
export function useLimitedEditions() {
  const { data, error, isLoading } = useSWR("/api/limited-editions", REF_DATA);
  return { limitedEditions: data?.limitedEditions || [], error, isLoading };
}

/** brandId اختیاری — سری‌ها زیرِ یک برند محدود می‌شوند. */
export function useSeries(brandId) {
  const { data, error, isLoading } = useSWR(
    brandId ? `/api/series?brand=${brandId}` : "/api/series",
    REF_DATA,
  );
  return { series: data?.series || [], error, isLoading };
}
