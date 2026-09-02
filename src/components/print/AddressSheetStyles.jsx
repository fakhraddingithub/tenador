/**
 * src/components/print/AddressSheetStyles.jsx
 *
 * تمامِ CSS برگه‌ی چاپ، در یک <style> که همراهِ خودِ حالتِ چاپ mount/unmount
 * می‌شود. وقتی حالتِ چاپ بسته شود، این استایل هم با آن می‌رود — پس هیچ قاعده‌ی
 * سرگردانی روی پنل باقی نمی‌ماند و «برگرداندنِ دستی» لازم نیست.
 *
 * ─── دو نکته‌ی معماری ───────────────────────────────────────────────────
 *
 * ۱) جداسازیِ چاپ بدونِ دست‌کاریِ DOM.
 *    در رسانه‌ی چاپ، همسایه‌های مستقیمِ برگه در `body` با یک قاعده‌ی CSS از
 *    layout خارج می‌شوند. هیچ گره‌ای حذف، جابه‌جا یا بازسازی نمی‌شود — پس
 *    state، فوکوس و اسکرولِ صفحه‌ی سفارش دست‌نخورده می‌ماند — و چون قاعده
 *    داخلِ `@media print` است، روی نمایشگر اصلاً اعمال نمی‌شود.
 *
 * ۲) مقیاسِ A4/A5 با یک پیچ.
 *    A5 دقیقاً ۱/√۲ ≈ ۰٫۷۰۷ برابرِ A4 است (در هر دو بُعد). همه‌ی اندازه‌های
 *    داخلِ برگه بر حسبِ `em` و همه‌ی جانمایی‌ها بر حسبِ درصد نوشته شده‌اند، پس
 *    تغییرِ تنها یک مقدار — `font-size` روی `.sheet` — کلِ ترکیب‌بندی را
 *    متناسب کوچک می‌کند: متن، فاصله‌ها، لوگو، ضخامتِ کادر و جای فرستنده/گیرنده
 *    همه با هم. هیچ عنصری جداگانه مقیاس نمی‌شود.
 *
 *    استثنای عمدی: فاصله‌ی کادر از لبه (`--edge`) و شعاعِ گوشه ثابت‌اند.
 *    ناحیه‌ی غیرقابل‌چاپِ پرینتر یک عددِ *فیزیکی* (حدود ۴ تا ۵ میلی‌متر) است و
 *    به اندازه‌ی کاغذ ربطی ندارد؛ اگر این حاشیه هم کوچک می‌شد، کادر روی A5
 *    بریده می‌شد.
 */

import { PAPER } from "@/lib/printPaper.mjs";

export default function AddressSheetStyles({ paperSize = "A4" }) {
  const paper = PAPER[paperSize] || PAPER.A4;

  return (
    <style>{`
      @page { size: ${paper.css}; margin: 0; }

      .print-area {
        --edge: 6mm;      /* فاصله‌ی ثابت از لبه — بزرگ‌تر از ناحیه‌ی کور پرینتر */
        --gap: 1.4mm;     /* فاصله‌ی دو خطِ کادر */
        --ink: #1f2937;
        --muted: #9ca3af;
        --brand: #aa4725;

        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        overflow: auto;
        padding: 14px 8px;
        background: #eef0f2;
        color: var(--ink);
        font-family: Vazirmatn, Tahoma, sans-serif;
        direction: rtl;
      }

      .print-area *, .print-area *::before, .print-area *::after { box-sizing: border-box; }

      /* ─── نوارِ ابزار: فقط روی نمایشگر ───────────────────────────────── */
      .print-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
        width: 100%;
      }
      .print-bar__btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border: 1px solid var(--brand);
        border-radius: 6px;
        background: var(--brand);
        color: #fff;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .print-bar__btn--ghost { background: #fff; color: var(--brand); }
      .print-bar__sizes { display: inline-flex; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; }
      .print-bar__size {
        padding: 8px 14px;
        border: 0;
        background: #fff;
        color: #6b7280;
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .print-bar__size[aria-pressed="true"] { background: var(--brand); color: #fff; }
      .print-bar__hint { font-size: 11px; color: #6b7280; }

      /* ─── خودِ برگه ─────────────────────────────────────────────────── */
      .sheet-wrap { max-width: 100%; overflow-x: auto; }

      .sheet {
        position: relative;
        flex: none;
        width: ${paper.width};
        height: ${paper.height};
        /* ↓ تنها پیچِ مقیاس. همه‌چیزِ داخل بر حسبِ em است. */
        font-size: ${paper.base};
        background: #fff;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
        overflow: hidden;
      }

      /* دو خطِ کادر — دو قابِ تودرتو (نه border-style: double) تا ضخامت و
         فاصله‌ی خطوط دقیق و مقیاس‌پذیر بماند. */
      .frame {
        position: absolute;
        border-style: solid;
        border-color: var(--ink);
        border-radius: 8px;
        pointer-events: none;
      }
      .frame--outer { inset: var(--edge); border-width: 0.22em; }
      .frame--inner { inset: calc(var(--edge) + var(--gap) + 0.22em); border-width: 0.1em; }

      /* ناحیه‌ی محتوا: داخلِ قابِ درونی */
      .content { position: absolute; inset: calc(var(--edge) + 2.4em); }

      /* لوگو — گوشه‌ی بالا-راست. فقط خودِ لوگو: بدونِ کادر، پس‌زمینه، بَج یا
         نوشته‌ی کنارش. ارتفاع بر حسبِ em است تا با بقیه‌ی برگه مقیاس بگیرد. */
      /* max-width بیمه است، نه طراحی: اگر روزی فایلِ لوگو با نسبتِ خیلی
         کشیده‌تری جایگزین شود، نباید تا روی بخشِ فرستنده بیاید. درصد روی
         .logo نوشته شده چون بلوکِ دربرگیرنده‌اش .content است (نه خودِ تصویر،
         که عرضش auto است). */
      .logo { position: absolute; top: 0; right: 0; max-width: 40%; }
      .logo__img { display: block; height: 4.6em; width: auto; max-width: 100%; object-fit: contain; }

      /* جانمایی فیزیکی — absolute و نه grid: در سندِ RTL ترتیبِ ستون‌های grid
         برعکس می‌شود و «چپِ بالا» به «راستِ بالا» می‌پرد.
         عرضِ ۴۸٪ + ارتفاعِ طبیعیِ شش سطر ≈ یک‌چهارمِ برگه برای هر طرف. */
      .party { position: absolute; width: 48%; }
      .party--sender { top: 0; left: 0; }
      .party--recipient { bottom: 2.6em; right: 0; }

      .party__title {
        margin: 0 0 0.5em;
        padding-bottom: 0.4em;
        border-bottom: 0.14em solid var(--brand);
        color: var(--brand);
        font-size: 1.35em;
        font-weight: 700;
      }
      .party__badge {
        display: inline-block;
        margin-right: 0.6em;
        padding: 0.05em 0.6em;
        border-radius: 999px;
        background: #f3f4f6;
        color: var(--muted);
        font-size: 0.62em;
        font-weight: 500;
        vertical-align: middle;
      }

      .row { display: flex; gap: 0.6em; align-items: baseline; margin-top: 0.35em; line-height: 1.7; }
      .row__key { flex: none; width: 6.4em; color: var(--muted); font-size: 0.85em; }
      .row__value {
        flex: 1;
        min-width: 0;
        font-size: 1.1em;
        font-weight: 600;
        /* آدرس‌های بلندِ فارسی نباید برگه را بشکنند */
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .row__value--ltr { direction: ltr; text-align: right; font-family: Tahoma, sans-serif; }
      .row__value--soft { font-weight: 400; }

      /* کدِ سفارش — پایینِ برگه، عمداً بسیار کوچک و کم‌رنگ */
      .code {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
        color: var(--muted);
        font-size: 0.55em;
        letter-spacing: 0.04em;
      }

      /* ─── چاپ ───────────────────────────────────────────────────────── */
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }

        /* ⚠️ display:none روی *همسایه‌های مستقیمِ* برگه، و نه visibility.
           با visibility صفحه‌ی ادمین همچنان جای خودش را در layout می‌گرفت و
           چاپ چند صفحه‌ی سفیدِ اضافه می‌داد. این قاعده فقط داخلِ media queryِ
           print است، پس روی نمایشگر هیچ‌چیز پنهان یا reflow نمی‌شود؛ و چون
           صرفاً CSS است، هیچ گرهی از DOM حذف نمی‌شود. */
        body > *:not(.print-area) { display: none !important; }
        .no-print { display: none !important; }

        .print-area {
          position: absolute !important;
          inset: auto !important;
          top: 0 !important;
          left: 0 !important;
          display: block !important;
          overflow: visible !important;
          padding: 0 !important;
          background: #fff !important;
        }
        .sheet-wrap { overflow: visible !important; }
        .sheet {
          margin: 0 !important;
          box-shadow: none !important;
          page-break-after: avoid;
          break-after: avoid;
        }
      }
    `}</style>
  );
}
