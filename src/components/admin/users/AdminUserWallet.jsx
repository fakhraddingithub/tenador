"use client";

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'react-toastify';
import { Wallet } from 'lucide-react';

const money = value => `${Number(value).toLocaleString('fa-IR')} تومان`;
const digits = value => value.replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');
const fetchWallet = async url => {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'خطا در بارگذاری کیف پول');
  return body;
};

export default function AdminUserWallet({ userId, canAdjust, onBalanceChange }) {
  const { data, error, isLoading, mutate } = useSWR(userId ? `/api/admin/users/${userId}/wallet` : null, fetchWallet);
  const [type, setType] = useState('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(null);
  const submitting = useRef(false);
  const balance = data?.wallet?.balance;

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const payload = { amount: Number(amount), type, description: description.trim() };
    if (!Number.isSafeInteger(payload.amount) || payload.amount <= 0 || !payload.description) return;
    const signature = JSON.stringify({ userId, ...payload });
    if (pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/wallet`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, requestKey: pending.current.key }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'ثبت تراکنش انجام نشد');
      pending.current = null;
      setAmount('');
      setDescription('');
      toast.success(result.message || 'تراکنش ثبت شد');
      const updated = await mutate();
      if (updated) onBalanceChange(updated.wallet.balance);
    } catch (err) { toast.error(err.message || 'ارتباط با سرور برقرار نشد؛ درخواست را دوباره ارسال کنید'); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <section className="rounded-[var(--radius)] border border-gray-100 bg-white p-4 sm:p-5" aria-label="کیف پول کاربر">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-bold"><Wallet size={18} /> کیف پول کاربر</h2>
      {balance !== undefined && !error && <span className="font-bold text-emerald-700 tabular-nums">{money(balance)}</span>}
    </div>
    {isLoading && <p className="py-4 text-xs text-gray-500">در حال بارگذاری کیف پول…</p>}
    {error && <div role="alert" className="py-4 text-xs text-red-600">{error.message} <button type="button" onClick={() => mutate()} className="underline">تلاش مجدد</button></div>}
    {canAdjust && data && !error && <form onSubmit={submit} className="mt-4 space-y-3 border-y border-gray-100 py-4">
      <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
        <legend className="mb-3 text-xs font-bold">ثبت تراکنش توسط ادمین</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-600">نوع تراکنش
            <select value={type} onChange={e => setType(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2.5"><option value="credit">افزایش موجودی</option><option value="debit">کاهش موجودی</option></select>
          </label>
          <label className="text-xs text-gray-600">مبلغ (تومان)
            <input required inputMode="numeric" dir="ltr" value={amount ? Number(amount).toLocaleString('en-US') : ''} onChange={e => setAmount(digits(e.target.value).slice(0, 16))} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5" />
          </label>
        </div>
        <label className="block text-xs text-gray-600">توضیح تراکنش (الزامی؛ به کاربر نمایش داده می‌شود)
          <textarea required maxLength={500} rows={2} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full resize-y rounded-lg border border-gray-200 p-2.5" />
        </label>
        <button disabled={!amount || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0 || !description.trim() || (type === 'debit' && Number(amount) > balance)} className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{busy ? 'در حال ثبت…' : type === 'credit' ? 'ثبت افزایش موجودی' : 'ثبت کاهش موجودی'}</button>
        {type === 'debit' && Number(amount) > balance && <p className="text-xs text-red-600">مبلغ برداشت بیشتر از موجودی است.</p>}
      </fieldset>
    </form>}
    {data && !error && <div className="mt-4">
      <h3 className="mb-2 text-xs font-bold text-gray-500">تراکنش‌های اخیر (تا ۵۰ تراکنش)</h3>
      {!data.transactions.length ? <p className="py-4 text-xs text-gray-400">هنوز تراکنشی ثبت نشده است.</p> : <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto">
        {data.transactions.map(tx => <li key={tx._id} className="flex items-start justify-between gap-3 py-3 text-xs">
          <div className="min-w-0"><p className="break-words leading-6">{tx.description}</p><time className="text-[11px] text-gray-400">{new Date(tx.createdAt).toLocaleString('fa-IR')}</time></div>
          <span className={`shrink-0 pt-1 font-bold tabular-nums ${tx.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>{tx.type === 'credit' ? 'واریز' : 'برداشت'} {money(tx.amount)}</span>
        </li>)}
      </ul>}
    </div>}
  </section>;
}
