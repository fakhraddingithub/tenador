import "base/models/registerModels";
import Sport from "base/models/Sport";
import { brochureRouteHandlers } from "@/lib/brochureRoute";

/**
 * بروشورِ ورزش برای ویرایشگر — همان پیاده‌سازیِ بروشورِ برند (src/lib/brochureRoute.js)
 * با Sport، پشتِ مجوزِ ویرایشِ ورزش. نسخه‌ی منتشرشده جای صفحه‌ی /[sport] را می‌گیرد.
 */
const handlers = brochureRouteHandlers({
  Model: Sport,
  param: "sportId",
  permission: "sports.edit",
  noun: "ورزش",
  revalidateTags: ["navbar", "sports"],
});

export const GET = handlers.GET;
export const PUT = handlers.PUT;
