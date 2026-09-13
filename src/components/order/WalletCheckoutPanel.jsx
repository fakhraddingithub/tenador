'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FiRefreshCw, FiCreditCard as FiWallet } from 'react-icons/fi';

const format = (value) => Number(value || 0).toLocaleString('fa-IR');

export default function WalletCheckoutPanel({ enabled, onToggle, amount, onAmountChange, total, balance, onBalanceChange }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/wallet', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        if (!Number.isFinite(data.wallet?.balance)) throw new Error();
        if (!controller.signal.aborted) onBalanceChange(data.wallet.balance);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, onBalanceChange]);
  const available = Math.max(0, Math.floor(Math.min(balance, total)));
  const disabled = loading || error || available <= 0;
  const open = enabled && !disabled;
  const invalid = Number(amount) > available;
  return (
    <section className="rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span id="wallet-toggle-label" className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FiWallet aria-hidden="true" />استفاده از کیف پول</span>
          <p className="mt-1 text-xs text-slate-500" aria-live="polite">
            {loading ? 'در حال دریافت موجودی…' : error ? 'دریافت موجودی ناموفق بود' : `موجودی: ${format(balance)} تومان`}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={open} aria-labelledby="wallet-toggle-label" aria-expanded={open} aria-controls={open ? 'checkout-wallet-fields' : undefined}
          disabled={disabled} onClick={() => onToggle(!enabled)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40">
          <span dir="ltr" className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${open ? 'bg-[var(--color-primary)]' : 'bg-slate-300'}`}>
            <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${open ? 'translate-x-5' : 'translate-x-0'}`} />
          </span>
        </button>
      </div>
      {error && <button type="button" onClick={() => { setError(false); setLoading(true); setAttempt((v) => v + 1); }} className="mt-2 flex min-h-11 items-center gap-2 text-sm text-[var(--color-primary)]"><FiRefreshCw />تلاش مجدد</button>}
      {!loading && !error && balance === 0 && <p className="mt-2 text-xs text-slate-500">برای استفاده، کیف پول باید موجودی داشته باشد.</p>}
      <AnimatePresence initial={false}>
        {open && <motion.div id="checkout-wallet-fields" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.25 }} className="overflow-hidden">
          <div className="space-y-3 pt-4">
            <label htmlFor="checkout-wallet-amount" className="block text-xs font-medium text-slate-700">مبلغ پرداخت از کیف پول (تومان)</label>
            <input id="checkout-wallet-amount" type="text" inputMode="numeric" dir="ltr" value={amount} aria-invalid={invalid} aria-describedby="checkout-wallet-limit"
              onChange={(event) => {
                const normalized = event.target.value.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/[,٬\s]/g, '');
                if (/^\d*$/.test(normalized)) onAmountChange(normalized);
              }} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-right text-sm focus:outline-2 focus:outline-[var(--color-primary)]" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id="checkout-wallet-limit" className={`text-xs ${invalid ? 'text-red-600' : 'text-slate-500'}`}>حداکثر قابل استفاده: {format(available)} تومان</p>
              <button type="button" onClick={() => onAmountChange(String(available))} className="min-h-11 rounded-lg px-3 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10">استفاده از کل موجودی</button>
            </div>
            {balance > total && <p className="text-xs text-slate-500">فقط به اندازه مبلغ سفارش از موجودی برداشت می‌شود.</p>}
          </div>
        </motion.div>}
      </AnimatePresence>
    </section>
  );
}
