"use client";

import { useState } from "react";
import { toast } from "react-toastify";

const digits = value => value.replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');

export default function CommentReward({ comment, canEdit, disabled, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const reward = comment.reward;
  if (!comment.order || !comment.isVerifiedPurchase || comment.parent) return null;

  async function save(value) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/comments/${comment._id}/reward`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'ذخیره مبلغ پاداش انجام نشد');
      setEditing(false);
      toast.success(result.message);
      await onSaved();
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }

  return <div className="rounded-lg border border-gray-100 p-2 text-xs sm:max-w-52">
    <div className="text-gray-500">{reward?.status === 'already_granted' ? 'پاداش ثبت‌شده' : 'مبلغ پاداش'}</div>
    <div className="mt-1 font-bold tabular-nums">{reward?.amount == null ? 'خطا در محاسبه' : `${reward.amount.toLocaleString('fa-IR')} تومان`}</div>
    {reward?.status === 'error' && <button type="button" disabled={busy || disabled} onClick={onSaved} className="mt-2 text-[var(--color-primary)]">محاسبه مجدد</button>}
    {reward?.status === 'disabled' && <p className="mt-1 text-gray-400">پاداش غیرفعال است</p>}
    {reward?.status === 'ineligible' && <p className="mt-1 text-gray-400">واجد شرایط پاداش نیست</p>}
    {canEdit && reward?.canEdit && (editing ? <div className="mt-2 space-y-2">
      <label className="block">مبلغ پاداش (تومان)
        <input aria-label="مبلغ پاداش به تومان" inputMode="numeric" dir="ltr" value={amount ? Number(amount).toLocaleString('en-US') : ''} onChange={e => setAmount(digits(e.target.value).slice(0, 16))} disabled={busy || disabled} className="mt-1 w-full rounded border border-gray-200 p-2" />
      </label>
      <div className="flex gap-3">
        <button type="button" disabled={busy || disabled || !amount || !Number.isSafeInteger(Number(amount))} onClick={() => save(Number(amount))} className="text-emerald-700 disabled:opacity-40">ذخیره مبلغ</button>
        <button type="button" disabled={busy} onClick={() => setEditing(false)} className="text-gray-500">انصراف</button>
      </div>
      {reward.custom && <button type="button" disabled={busy || disabled} onClick={() => save(null)} className="text-gray-500">بازگشت به محاسبه خودکار</button>}
    </div> : <button type="button" disabled={disabled || busy} onClick={() => { setAmount(String(reward.amount)); setEditing(true); }} className="mt-2 text-[var(--color-primary)] disabled:opacity-40">ویرایش مبلغ{reward.custom ? ' (سفارشی)' : ''}</button>)}
  </div>;
}
