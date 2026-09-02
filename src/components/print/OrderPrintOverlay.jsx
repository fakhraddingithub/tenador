"use client";

/**
 * src/components/print/OrderPrintOverlay.jsx
 *
 * «حالتِ چاپ» روی *همان* صفحه‌ی جزئیاتِ سفارش — بدونِ تب یا پنجره‌ی جدید.
 *
 * چرا این کار امن است، برخلافِ الگوی معروفِ خطرناک:
 *
 *   ✗ کاری که *نمی‌کنیم*: جایگزینیِ `document.body.innerHTML` با HTMLِ چاپ و
 *     برگرداندنش بعد از چاپ. آن الگو کلِ درختِ React را از زیرِ پایش می‌کشد؛
 *     بعد از بازگشت، رویدادها به گره‌هایی وصل‌اند که دیگر وجود ندارند و صفحه
 *     مرده می‌ماند. همان‌طور که پنجره‌ی `window.open` قبلی مرده‌اش می‌کرد.
 *
 *   ✓ کاری که می‌کنیم:
 *     • برگه با `createPortal` به `document.body` می‌رود. عمداً به body و نه
 *       داخلِ درختِ صفحه: نیای framer-motion یک `transform` دارد و
 *       `position: fixed` را می‌شکند.
 *     • پنهان‌کردنِ بقیه‌ی سند فقط با CSS و فقط داخلِ `@media print` انجام
 *       می‌شود (AddressSheetStyles). هیچ گره‌ای حذف/جابه‌جا/بازسازی نمی‌شود،
 *       پس state، فوکوس و اسکرولِ صفحه‌ی سفارش دست‌نخورده می‌ماند.
 *     • آن CSS داخلِ یک <style> است که با همین کامپوننت mount/unmount می‌شود؛
 *       «برگرداندن به حالتِ اول» یعنی صرفاً unmount شدنِ React. هیچ پاک‌سازیِ
 *       دستی‌ای وجود ندارد که بتواند از قلم بیفتد.
 *
 * خروج از حالتِ چاپ سه راه دارد تا کاربر هیچ‌وقت گیر نکند:
 *   ۱) رویدادِ `afterprint` (چاپ یا انصراف — هر دو)
 *   ۲) کلیدِ Escape
 *   ۳) دکمه‌ی «بستن» (اگر مرورگری afterprint نفرستد)
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import AddressSheet from "@/components/print/AddressSheet";
import AddressSheetStyles from "@/components/print/AddressSheetStyles";

export default function OrderPrintOverlay({
  sender,
  recipient,
  trackingCode,
  paperSize = "A4",
  onClose,
}) {
  // ⚠️ ارجاعِ onClose در ref نگه داشته می‌شود تا افکتِ زیر وابستگی نداشته باشد.
  // والد یک تابعِ درون‌خطی پاس می‌دهد؛ اگر آن در فهرستِ وابستگی‌ها بود، هر رندر
  // افکت را دوباره اجرا می‌کرد و دیالوگِ چاپ چند بار باز می‌شد.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // بازکردنِ خودکارِ دیالوگ + همه‌ی راه‌های خروج، در یک افکت تا ثبت و پاک‌سازیِ
  // شنونده‌ها هرگز از هم جدا نیفتد. یک بار، هنگام mount.
  useEffect(() => {
    let done = false;
    const exit = () => {
      if (done) return;
      done = true;
      onCloseRef.current?.();
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") exit();
    };

    // ⚠️ فقط *بعد* از فراخوانیِ print به afterprint گوش می‌دهیم: بعضی مرورگرها
    // هنگام mount یک afterprintِ باقی‌مانده می‌فرستند و حالتِ چاپ بلافاصله
    // بسته می‌شد.
    let armed = false;
    const onAfterPrint = () => armed && exit();

    window.addEventListener("afterprint", onAfterPrint);
    window.addEventListener("keydown", onKeyDown);

    let cancelled = false;
    const ready =
      typeof document !== "undefined" && document.fonts?.ready
        ? document.fonts.ready
        : Promise.resolve();

    ready.then(
      () => {
        // یک فریم صبر تا برگه با فونت و لوگو واقعاً نقاشی شده باشد.
        requestAnimationFrame(() => {
          if (cancelled) return;
          armed = true;
          try {
            window.print();
          } catch {
            // مرورگر اجازه نداد — کاربر با دکمه‌ی «چاپ» یا «بستن» ادامه می‌دهد.
            armed = false;
          }
        });
      },
      () => {}
    );

    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", onAfterPrint);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // روی سرور هرگز رندر نمی‌شود (والد فقط بعد از کلیک mount اش می‌کند)، ولی
  // createPortal بدونِ document خطا می‌دهد؛ این نگهبان ارزان است.
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <AddressSheetStyles paperSize={paperSize} />
      <div className="print-area" role="dialog" aria-label="پیش‌نمایش چاپ برگه آدرس">
        <div className="print-bar no-print">
          <button type="button" className="print-bar__btn" onClick={() => window.print()}>
            چاپ
          </button>
          <button type="button" className="print-bar__btn--ghost print-bar__btn" onClick={onClose}>
            <X size={13} /> بستن
          </button>
          <span className="print-bar__hint">
            کاغذ: {paperSize} افقی — در پنجره‌ی چاپ، حاشیه را «هیچ/پیش‌فرض» و
            سربرگ و پاورقی را خاموش بگذارید. با Escape هم می‌توانید برگردید.
          </span>
        </div>

        <AddressSheet sender={sender} recipient={recipient} trackingCode={trackingCode} />
      </div>
    </>,
    document.body
  );
}
