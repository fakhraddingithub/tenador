'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { FiX, FiCode, FiCopy, FiClipboard, FiCheck } from 'react-icons/fi';
import { getProductSectionJson, validateProductSectionJson } from '@/lib/productSectionJson';

const TITLES = {
  basicInfo: 'اطلاعات پایه',
  fixedAttributes: 'ویژگی‌های ثابت',
  technicalStats: 'تحلیل فنی (نمودار رادار)',
};
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-card)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50';

export default function ProductSectionJsonModal({ section, form, category, onApply, onClose }) {
  const [draft, setDraft] = useState(() => JSON.stringify(getProductSectionJson(section, form, category), null, 2));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const container = useRef(null);
  const editor = useRef(null);
  const alive = useRef(true);

  function showError(title, text = '', html) {
    return Swal.fire({
      title, text: html ? undefined : text, html, icon: 'error',
      confirmButtonText: html ? 'اصلاح می‌کنم' : 'باشه',
      confirmButtonColor: getComputedStyle(container.current).getPropertyValue('--color-primary').trim(),
    });
  }

  useEffect(() => {
    alive.current = true;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const siblings = [...document.body.children].filter(node => node !== container.current);
    const inertStates = siblings.map(node => [node, node.inert]);
    siblings.forEach(node => { node.inert = true; });
    document.body.style.overflow = 'hidden';
    editor.current?.focus();
    return () => {
      alive.current = false;
      inertStates.forEach(([node, inert]) => { node.inert = inert; });
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  async function validate(text) {
    const result = validateProductSectionJson(section, text, form, category);
    if (result.errors.length) {
      const content = document.createElement('div');
      content.dir = 'rtl';
      content.style.cssText = 'white-space:pre-wrap;text-align:right;max-height:50vh;overflow:auto;overflow-wrap:anywhere';
      content.textContent = result.errors.map((error, i) => `${i + 1}. ${error}`).join('\n\n');
      await showError('جیسون معتبر نیست', '', content);
      editor.current?.focus();
      return null;
    }
    return result.patch;
  }

  async function copy() {
    setBusy(true);
    try {
      await navigator.clipboard.writeText(draft);
      if (alive.current) setStatus('متن فعلی جیسون کپی شد.');
    } catch {
      await showError('کپی انجام نشد', 'مرورگر اجازه دسترسی به کلیپ‌بورد نداد. متن داخل ویرایشگر را انتخاب و دستی کپی کنید.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function paste() {
    setBusy(true);
    setStatus('');
    try {
      const text = await navigator.clipboard.readText();
      if (!alive.current) return;
      // Keep invalid text available for correction, but never apply it to the form.
      setDraft(text);
      if (await validate(text)) setStatus('جیسون بارگذاری شد و معتبر است؛ برای اعمال روی فرم، تأیید کنید.');
    } catch {
      await showError('بارگذاری انجام نشد', 'مرورگر اجازه خواندن کلیپ‌بورد نداد. متن را مستقیماً داخل ویرایشگر پیست کنید؛ هنگام تأیید اعتبارسنجی می‌شود.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const patch = await validate(draft);
      if (patch && alive.current) onApply(patch);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  function handleKeyDown(event) {
    if (Swal.isVisible()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!busy) onClose();
    }
    if (event.key === 'Tab') {
      const elements = [...container.current.querySelectorAll('button:not(:disabled), textarea')];
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
  }

  return createPortal(
    <div ref={container} className="admin-scope fixed inset-0 z-[1000] flex items-center justify-center p-3 backdrop-blur-sm sm:p-6" style={{ background: 'rgba(15, 26, 21, 0.6)' }} onKeyDown={handleKeyDown}>
      <div role="dialog" aria-modal="true" aria-labelledby="product-json-title" aria-describedby="product-json-help" dir="rtl"
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--admin-border)] border-t-4 border-t-[var(--color-secondary)] bg-[var(--admin-card)] p-4 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-primary-soft)] p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-[var(--color-secondary)]"><FiCode size={22} aria-hidden="true" /></span>
            <div>
              <p className="mb-1 text-xs text-[var(--color-primary)]">ویرایش جیسون</p>
              <h2 id="product-json-title" className="font-bold text-[var(--color-primary)]">{TITLES[section]}</h2>
            </div>
          </div>
          <button type="button" className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--color-primary)] transition-colors hover:bg-[var(--admin-card)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50" onClick={onClose} disabled={busy} aria-label="بستن ویرایشگر جیسون" title="بستن">
            <FiX size={22} aria-hidden="true" />
          </button>
        </div>
        <p id="product-json-help" className="border-r-2 border-[var(--color-secondary)] pr-3 text-sm leading-7 text-[var(--admin-text-muted)]">
          فقط فیلدهای همین بخش را وارد کنید. عددها بدون نقل‌قول و گزینه‌های چندمقداری به‌صورت آرایه نوشته شوند.
          حذف فیلد اختیاری آن را خالی می‌کند. تغییرات پس از تأیید به فرم منتقل می‌شوند؛ برای ثبت نهایی، «ذخیره تغییرات» محصول را بزنید.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={copy} disabled={busy}><FiCopy aria-hidden="true" />کپی جیسون</button>
          <button type="button" className={buttonClass} onClick={paste} disabled={busy}><FiClipboard aria-hidden="true" />بارگذاری جیسون</button>
        </div>
        <label htmlFor="product-json-editor" className="flex items-center justify-between text-sm font-medium text-[var(--admin-text)]">متن جیسون<span aria-hidden="true" className="rounded bg-[var(--color-primary-soft)] px-2 py-1 font-mono text-xs text-[var(--color-primary)]">JSON</span></label>
        <textarea ref={editor} id="product-json-editor" dir="ltr" spellCheck={false} autoComplete="off"
          value={draft} readOnly={busy} onChange={event => { setDraft(event.target.value); setStatus(''); }}
          className="min-h-52 w-full flex-1 resize-y rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-bg)] p-4 text-left font-mono text-sm leading-6 text-[var(--admin-text)] caret-[var(--color-primary)] focus:border-[var(--color-primary)] focus:outline-2 focus:outline-[var(--color-primary)]"
          rows={14} />
        <p role="status" className="text-sm text-[var(--color-primary)]">{busy ? 'در حال بررسی…' : status}</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
          <button type="button" className={buttonClass} onClick={onClose} disabled={busy}>انصراف</button>
          <button type="button" onClick={confirm} disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"><FiCheck aria-hidden="true" />تأیید و اعمال روی فرم</button>
        </div>
      </div>
    </div>, document.body,
  );
}
