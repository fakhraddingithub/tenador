'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { showError } from '@/lib/swal';
import { getProductSectionJson, validateProductSectionJson } from '@/lib/productSectionJson';

const TITLES = {
  basicInfo: 'اطلاعات پایه',
  fixedAttributes: 'ویژگی‌های ثابت',
  technicalStats: 'تحلیل فنی (نمودار رادار)',
};
const buttonClass = 'min-h-11 rounded-xl border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50';

export default function ProductSectionJsonModal({ section, form, category, onApply, onClose }) {
  const [draft, setDraft] = useState(() => JSON.stringify(getProductSectionJson(section, form, category), null, 2));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const container = useRef(null);
  const editor = useRef(null);
  const alive = useRef(true);

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
      await Swal.fire({ title: 'جیسون معتبر نیست', html: content, icon: 'error', confirmButtonText: 'اصلاح می‌کنم' });
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
    <div ref={container} className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3 sm:p-6" onKeyDown={handleKeyDown}>
      <div role="dialog" aria-modal="true" aria-labelledby="product-json-title" aria-describedby="product-json-help" dir="rtl"
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="product-json-title" className="font-bold">ویرایش جیسون — {TITLES[section]}</h2>
          <button type="button" className={buttonClass} onClick={onClose} disabled={busy} aria-label="بستن ویرایشگر جیسون">بستن</button>
        </div>
        <p id="product-json-help" className="text-sm leading-7 text-gray-600">
          فقط فیلدهای همین بخش را وارد کنید. عددها بدون نقل‌قول و گزینه‌های چندمقداری به‌صورت آرایه نوشته شوند.
          حذف فیلد اختیاری آن را خالی می‌کند. تغییرات پس از تأیید به فرم منتقل می‌شوند؛ برای ثبت نهایی، «ذخیره تغییرات» محصول را بزنید.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={copy} disabled={busy}>کپی جیسون</button>
          <button type="button" className={buttonClass} onClick={paste} disabled={busy}>بارگذاری جیسون</button>
        </div>
        <label htmlFor="product-json-editor" className="text-sm font-medium">متن جیسون</label>
        <textarea ref={editor} id="product-json-editor" dir="ltr" spellCheck={false} autoComplete="off"
          value={draft} readOnly={busy} onChange={event => { setDraft(event.target.value); setStatus(''); }}
          className="min-h-52 w-full flex-1 resize-y rounded-xl border border-gray-300 bg-gray-50 p-4 text-left font-mono text-sm leading-6 focus:outline-2 focus:outline-blue-600"
          rows={14} />
        <p role="status" className="text-sm text-gray-600">{busy ? 'در حال بررسی…' : status}</p>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <button type="button" className={buttonClass} onClick={onClose} disabled={busy}>انصراف</button>
          <button type="button" onClick={confirm} disabled={busy}
            className="min-h-11 rounded-xl bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50">تأیید و اعمال روی فرم</button>
        </div>
      </div>
    </div>, document.body,
  );
}
