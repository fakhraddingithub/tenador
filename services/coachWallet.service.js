import "base/models/registerModels";
import { createHash } from "node:crypto";
import User from "base/models/User";
import Order from "base/models/Order";
import Product from "base/models/Product";
import CoachCredit from "base/models/CoachCredit";
import { calculateCoachCredit } from "base/services/coachCreditCalculation";
import CoachWalletTransaction from "base/models/CoachWalletTransaction";
import CoachCouponIssue from "base/models/CoachCouponIssue";
import Coupon from "base/models/Coupon";
import WalletTransaction from "base/models/WalletTransaction";
import { runWithOptionalTransaction } from "base/utils/mongoTransactions";
import { getUserFullName } from "base/utils/userName";

export const coachWalletError = (message, status = 409) => Object.assign(new Error(message), { status, code: "WALLET_CHECKOUT_ERROR" });
const money = (amount) => { if (!Number.isSafeInteger(amount) || amount <= 0) throw coachWalletError("مبلغ باید عدد صحیح و مثبت به تومان باشد", 400); };
const transaction = (session) => { if (!session?.inTransaction()) throw coachWalletError("تراکنش امن کیف پول در دسترس نیست؛ دوباره تلاش کنید", 503); };

export async function issueCoachCoupon({ coachId, amount, code, requestKey }) {
  money(amount);
  code = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw coachWalletError("کد باید ۳ تا ۳۰ حرف انگلیسی، عدد، خط تیره یا زیرخط باشد", 400);
  if (typeof requestKey !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(requestKey)) throw coachWalletError("شناسه درخواست نامعتبر است", 400);
  const id = createHash('sha256').update(`${coachId}:${requestKey}`).digest('hex');
  const replay = async (session = null) => {
    const previous = await CoachCouponIssue.findById(id).session(session).lean();
    if (!previous) return null;
    if (previous.code !== code || previous.amount !== amount) throw coachWalletError("این درخواست قبلاً با اطلاعات دیگری ثبت شده است");
    return Coupon.findById(previous.coupon).session(session).lean();
  };
  try {
    return await runWithOptionalTransaction(async (session) => {
      transaction(session);
      const coach = await User.findOne({ _id: coachId, role: "coach", isBanned: { $ne: true } }).session(session);
      if (!coach) throw coachWalletError("دسترسی فقط برای مربی فعال مجاز است", 403);
      const previous = await replay(session);
      if (previous) return { coupon: previous, balance: coach.walletBalance, replayed: true };
      const coupon = new Coupon({ code, discount: { kind: "amount", value: amount }, createdByCoach: coachId,
        coachName: getUserFullName(coach) || "مربی", usageLimit: 1, perUserLimit: null, minCartValue: 0,
        applicableTo: "all", targets: [], startAt: null, endAt: null, active: true });
      await CoachCouponIssue.create([{ _id: id, coach: coachId, code, amount, coupon: coupon._id }], { session });
      const debit = await User.updateOne({ _id: coachId, role: "coach", isBanned: { $ne: true }, walletBalance: { $gte: amount, $lte: Number.MAX_SAFE_INTEGER } }, { $inc: { walletBalance: -amount } }, { session });
      if (debit.modifiedCount !== 1) throw coachWalletError("موجودی کیف پول کافی نیست");
      await coupon.save({ session });
      await WalletTransaction.create([{ user: coachId, coupon: coupon._id, type: "debit", amount,
        description: `تبدیل موجودی به کد تخفیف ${code}` }], { session });
      return { coupon, balance: coach.walletBalance - amount, replayed: false };
    });
  } catch (error) {
    if (error.code === 11000) {
      const previous = await replay();
      if (previous) return { coupon: previous, balance: (await User.findById(coachId).lean())?.walletBalance, replayed: true };
      throw coachWalletError("این عبارت قبلاً برای کد تخفیف استفاده شده است");
    }
    throw error;
  }
}

// Called only inside the transaction that creates the order. Usage survives
// cancellation/deletion; counting current orders would allow re-spending a code.
export async function consumeCoachCoupon(order, session) {
  if (!order.coupon?.createdByCoach) return;
  transaction(session);
  const buyer = await User.findById(order.user).select("name lastName").session(session).lean();
  const coupon = await Coupon.findOneAndUpdate({ _id: order.coupon._id, code: order.coupon.code,
    createdByCoach: order.coupon.createdByCoach, active: true, usedAt: null }, {
    $set: { usedAt: new Date(), usedBy: order.user, usedByName: getUserFullName(buyer) || "کاربر",
      usedOrder: order._id, usedTrackingCode: order.trackingCode, appliedAmount: order.couponDiscount },
  }, { session, returnDocument: 'after' });
  if (!coupon) throw coachWalletError("این کد تخفیف قبلاً مصرف شده یا غیرفعال است");
  if (coupon.discount.kind !== "amount" || !Number.isSafeInteger(order.couponDiscount) || order.couponDiscount <= 0 || order.couponDiscount > coupon.discount.value) throw coachWalletError("مبلغ کد تخفیف تغییر کرده است؛ سبد را تازه کنید");
  const remainder = coupon.discount.value - order.couponDiscount;
  if (remainder > 0) {
    money(remainder);
    const refunded = await User.updateOne({ _id: coupon.createdByCoach, walletBalance: { $lte: Number.MAX_SAFE_INTEGER - remainder } }, { $inc: { walletBalance: remainder } }, { session });
    if (refunded.modifiedCount !== 1) throw coachWalletError("بازگشت باقیمانده کد به کیف پول مربی انجام نشد");
    coupon.returnedAmount = remainder;
    await coupon.save({ session });
    await WalletTransaction.create([{ user: coupon.createdByCoach, coupon: coupon._id, order: order._id, trackingCode: order.trackingCode,
      type: "credit", amount: remainder, description: `بازگشت باقیمانده کد تخفیف ${coupon.code}` }], { session });
  }
}

export async function addCoachCredit({ coachId, studentId = null, orderId = null, amount, addedBy, note = "" }) {
  money(amount);
  return runWithOptionalTransaction(async (session) => {
    transaction(session);
    if (orderId) {
      const order = await Order.findById(orderId).session(session).lean();
      if (!order) throw coachWalletError("سفارش یافت نشد", 404);
      studentId = order.user;
    }
    const coach = await User.findOneAndUpdate({ _id: coachId, role: "coach", isBanned: { $ne: true }, walletBalance: { $lte: Number.MAX_SAFE_INTEGER - amount } }, { $inc: { walletBalance: amount } }, { session, returnDocument: "after" });
    if (!coach) throw coachWalletError("مربی فعال یافت نشد یا مبلغ موجودی نامعتبر است", 409);
    await CoachWalletTransaction.create([{ coach: coachId, student: studentId, order: orderId, amount, addedBy, note, source: "manual" }], { session });
    return coach.walletBalance;
  });
}

export async function grantAutomaticCoachCredit(order, session) {
  if (!order.coachCreditEligible || order.coachCreditProcessedAt || order.paymentStatus !== "PAID" || order.fulfillmentStatus === "CANCELED") return 0;
  transaction(session);
  // Touch the order before the money. Competing payment events conflict here.
  const claimed = await Order.updateOne({ _id: order._id, coachCreditProcessedAt: null }, { $set: { coachCreditProcessedAt: new Date() } }, { session });
  if (claimed.modifiedCount !== 1) return 0;
  order.coachCreditProcessedAt = new Date();
  const buyer = await User.findById(order.user).select("coach").session(session).lean();
  if (!buyer?.coach || String(buyer.coach) === String(order.user)) return 0;
  const coach = await User.findOne({ _id: buyer.coach, role: "coach", isBanned: { $ne: true } }).session(session).lean();
  if (!coach) return 0;
  const products = await Product.find({ _id: { $in: order.items.map(i => i.product).filter(Boolean) } }).select("category serie").session(session).lean();
  const items = order.items.map(item => {
    const product = products.find(p => String(p._id) === String(item.product));
    return { productId: item.product, categoryId: product?.category, serieId: product?.serie, lineTotalToman: item.unitPrice * item.quantity };
  });
  const previousPurchase = await Order.exists({ _id: { $ne: order._id }, user: order.user, paymentStatus: "PAID", fulfillmentStatus: { $ne: "CANCELED" } }).session(session);
  const { amount, allocations } = await calculateCoachCredit(coach._id, items, session, { purchaseTotal: order.totalPrice, isFirstPurchase: !previousPurchase });
  if (!amount) return 0;
  money(amount);
  const credited = await User.updateOne({ _id: coach._id, walletBalance: { $lte: Number.MAX_SAFE_INTEGER - amount } }, { $inc: { walletBalance: amount } }, { session });
  if (credited.modifiedCount !== 1) throw coachWalletError("واریز کردیت مربی انجام نشد");
  await CoachWalletTransaction.create([{ coach: coach._id, student: order.user, order: order._id, amount, ruleCredits: allocations, source: "automatic", note: "واریز خودکار از خرید شاگرد" }], { session });
  for (const allocation of allocations) await CoachCredit.updateOne({ _id: allocation.rule }, { $inc: { totalCreditPaid: allocation.amount, triggerCount: 1 } }, { session });
  return amount;
}

export async function reverseAutomaticCoachCredit(order, session) {
  if (!order.coachCreditProcessedAt) return;
  transaction(session);
  const credits = await CoachWalletTransaction.find({ order: order._id, source: "automatic" }).session(session);
  for (const credit of credits) {
    const amount = credit.amount - (credit.reversedAmount || 0);
    if (amount <= 0) continue;
    const debit = await User.updateOne({ _id: credit.coach, walletBalance: { $gte: amount } }, { $inc: { walletBalance: -amount } }, { session });
    if (debit.modifiedCount !== 1) throw coachWalletError("کردیت خودکار این سفارش مصرف شده است؛ پیش از لغو یا حذف سفارش، موجودی مربی برای بازگشت کردیت باید تسویه شود");
    credit.reversedAmount = credit.amount;
    await credit.save({ session });
    for (const allocation of credit.ruleCredits || []) await CoachCredit.updateOne({ _id: allocation.rule }, { $inc: { totalCreditPaid: -allocation.amount, triggerCount: -1 } }, { session });
    await WalletTransaction.create([{ user: credit.coach, order: order._id, trackingCode: order.trackingCode, type: "debit", amount, description: "بازگشت کردیت خرید شاگرد بابت لغو سفارش" }], { session });
  }
}
