'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, ArrowUp, Plus, Square, ArrowUpLeft, Database, AlertCircle, X } from 'lucide-react';
import useSWR from 'swr';
import { useAdminPermissions } from '../AdminPermissionProvider';
import { LIMITS } from '@/lib/assistant/catalog';

const suggestions = [
  { permission: 'admins.viewActivity', text: 'هر ادمین امروز چند محصول ایجاد کرده؟', label: 'فعالیت امروز ادمین‌ها' },
  { permission: 'orders.view', text: '۵ سفارش اخیر که هنوز ارسال نشده‌اند را نشان بده.', label: 'سفارش‌های در انتظار ارسال' },
  { permission: 'analytics.view', text: 'ماندهٔ وصول‌نشدهٔ سفارش‌های این ماه چقدر است؟', label: 'گزارش مالی این ماه' },
  { permission: 'products.view', text: 'چند محصول فعال داریم؟', label: 'تعداد محصولات فعال' },
];
const fetchStatus = async (url) => {
  const res = await fetch(url, { cache: 'no-store' });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'دریافت وضعیت دستیار ممکن نیست.');
  return body;
};
function compactHistory(messages) {
  const result = [];
  let size = 0;
  for (const message of messages.slice(-LIMITS.history).reverse()) {
    const content = message.content.slice(0, LIMITS.message);
    if (size + content.length > LIMITS.historyChars) break;
    result.unshift({ role: message.role, content }); size += content.length;
  }
  return result;
}

export default function AssistantChat({ onClose }) {
  const { can, canRoute } = useAdminPermissions();
  const { data: status, error: statusError, mutate } = useSWR('/api/admin/assistant', fetchStatus, { revalidateOnFocus: false, shouldRetryOnError: false });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryMessage, setRetryMessage] = useState('');
  const controller = useRef(null);
  const bottom = useRef(null);
  const field = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' }); }, [messages, busy]);

  async function send(value = input) {
    const message = value.trim();
    if (!message || controller.current || !status?.ready || !can('assistant.use')) return;
    const previous = messages;
    const pending = new AbortController();
    controller.current = pending;
    setError(''); setRetryMessage(''); setBusy(true); setInput('');
    setMessages([...previous, { role: 'user', content: message }]);
    try {
      const res = await fetch('/api/admin/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: compactHistory(previous) }),
        signal: AbortSignal.any([pending.signal, AbortSignal.timeout(115000)]),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'دریافت پاسخ ممکن نشد.');
      if (pending.signal.aborted) return;
      setMessages([...previous, { role: 'user', content: message }, { role: 'assistant', content: body.answer, sources: body.sources, generatedAt: body.generatedAt, tokens: body.tokens }]);
    } catch (err) {
      setMessages(previous);
      setInput(message);
      setRetryMessage(message);
      setError(pending.signal.aborted ? 'درخواست متوقف شد.' : err.name === 'TimeoutError' ? 'زمان پاسخ تمام شد؛ دوباره تلاش کنید.' : err.message);
    } finally {
      controller.current = null; setBusy(false); field.current?.focus();
    }
  }
  function reset() { if (busy) return; setMessages([]); setInput(''); setError(''); setRetryMessage(''); field.current?.focus(); }
  const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--admin-border)] px-3 text-sm transition-colors hover:bg-[var(--admin-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50';

  return <div dir="rtl" className="flex h-full min-h-0 w-full flex-col">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--admin-border)] p-3">
      <div className="flex items-center gap-2 text-[var(--color-primary)]"><Bot size={22} /><h2 className="text-sm font-bold">دستیار هوشمند</h2></div>
      <div className="flex gap-1">
        <button type="button" title="گفت‌وگوی جدید" aria-label="گفت‌وگوی جدید" className={buttonClass} onClick={reset} disabled={busy || !messages.length}><Plus size={17} /></button>
        <button type="button" aria-label="بستن چت" className={buttonClass} onClick={onClose}><X size={18} /></button>
      </div>
    </header>

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--admin-border)] px-5 py-3 text-xs text-[var(--admin-text-muted)]">
        <span className="flex items-center gap-2"><Database size={15} />داده‌های زنده · فقط خواندنی</span>
        <span>زمان گزارش‌ها: تهران</span>
      </div>

      {statusError || status?.ready === false ? <div role="alert" className="m-5 flex items-start gap-3 rounded-md bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle size={20} className="shrink-0" /><div>{statusError?.message || 'دستیار فعال نیست. تنظیمات Gemini روی سرور را بررسی کنید.'}<button type="button" onClick={() => mutate()} className="mr-2 min-h-11 underline">بررسی مجدد</button></div>
      </div> : null}

      <div role="log" aria-label="گفت‌وگو با دستیار" aria-live="polite" aria-busy={busy} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {!messages.length ? <div className="mx-auto flex max-w-xl flex-col items-center py-3 text-center">
          <div className="mb-5 rounded-xl bg-[var(--color-primary-soft)] p-4 text-[var(--color-primary)]"><Bot size={30} /></div>
          <h2 className="text-xl font-bold">از داده‌های فروشگاه بپرسید</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--admin-text-muted)]">سفارش‌ها، گزارش‌ها و فعالیت ادمین‌ها را بررسی کنید و از پاسخ، مستقیم به صفحهٔ مربوط بروید.</p>
          <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">{suggestions.filter((s) => can(s.permission)).map((s) => <button key={s.label} type="button" onClick={() => { setInput(s.text); field.current?.focus(); }} disabled={!status?.ready} className={`${buttonClass} justify-between text-right`}><span>{s.label}</span><ArrowUpLeft size={16} className="shrink-0" /></button>)}</div>
          {status?.datasets ? <p className="mt-5 text-xs leading-6 text-[var(--admin-text-muted)]">در دسترس شما: {[...status.datasets, ...(status.tools.includes('activity') ? ['فعالیت ادمین‌ها'] : []), ...(status.tools.includes('finance') ? ['گزارش مالی'] : [])].join('، ') || 'هنوز مجوز مشاهدهٔ داده‌ای ندارید'}</p> : null}
        </div> : messages.map((message, index) => <article key={index} className={`mb-5 max-w-[95%] rounded-lg p-4 sm:max-w-[85%] ${message.role === 'user' ? 'ml-auto bg-[var(--color-primary-soft)]' : 'mr-auto border border-[var(--admin-border)] bg-[var(--admin-card)]'}`}>
          <p className="mb-2 text-xs font-bold text-[var(--color-primary)]">{message.role === 'user' ? 'شما' : 'دستیار تنادور'}</p>
          <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-8">{message.content}</p>
          {message.sources?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.sources.filter((s) => typeof s.href === 'string' && s.href.startsWith('/p-admin/') && canRoute(s.href)).map((s) => <Link key={s.id} href={s.href} className={`${buttonClass} max-w-full text-[var(--color-primary)]`}><span className="truncate">{s.title}</span><ArrowUpLeft size={15} className="shrink-0" /></Link>)}</div> : null}
          {message.generatedAt ? <p className="mt-3 text-xs text-[var(--admin-text-muted)]">بررسی در {new Date(message.generatedAt).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' })}</p> : null}
        </article>)}
        {busy ? <p role="status" className="py-3 text-sm text-[var(--color-primary)]">در حال بررسی داده‌های مرتبط…</p> : null}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="shrink-0 border-t border-[var(--admin-border)] p-3">
        {error ? <div role="alert" className="mb-3 text-sm text-[var(--admin-danger)]">{error}{retryMessage && !busy ? <button type="button" onClick={() => send(retryMessage)} className="mr-3 min-h-11 underline">تلاش دوباره</button> : null}</div> : null}
        <label htmlFor="assistant-question" className="mb-2 block text-sm font-medium">سؤال شما</label>
        <div className="flex items-end gap-3">
          <textarea id="assistant-question" ref={field} value={input} onChange={(e) => setInput(e.target.value)} maxLength={LIMITS.message} rows={2} disabled={busy || !status?.ready}
            placeholder="مثلاً: ادمین احمدی امروز چند محصول ایجاد کرده؟"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            className="min-h-16 min-w-0 flex-1 resize-none rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 text-base leading-7 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-60" />
          {busy ? <button type="button" onClick={() => controller.current?.abort()} className={buttonClass} aria-label="توقف پاسخ"><Square size={18} /></button> : <button type="submit" disabled={!input.trim() || !status?.ready} aria-label="ارسال سؤال" className={`${buttonClass} border-transparent bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]`}><ArrowUp size={20} /></button>}
        </div>
        <p className="mt-2 text-xs leading-6 text-[var(--admin-text-muted)]">Enter برای ارسال · Shift+Enter برای خط جدید</p>
      </form>
    </div>
  </div>;
}
