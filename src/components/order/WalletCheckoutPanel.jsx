'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FiRefreshCw } from 'react-icons/fi';

const format = (value) => Number(value || 0).toLocaleString('fa-IR');
const formatInput = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

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
    <section className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span id="wallet-toggle-label" className="text-sm font-medium text-slate-800">استفاده از کیف پول</span>
          <p className="mt-1 text-xs text-slate-500" aria-live="polite">
            {loading ? 'در حال دریافت موجودی…' : error ? 'دریافت موجودی ناموفق بود' : `موجودی: ${format(balance)} تومان`}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={open} aria-labelledby="wallet-toggle-label" aria-expanded={open} aria-controls={open ? 'checkout-wallet-fields' : undefined}
          disabled={disabled} onClick={() => onToggle(!enabled)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40">
          <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${open ? 'bg-[var(--color-primary)]' : 'bg-slate-300'}`}>
            <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 motion-reduce:transition-none" style={{ right: 2, transform: open ? 'translateX(-16px)' : 'translateX(0)' }} />
          </span>
        </button>
      </div>
      {error && <button type="button" onClick={() => { setError(false); setLoading(true); setAttempt((v) => v + 1); }} className="mt-2 flex min-h-11 items-center gap-2 text-sm text-[var(--color-primary)]"><FiRefreshCw />تلاش مجدد</button>}
      <AnimatePresence initial={false}>
        {open && <motion.div id="checkout-wallet-fields" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.25 }} className="overflow-hidden">
          <div className="space-y-2 pb-1 pt-2">
            <label htmlFor="checkout-wallet-amount" className="block text-xs text-slate-600">مبلغ (تومان)</label>
            <div className="flex items-center gap-2">
            <input id="checkout-wallet-amount" type="text" inputMode="numeric" dir="ltr" value={formatInput(amount)} aria-invalid={invalid} aria-describedby="checkout-wallet-limit" placeholder="0"
              onChange={(event) => {
                const normalized = event.target.value.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/[,٬\s]/g, '');
                if (/^\d*$/.test(normalized)) {
                  const input = event.target;
                  const digitsBefore = input.value.slice(0, input.selectionStart).replace(/[,٬\s]/g, '').length;
                  onAmountChange(normalized);
                  requestAnimationFrame(() => {
                    if (document.activeElement !== input) return;
                    let position = 0, digits = 0;
                    while (position < input.value.length && digits < digitsBefore) {
                      if (/\d/.test(input.value[position])) digits++;
                      position++;
                    }
                    input.setSelectionRange(position, position);
                  });
                }
              }} className="h-11 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-right text-sm tabular-nums focus:outline-2 focus:outline-[var(--color-primary)]" />
              <button type="button" onClick={() => onAmountChange(String(available))} className="min-h-11 shrink-0 rounded-md px-2 text-xs font-medium text-[var(--color-primary)] hover:bg-slate-50">کل موجودی</button>
            </div>
              <p id="checkout-wallet-limit" className={`text-xs ${invalid ? 'text-red-600' : 'text-slate-500'}`}>حداکثر قابل استفاده: {format(available)} تومان</p>
          </div>
        </motion.div>}
      </AnimatePresence>
    </section>
  );
}
