import { randomUUID } from "node:crypto";
import "base/models/registerModels";
import Order from "base/models/Order";

// Serialize barcode/manual mutations across app instances and both databases.
// A lease also recovers automatically after a terminated serverless request.
export async function acquireTrackingMutation(orderId) {
  const token = randomUUID();
  const result = await Order.updateOne({
    _id: orderId,
    $or: [
      { "trackingMutationLock.token": { $exists: false } },
      { "trackingMutationLock.expiresAt": { $lte: new Date() } },
    ],
  }, { $set: { trackingMutationLock: { token, expiresAt: new Date(Date.now() + 120000) } } });
  if (!result.matchedCount) {
    const exists = await Order.exists({ _id: orderId });
    const error = new Error(exists ? "اطلاعات ترکینگ در حال تغییر است؛ چند لحظه دیگر دوباره تلاش کنید" : "سفارش یافت نشد");
    error.status = exists ? 409 : 404;
    throw error;
  }
  const release = async () => {
    // Cleanup must not turn a successfully committed mutation into an HTTP failure.
    try {
      await Order.updateOne({ _id: orderId, "trackingMutationLock.token": token }, { $unset: { trackingMutationLock: "" } });
    } catch (error) {
      console.warn("[orderTrackingMutation release]", error?.message);
    }
  };
  release.assertOwned = async () => {
    const result = await Order.updateOne({ _id: orderId, "trackingMutationLock.token": token }, {
      $set: { "trackingMutationLock.expiresAt": new Date(Date.now() + 120000) },
    });
    if (!result.matchedCount) {
      const error = new Error("مهلت عملیات پایان یافته است؛ اطلاعات را تازه‌سازی کنید و دوباره تلاش کنید");
      error.status = 409;
      throw error;
    }
  };
  return release;
}
