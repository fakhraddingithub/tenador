import "base/models/registerModels";
import Comment from "base/models/Comment";
import Order from "base/models/Order";
import User from "base/models/User";
import ReviewCreditTransaction from "base/models/ReviewCreditTransaction";
import { getReviewCreditConfig } from "@/lib/reviewCreditConfig";
import { runWithOptionalTransaction } from "base/utils/mongoTransactions";

function creditError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validMoney(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

// Use the decimal values stored in Mongo, without binary floating-point
// half-toman errors (1000 * 0.35% must round from 3.5 to 4, not to 3).
function decimalFraction(value) {
  const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
  const [whole, fractional = ""] = mantissa.split(".");
  const scale = fractional.length - Number(exponent);
  const numerator = BigInt(whole + fractional);
  return scale >= 0
    ? [numerator, 10n ** BigInt(scale)]
    : [numerator * 10n ** BigInt(-scale), 1n];
}

function roundPercent(base, value) {
  const [baseN, baseD] = decimalFraction(base);
  const [valueN, valueD] = decimalFraction(value);
  const numerator = baseN * valueN;
  const denominator = baseD * valueD * 100n;
  return Number((2n * numerator + denominator) / (2n * denominator));
}

async function grantInSession(comment, session) {
  if (comment.parent || !comment.order || !comment.isVerifiedPurchase ||
      Boolean(comment.product) === Boolean(comment.usedProduct)) {
    return { status: "ineligible" };
  }
  const order = await Order.findById(comment.order).session(session).lean();
  if (!order || String(order.user) !== String(comment.user) ||
      !["SENT", "DELIVERED"].includes(order.fulfillmentStatus)) {
    return { status: "ineligible" };
  }
  const itemType = comment.product ? "product" : "usedProduct";
  const item = comment[itemType];
  const lines = order.items.filter((line) =>
    String(line[itemType] || "") === String(item) &&
    (itemType === "usedProduct" ? line.itemType === "used_product" : line.itemType !== "used_product")
  );
  if (!lines.length) return { status: "ineligible" };

  // Legacy ledger rows may already have increased the wallet: never repay them
  // automatically. A whole-order reward also covers every product in it.
  const prior = await ReviewCreditTransaction.find({ order: order._id }).session(session).lean();
  if (prior.some((tx) => !tx.item || String(tx.item) === String(item))) {
    return { status: "already_granted" };
  }
  const config = await getReviewCreditConfig(session);
  if (!config.enabled) return { status: "disabled" };
  // Do not stack a whole-order reward on previously awarded item rewards.
  if (config.granularity === "per-order" && prior.length) return { status: "already_granted" };
  const user = await User.findById(comment.user).session(session).lean();
  if (!user || !config.eligibleRoles.includes(user.role)) return { status: "ineligible" };

  let base = order.totalPrice;
  if (config.granularity === "per-item") {
    base = 0;
    for (const line of lines) {
      if (!validMoney(line.unitPrice) || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
        throw creditError("قیمت یا تعداد محصول در سفارش معتبر نیست", "INVALID_REVIEW_CREDIT_AMOUNT");
      }
      base += line.unitPrice * line.quantity;
    }
  }
  if (!validMoney(base)) {
    throw creditError("مبلغ مبنای پاداش معتبر نیست", "INVALID_REVIEW_CREDIT_AMOUNT");
  }
  const amount = config.kind === "percent" ? roundPercent(base, config.value) : Math.round(config.value);
  if (!Number.isSafeInteger(amount)) {
    throw creditError("مبلغ پاداش معتبر نیست", "INVALID_REVIEW_CREDIT_AMOUNT");
  }
  if (amount === 0) return { status: "zero_amount" };
  if (!validMoney(user.walletBalance ?? 0) || !validMoney((user.walletBalance ?? 0) + amount)) {
    throw creditError("موجودی کیف پول معتبر نیست", "INVALID_REVIEW_CREDIT_AMOUNT");
  }
  // Money must never use the optional helper's non-transactional fallback.
  if (!session?.inTransaction()) {
    throw creditError("واریز پاداش به پشتیبانی تراکنش اتمی MongoDB نیاز دارد؛ تأیید نظر ثبت نشد", "REVIEW_CREDIT_TRANSACTION_REQUIRED");
  }
  await ReviewCreditTransaction.create([{
    order: order._id, user: user._id, comment: comment._id,
    itemType: config.granularity === "per-item" ? itemType : null,
    item: config.granularity === "per-item" ? item : null,
    granularity: config.granularity, kind: config.kind, value: config.value, amount,
  }], { session });
  // Serializes grants for one owner. A concurrent wallet write forces Mongo to
  // retry the complete transaction and re-read the ledger, including scope changes.
  const update = await User.updateOne({ _id: user._id }, { $inc: { walletBalance: amount } }, { session });
  if (update.modifiedCount !== 1) throw new Error("Review credit wallet update failed");
  return { status: "granted", amount, userId: user._id, email: user.email, trackingCode: order.trackingCode };
}

// Caller authenticates the moderator and connects to DB. No external side
// effects here: Mongo may re-run this callback after a transient conflict.
export async function moderateCommentWithReviewCredit(id, status) {
  if (!["approved", "rejected", "pending"].includes(status)) throw new Error("Invalid comment status");
  return runWithOptionalTransaction(async (session) => {
    const comment = await Comment.findById(id).session(session);
    if (!comment) return null;
    const credit = status === "approved"
      ? await grantInSession(comment, session)
      : { status: "not_requested" };
    comment.status = status;
    // Force a versioned write on re-approval too, to conflict with a concurrent
    // rejection/deletion instead of granting against an outdated comment read.
    comment.increment();
    await comment.save({ session });
    return { comment, credit };
  });
}
