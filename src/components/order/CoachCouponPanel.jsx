'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const format = value => Number(value || 0).toLocaleString('fa-IR');
const group = value => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export default function CoachCouponPanel({ onBalanceChange }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [amount, setAmount] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const attempt = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/coach/coupons?page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async res => { const body = await res.json(); if (!res.ok) throw new Error(body.message); return body; })
      .then(body => { if (!controller.signal.aborted) setData(body); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message || 'خطا در دریافت کدها'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, refresh]);

  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    const value = Number(amount), normalizedCode = code.trim().toUpperCase();
    if (!Number.isSafeInteger(value) || value <= 0 || value > data?.balance) { setError('مبلغ را تا سقف موجودی کیف پول وارد کنید'); return; }
    if (!/^[A-Z0-9_-]{3,30}$/.test(normalizedCode)) { setError('کد باید ۳ تا ۳۰ حرف انگلیسی، عدد، خط تیره یا زیرخط باشد'); return; }
    const payload = { amount: value, code: normalizedCode };
    const fingerprint = JSON.stringify(payload);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/coach/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestKey: attempt.current.key }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'ساخت کد انجام نشد');
      setSuccess(`کد ${body.coupon.code} با مبلغ ${format(body.coupon.discount.value)} تومان ساخته شد.`);
      setAmount(''); setCode(''); attempt.current = null;
      setData(previous => ({ ...previous, balance: body.balance })); onBalanceChange(body.balance);
      setPage(1); setRefresh(v => v + 1);
    } catch (err) { setError(err.message || 'ارتباط قطع شد؛ با همان اطلاعات دوباره تلاش کنید'); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-slate-800">تبدیل موجودی به کد تخفیف</h2>
      <Link href="/p-user/wallet" className="inline-flex min-h-11 items-center text-xs text-[var(--color-primary)]">کیف پول: {format(data?.balance)} تومان</Link>
    </div>
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs text-slate-600"><span>مبلغ (تومان)</span>
          <input disabled={busy || loading} value={group(amount)} inputMode="numeric" dir="ltr" onChange={e => {
            const value = e.target.value.replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[,٬\s]/g, '');
            if (/^\d*$/.test(value)) setAmount(value);
          }} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-right text-base focus:outline-2 focus:outline-[var(--color-primary)]" />
        </label>
        <label className="space-y-1.5 text-xs text-slate-600"><span>عبارت کد تخفیف</span>
          <input disabled={busy || loading} value={code} maxLength={30} dir="ltr" autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="COACH-GIFT" className="h-11 w-full rounded-lg border border-slate-200 px-3 text-base focus:outline-2 focus:outline-[var(--color-primary)]" />
        </label>
      </div>
      <p className="text-xs leading-6 text-slate-500">مبلغ با ساخت کد از همین کیف پول کسر می‌شود. کد برای همه کاربران و کالاها، بدون تاریخ انقضا و فقط برای یک سفارش قابل استفاده است.</p>
      <p className="text-xs leading-6 text-slate-500">اگر مبلغ سفارش کمتر از کد باشد، باقیمانده به کیف پول شما برمی‌گردد؛ کد دوباره قابل استفاده نخواهد بود.</p>
      <button disabled={busy || loading || !data || data.balance <= 0} className="min-h-11 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white disabled:opacity-40">{busy ? 'در حال ساخت…' : 'ساخت کد تخفیف'}</button>
    </form>
    {error && <p role="alert" className="text-xs leading-6 text-red-600">{error}</p>}
    {success && <p role="status" className="text-xs leading-6 text-emerald-700">{success}</p>}
    <div className="space-y-3 border-t border-slate-100 pt-3">
      <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-700">تاریخچه کدها</h3><button type="button" onClick={() => { setError(''); setLoading(true); setRefresh(v => v + 1); }} className="min-h-11 px-2 text-xs text-slate-500">تازه‌سازی</button></div>
      {loading ? <p className="text-xs text-slate-500">در حال دریافت…</p> : data?.coupons?.length ? data.coupons.map(coupon => <div key={coupon._id} className="space-y-2 rounded-lg border border-slate-100 p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium"><bdi>{coupon.code}</bdi> — {coupon.coachName}</span><span className={coupon.usedAt ? 'text-slate-500' : 'text-emerald-700'}>{coupon.usedAt ? 'استفاده‌شده' : coupon.active ? 'معتبر' : 'غیرفعال'}</span></div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500"><span>{format(coupon.discount.value)} تومان</span><span>{new Date(coupon.createdAt).toLocaleDateString('fa-IR')}</span></div>
        {coupon.usedAt && <p className="leading-6 text-slate-500">استفاده توسط {coupon.usedByName || 'کاربر'} در {new Date(coupon.usedAt).toLocaleDateString('fa-IR')} · سفارش <bdi>{coupon.usedTrackingCode}</bdi></p>}
        {coupon.returnedAmount > 0 && <p className="text-emerald-700">بازگشت باقیمانده به کیف پول: {format(coupon.returnedAmount)} تومان</p>}
      </div>) : <p className="text-xs text-slate-500">هنوز کدی نساخته‌اید.</p>}
      {(page > 1 || data?.hasMore) && <div className="flex justify-between text-xs"><button disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(v => v - 1); }} className="min-h-11 px-3 disabled:opacity-40">قبلی</button><button disabled={!data?.hasMore || loading} onClick={() => { setLoading(true); setPage(v => v + 1); }} className="min-h-11 px-3 disabled:opacity-40">بعدی</button></div>}
    </div>
  </section>;
}
