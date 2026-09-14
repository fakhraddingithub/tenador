import "base/models/registerModels";
import { createHash } from "node:crypto";
import User from "base/models/User";
import WalletAdjustment from "base/models/WalletAdjustment";
import WalletTransaction from "base/models/WalletTransaction";
import { runWithOptionalTransaction } from "base/utils/mongoTransactions";

export const adjustmentError = (message, status = 409) => Object.assign(new Error(message), { code: 'WALLET_ADJUSTMENT_ERROR', status });

export async function adjustUserWallet({ userId, adminId, amount, type, description, requestKey }) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !['credit', 'debit'].includes(type)) throw adjustmentError('نوع عملیات یا مبلغ صحیح و مثبت به تومان را وارد کنید', 400);
  if (typeof description !== 'string' || !description.trim() || description.trim().length > 500) throw adjustmentError('توضیح تراکنش الزامی است و حداکثر ۵۰۰ نویسه می‌تواند باشد', 400);
  description = description.trim();
  if (typeof requestKey !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(requestKey)) throw adjustmentError('شناسه درخواست نامعتبر است', 400);
  const id = createHash('sha256').update(`${adminId}:${userId}:${requestKey}`).digest('hex');
  const previous = async (session = null) => {
    const receipt = await WalletAdjustment.findById(id).session(session).lean();
    if (receipt && (receipt.type !== type || receipt.amount !== amount || receipt.description !== description)) throw adjustmentError('این درخواست قبلاً با اطلاعات دیگری ثبت شده است');
    return receipt;
  };
  try {
    return await runWithOptionalTransaction(async session => {
      if (!session?.inTransaction()) throw adjustmentError('تراکنش امن کیف پول در دسترس نیست؛ هیچ تغییری ثبت نشد', 503);
      const existing = await previous(session);
      if (existing) return { ...existing, replayed: true };
      const user = await User.findById(userId).select('walletBalance').session(session).lean();
      if (!user) throw adjustmentError('کاربر یافت نشد', 404);
      const before = user.walletBalance ?? 0;
      const after = before + (type === 'credit' ? amount : -amount);
      if (!Number.isSafeInteger(before) || before < 0 || !Number.isSafeInteger(after) || after < 0) throw adjustmentError('موجودی کافی نیست یا مبلغ از محدوده مجاز خارج است');
      const ledger = new WalletTransaction({ user: userId, admin: adminId, amount, type, description, balanceBefore: before, balanceAfter: after });
      const receipt = { _id: id, user: userId, admin: adminId, amount, type, description, balanceAfter: after, transaction: ledger._id };
      await WalletAdjustment.create([receipt], { session });
      const changed = await User.updateOne({ _id: userId, ...(user.walletBalance == null ? { walletBalance: { $in: [null, 0] } } : { walletBalance: before }) }, { $set: { walletBalance: after } }, { session });
      if (changed.modifiedCount !== 1) throw adjustmentError('موجودی تغییر کرده است؛ دوباره تلاش کنید');
      await ledger.save({ session });
      return { ...receipt, replayed: false };
    });
  } catch (error) {
    if (error.code === 11000) { const receipt = await previous(); if (receipt) return { ...receipt, replayed: true }; }
    throw error;
  }
}
