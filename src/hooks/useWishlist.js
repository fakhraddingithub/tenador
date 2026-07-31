"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "react-toastify";

const WISHLIST_KEY = "/api/wishlist";

async function fetchWishlist(url) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    return { wishlist: [], authenticated: false };
  }
  if (!response.ok) {
    throw new Error(data.error || "بارگذاری علاقه‌مندی‌ها انجام نشد");
  }

  return { wishlist: data.wishlist || [], authenticated: true };
}

/**
 * منبع واحد وضعیت علاقه‌مندی‌ها در کل رابط کاربری.
 * SWR درخواست همهٔ کارت‌ها/مودال‌ها را یکی می‌کند و تغییرات خوش‌بینانه را
 * بلافاصله میان تمام نمونه‌های باز همگام نگه می‌دارد.
 */
export default function useWishlist(product = null) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, error, isLoading, mutate } = useSWR(WISHLIST_KEY, fetchWishlist, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const productId = String(product?._id || product || "");
  const items = useMemo(() => data?.wishlist || [], [data?.wishlist]);
  const ids = useMemo(
    () => new Set(items.map((item) => String(item?._id || item))),
    [items]
  );
  const isWishlisted = Boolean(productId && ids.has(productId));

  const toggle = async () => {
    if (!productId || isLoading) return false;

    if (data?.authenticated === false) {
      toast.info("برای ذخیره در علاقه‌مندی‌ها ابتدا وارد حساب کاربری شوید");
      const redirect = pathname ? `?callbackUrl=${encodeURIComponent(pathname)}` : "";
      router.push(`/login-register${redirect}`);
      return false;
    }

    const wasWishlisted = isWishlisted;
    const previous = data || { wishlist: [], authenticated: true };
    const nextItems = wasWishlisted
      ? items.filter((item) => String(item?._id || item) !== productId)
      : [...items, typeof product === "object" && product ? product : { _id: productId }];

    await mutate({ ...previous, wishlist: nextItems }, { revalidate: false });

    try {
      const response = await fetch(WISHLIST_KEY, {
        method: wasWishlisted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        await mutate({ wishlist: [], authenticated: false }, { revalidate: false });
        toast.info("برای ذخیره در علاقه‌مندی‌ها ابتدا وارد حساب کاربری شوید");
        router.push(`/login-register?callbackUrl=${encodeURIComponent(pathname || "/")}`);
        return false;
      }
      if (!response.ok) throw new Error(result.error || "ثبت تغییر انجام نشد");

      toast.success(
        wasWishlisted ? "از علاقه‌مندی‌ها حذف شد" : "به علاقه‌مندی‌ها اضافه شد"
      );
      return true;
    } catch (requestError) {
      await mutate(previous, { revalidate: false });
      toast.error(requestError.message || "خطا در ارتباط با سرور");
      return false;
    }
  };

  return {
    items,
    isWishlisted,
    isLoading,
    error,
    authenticated: data?.authenticated,
    toggle,
    refresh: mutate,
  };
}
