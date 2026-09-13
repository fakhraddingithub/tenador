import { createHash } from "node:crypto";
import "base/models/registerModels";
import { consumeCoachCoupon, grantAutomaticCoachCredit, reverseAutomaticCoachCredit } from "base/services/coachWallet.service";
import Order from "base/models/Order";
import User from "base/models/User";
import Payment from "base/models/Payment";
import Installment from "base/models/Installment";
import UsedProduct from "base/models/UsedProduct";
import WalletTransaction from "base/models/WalletTransaction";
import WalletCheckout from "base/models/WalletCheckout";
import { runWithOptionalTransaction } from "base/utils/mongoTransactions";

export function walletError(message, status = 409) {
  return Object.assign(new Error(message), { status, code: "WALLET_CHECKOUT_ERROR" });
}

function requireTransaction(session) {
  if (!session?.inTransaction()) throw walletError("عملیات کیف پول به تراکنش اتمی دیتابیس نیاز دارد؛ دوباره تلاش کنید", 503);
}

export function validateWalletAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw walletError("مبلغ کیف پول باید عدد صحیح و نامنفی به تومان باشد", 400);
  return amount;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function walletCheckoutIdentity(userId, key, body) {
  if (typeof key !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(key)) throw walletError("شناسه ثبت سفارش نامعتبر است؛ به صفحه ثبت سفارش برگردید", 400);
  const hash = (text) => createHash("sha256").update(text).digest("hex");
  return { _id: hash(`${userId}:${key}`), requestHash: hash(JSON.stringify(canonical(body))) };
}

export async function findWalletCheckout(identity, session = null) {
  const receipt = await WalletCheckout.findById(identity._id).session(session).lean();
  if (!receipt) return null;
  if (receipt.requestHash !== identity.requestHash) throw walletError("این درخواست قبلاً با اطلاعات دیگری ثبت شده است؛ سفارش‌ها را بررسی کنید");
  return receipt;
}

export async function createWalletOrder({ identity, draft, amount, bankImages = [], installmentData = null }) {
  validateWalletAmount(amount);
  if ((!draft.coupon?.createdByCoach && amount <= 0) || !Number.isSafeInteger(draft.totalPrice) || draft.totalPrice < 0 || amount > draft.totalPrice) throw walletError("مبلغ کیف پول بیشتر از مبلغ سفارش یا نامعتبر است", 400);
  const work = async (session) => {
    requireTransaction(session);
    const existing = await findWalletCheckout(identity, session);
    if (existing) return { receipt: existing, replayed: true };
    const order = new Order({ ...draft, walletPaid: amount, walletPaidOriginal: amount, payments: [],
      paymentMethod: amount === draft.totalPrice ? (amount > 0 ? "WALLET" : "BANK_RECEIPT") : draft.paymentMethod,
      paymentStatus: amount === draft.totalPrice ? "PAID" : amount > 0 ? "PARTIALLY_PAID" : "UNPAID",
      fulfillmentStatus: amount === draft.totalPrice ? "PROCESSING" : "WAITING",
    });
    // Claim retry key before touching money. Unique _id serializes same requests.
    await WalletCheckout.create([{ ...identity, orderId: order._id }], { session });
    if (amount > 0) {
    const debit = await User.updateOne({ _id: draft.user, walletBalance: { $gte: amount, $lte: Number.MAX_SAFE_INTEGER }, isBanned: { $ne: true } },
      { $inc: { walletBalance: -amount } }, { session });
    if (debit.modifiedCount !== 1) throw walletError("موجودی کیف پول کافی نیست یا حساب غیرفعال است؛ موجودی را دوباره بررسی کنید");
    } else if (!await User.exists({ _id: draft.user, isBanned: { $ne: true } }).session(session)) { throw walletError("حساب کاربری غیرفعال است", 403); }
    await order.save({ session });
    await consumeCoachCoupon(order, session);
    for (const id of new Set(order.items.filter((i) => i.itemType === "used_product").map((i) => String(i.usedProduct)))) {
      const reserved = await UsedProduct.updateOne({ _id: id, status: "available" },
        { $set: { status: amount === draft.totalPrice ? "sold" : "reserved", order: order._id } }, { session });
      if (reserved.modifiedCount !== 1) throw walletError("یکی از محصولات دست دوم دیگر موجود نیست");
    }
    let payment = null;
    if (amount > 0) {
    const [walletPayment] = await Payment.create([{ order: order._id, method: "WALLET", amount, status: "PAID", meta: { originalAmount: amount } }], { session });
    order.payments.push(walletPayment._id);
    await WalletTransaction.create([{ user: draft.user, order: order._id, trackingCode: order.trackingCode,
      type: "debit", amount, description: "پرداخت با کیف پول" }], { session });
    payment = walletPayment;
    }
    const due = draft.totalPrice - amount;
    let installment = null;
    if (due > 0) {
      const isInstallment = draft.paymentMethod === "INSTALLMENT";
      const images = isInstallment ? installmentData?.downPaymentImages : bankImages;
      if (!images?.length || (isInstallment && !installmentData)) throw walletError("اطلاعات پرداخت مانده سفارش ناقص است", 400);
      [payment] = await Payment.create([{ order: order._id, method: "BANK_RECEIPT", amount: isInstallment ? installmentData.downPaymentAmount : due,
        status: "PENDING", bankReceipt: { imageUrls: images, uploadedAt: new Date(), reviewStatus: "PENDING" } }], { session });
      order.payments.push(payment._id);
      if (isInstallment) {
        [installment] = await Installment.create([{ order: order._id, downPayment: payment._id, totalAmount: due,
          numberOfChecks: installmentData.numberOfChecks, status: "PENDING", checks: installmentData.checks.map((c) => ({
            checkNumber: c.checkNumber ?? null, amount: Number(c.amount), dueDate: new Date(c.dueDate), status: "PENDING", receiptImageUrl: c.receiptImageUrl ?? null,
          })) }], { session });
      }
    }
    await grantAutomaticCoachCredit(order, session);
    await order.save({ session });
    const receipt = { ...identity, orderId: order._id, trackingCode: order.trackingCode, totalPrice: order.totalPrice, walletPaid: amount };
    await WalletCheckout.updateOne({ _id: identity._id }, { $set: receipt }, { session });
    return { order, payment, installment, receipt, replayed: false };
  };
  try { return await runWithOptionalTransaction(work); }
  catch (error) {
    // A concurrent identical request may finish with duplicate-key rather than
    // WriteConflict. Re-read its committed receipt; never debit a second time.
    if (error.code === 11000) {
      const receipt = await findWalletCheckout(identity);
      if (receipt) return { receipt, replayed: true };
    }
    throw error;
  }
}

// Refund only the excess wallet portion, never cash. Caller saves/deletes order
// within the same transaction. Ledger is retained even if the order is deleted.
export async function refundOrderWallet(order, maximum, session) {
  const current = Number(order.walletPaid || 0);
  if (current <= maximum) return 0;
  requireTransaction(session);
  const refund = current - Math.max(0, maximum);
  validateWalletAmount(refund);
  const payment = await Payment.findOne({ order: order._id, method: "WALLET", status: "PAID" }).session(session);
  if (!payment || payment.amount !== current) throw walletError("اطلاعات پرداخت کیف پول نیاز به بررسی دارد");
  const credited = await User.updateOne({ _id: order.user, walletBalance: { $lte: Number.MAX_SAFE_INTEGER - refund } }, { $inc: { walletBalance: refund } }, { session });
  if (credited.modifiedCount !== 1) throw walletError("بازگشت موجودی کیف پول انجام نشد");
  payment.amount -= refund;
  payment.set("meta.refundedAmount", Number(payment.meta?.refundedAmount || 0) + refund);
  payment.markModified("meta");
  await payment.save({ session });
  order.walletPaid = current - refund;
  await WalletTransaction.create([{ user: order.user, order: order._id, trackingCode: order.trackingCode,
    type: "credit", amount: refund, description: "بازگشت پرداخت کیف پول سفارش" }], { session });
  return refund;
}

export async function updateOrderWithWallet(orderId, update) {
  return runWithOptionalTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) return null;
    const hadWallet = order.walletPaid > 0;
    const wasPaid = order.paymentStatus === "PAID";
    if (update.fulfillmentStatus === "CANCELED") {
      await reverseAutomaticCoachCredit(order, session);
      await refundOrderWallet(order, 0, session);
    }
    Object.assign(order, update);
    if (hadWallet) {
      const paid = await Payment.find({ order: order._id, status: "PAID" }).session(session).lean();
      const total = paid.reduce((sum, p) => sum + p.amount, 0);
      order.paymentStatus = total >= order.totalPrice ? "PAID" : total > 0 ? "PARTIALLY_PAID" : "UNPAID";
    }
    if (!wasPaid && order.paymentStatus === "PAID") order.coachCreditEligible = true;
    await grantAutomaticCoachCredit(order, session);
    await order.save({ session });
    return order;
  });
}
