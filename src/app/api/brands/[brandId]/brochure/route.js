import Brand from "base/models/Brand";
import { brochureRouteHandlers } from "@/lib/brochureRoute";

/**
 * بروشورِ برند برای ویرایشگر — شاملِ پیش‌نویس، پس پشتِ همان گیتِ ویرایشِ برند است.
 * پیاده‌سازی مشترکِ همه‌ی بروشورهاست (src/lib/brochureRoute.js)؛ بروشورِ ورزش
 * همین را با Sport می‌گیرد.
 */
const handlers = brochureRouteHandlers({
  Model: Brand,
  param: "brandId",
  permission: "brands.edit",
  noun: "برند",
  revalidateTags: ["navbar", "brands"],
});

export const GET = handlers.GET;
export const PUT = handlers.PUT;
