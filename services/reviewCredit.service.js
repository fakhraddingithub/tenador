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

async function grantInSession(comment, session, options = {}) {
  const cache = options.cache;
  if (comment.parent || !comment.order || !comment.isVerifiedPurchase ||
      Boolean(comment.product) === Boolean(comment.usedProduct)) {
    return { status: "ineligible" };
  }
  const order = cache ? cache.orders.get(String(comment.order)) : await Order.findById(comment.order).session(session).lean();
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
  const prior = cache ? (cache.credits.get(String(order._id)) || []) : await ReviewCreditTransaction.find({ order: order._id }).session(session).lean();
  const paid = prior.find(tx => !tx.item || String(tx.item) === String(item));
  if (paid) return { status: "already_granted", amount: paid.amount };
  const config = cache ? cache.config : await getReviewCreditConfig(session);
  if (!config.enabled) return { status: "disabled" };
  // Do not stack a whole-order reward on previously awarded item rewards.
  if (config.granularity === "per-order" && prior.length) return { status: "already_granted" };
  const user = cache ? cache.users.get(String(comment.user)) : await User.findById(comment.user).session(session).lean();
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
  const amount = comment.reviewRewardAmount != null ? comment.reviewRewardAmount : config.kind === "percent" ? roundPercent(base, config.value) : Math.round(config.value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw creditError("مبلغ پاداش معتبر نیست", "INVALID_REVIEW_CREDIT_AMOUNT");
  }
  if (options.preview) return { status: amount === 0 ? "zero_amount" : "eligible", amount };
  if (options.expectedAmount !== undefined && options.expectedAmount !== amount) throw creditError("مبلغ پاداش تغییر کرده است؛ فهرست نظرات را تازه کنید", "REVIEW_CREDIT_CONFLICT");
  if (amount === 0) return { status: "zero_amount", amount: 0 };
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
    granularity: config.granularity, kind: comment.reviewRewardAmount != null ? "amount" : config.kind, value: comment.reviewRewardAmount != null ? amount : config.value, amount,
  }], { session });
  // Serializes grants for one owner. A concurrent wallet write forces Mongo to
  // retry the complete transaction and re-read the ledger, including scope changes.
  const update = await User.updateOne({ _id: user._id }, { $inc: { walletBalance: amount } }, { session });
  if (update.modifiedCount !== 1) throw new Error("Review credit wallet update failed");
  return { status: "granted", amount, userId: user._id, email: user.email, trackingCode: order.trackingCode };
}

// Caller authenticates the moderator and connects to DB. No external side
// effects here: Mongo may re-run this callback after a transient conflict.
export async function moderateCommentWithReviewCredit(id, status, options = {}) {
  if (!["approved", "rejected", "pending"].includes(status)) throw new Error("Invalid comment status");
  return runWithOptionalTransaction(async (session) => {
    const comment = await Comment.findById(id).select("+reviewRewardAmount +reviewRewardLocked +reviewRewardEditedBy +reviewRewardEditedAt").session(session);
    if (!comment) return null;
    const credit = status === "approved"
      ? await grantInSession(comment, session, options)
      : { status: "not_requested" };
    if (comment.status === "approved" || comment.approved || status === "approved") comment.reviewRewardLocked = true;
    comment.status = status;
    // Force a versioned write on re-approval too, to conflict with a concurrent
    // rejection/deletion instead of granting against an outdated comment read.
    comment.increment();
    await comment.save({ session });
    return { comment, credit };
  });
}

export async function getCommentRewardPreviews(comments) {
  const normalized = comments.map(c => ({ ...c, user: c.user?._id || c.user, product: c.product?._id || c.product, usedProduct: c.usedProduct?._id || c.usedProduct }));
  const orderIds = [...new Set(normalized.map(c => c.order && String(c.order)).filter(Boolean))];
  const userIds = [...new Set(normalized.map(c => c.user && String(c.user)).filter(Boolean))];
  const [orders, users, credits, config] = await Promise.all([
    Order.find({ _id: { $in: orderIds } }).select('user items totalPrice fulfillmentStatus').lean(),
    User.find({ _id: { $in: userIds } }).select('role walletBalance').lean(),
    ReviewCreditTransaction.find({ order: { $in: orderIds } }).select('order item amount comment').lean(),
    getReviewCreditConfig().catch(() => null),
  ]);
  const cache = { orders: new Map(orders.map(o => [String(o._id), o])), users: new Map(users.map(u => [String(u._id), u])), credits: new Map(), config };
  for (const tx of credits) { const key = String(tx.order); cache.credits.set(key, [...(cache.credits.get(key) || []), tx]); }
  return Promise.all(normalized.map(async c => {
    try {
      if (!config) return { status: 'error', amount: null, canEdit: false };
      const reward = await grantInSession(c, null, { preview: true, cache });
      return { ...reward, amount: reward.amount ?? 0, custom: c.reviewRewardAmount != null,
        canEdit: !c.reviewRewardLocked && c.status !== 'approved' && !c.approved && ['eligible', 'zero_amount'].includes(reward.status) };
    } catch { return { status: 'error', amount: null, canEdit: false }; }
  }));
}

export async function setCommentRewardAmount(id, amount, adminId) {
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) throw creditError('مبلغ پاداش باید عدد صحیح و نامنفی به تومان باشد', 'INVALID_REVIEW_CREDIT_AMOUNT');
  return runWithOptionalTransaction(async session => {
    if (!session?.inTransaction()) throw creditError('ویرایش پاداش به تراکنش امن نیاز دارد', 'REVIEW_CREDIT_TRANSACTION_REQUIRED');
    const comment = await Comment.findById(id).select("+reviewRewardAmount +reviewRewardLocked +reviewRewardEditedBy +reviewRewardEditedAt").session(session);
    if (!comment) return null;
    if (comment.status === 'approved' || comment.approved || comment.reviewRewardLocked) throw creditError('مبلغ پاداش پس از تأیید نظر قابل تغییر نیست', 'REVIEW_CREDIT_CONFLICT');
    const reward = await grantInSession(comment, session, { preview: true });
    if (!['eligible', 'zero_amount'].includes(reward.status)) throw creditError('این نظر واجد پاداش قابل ویرایش نیست یا پاداش آن قبلاً ثبت شده است', 'REVIEW_CREDIT_CONFLICT');
    comment.reviewRewardAmount = amount;
    comment.reviewRewardEditedBy = adminId;
    comment.reviewRewardEditedAt = new Date();
    comment.increment();
    await comment.save({ session });
    return { amount: (await grantInSession(comment, session, { preview: true })).amount ?? 0 };
  });
}
