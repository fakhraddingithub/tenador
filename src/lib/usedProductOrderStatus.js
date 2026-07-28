import { revalidatePath } from "next/cache";
import UsedProduct from "base/models/UsedProduct";

/**
 * محصولات دست‌دوم یک سفارش تأییدشده را فروخته‌شده می‌کند.
 *
 * شرط order مانع از آن می‌شود که یک درخواست قدیمی، محصولی را که رزرو آن به
 * سفارش دیگری منتقل شده تغییر دهد.
 */
export async function markOrderUsedProductsSold(order) {
  if (!order?._id || !Array.isArray(order.items)) return 0;

  const ids = [
    ...new Set(
      order.items
        .filter((item) => item.itemType === "used_product" && item.usedProduct)
        .map((item) => String(item.usedProduct?._id || item.usedProduct))
    ),
  ];

  if (ids.length === 0) return 0;

  const products = await UsedProduct.find({
    _id: { $in: ids },
    order: order._id,
    status: { $ne: "sold" },
  })
    .select("_id slug")
    .lean();

  if (products.length === 0) return 0;

  const productIds = products.map((product) => product._id);
  const result = await UsedProduct.updateMany(
    {
      _id: { $in: productIds },
      order: order._id,
      status: { $ne: "sold" },
    },
    { $set: { status: "sold" } }
  );

  try {
    revalidatePath("/second-hand", "layout");
    for (const product of products) {
      if (product.slug) revalidatePath(`/second-hand/${product.slug}`);
    }
  } catch {
    // تغییر وضعیت مستقل از در دسترس بودن کش Next.js باید موفق بماند.
  }

  return result.modifiedCount || 0;
}
