/**
 * src/components/print/AddressSheetStyles.jsx
 *
 * تمامِ CSS برگه‌ی چاپ، در یک <style> درون‌خطی.
 *
 * چرا درون‌خطی و نه تیلویند/globals.css: این سند باید از سیستمِ استایلِ سایت
 * کاملاً مستقل باشد. چاپ به میلی‌متر کار می‌کند نه به rem، و هر تغییری در تمِ
 * پنل نباید بتواند اندازه‌ی برگه‌ی A4 را جابه‌جا کند.
 */
export default function AddressSheetStyles() {
  return (
    <style>{`
      /* A4 افقی — حاشیه صفر چون خودِ برگه padding دارد */
      @page { size: A4 landscape; margin: 0; }

      * { box-sizing: border-box; }

      html, body {
        margin: 0;
        padding: 0;
        background: #eef0f2;
        color: #1f2937;
        font-family: Vazirmatn, Tahoma, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
        padding: 14px 16px;
      }
      .toolbar__hint { font-size: 12px; color: #6b7280; }
      .toolbar__btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        border: 1px solid #aa4725;
        border-radius: 6px;
        background: #aa4725;
        color: #fff;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }

      /* ─── خودِ برگه ─────────────────────────────────────────────────── */
      .sheet {
        position: relative;
        width: 297mm;
        height: 210mm;
        margin: 0 auto 24px;
        padding: 12mm;
        background: #fff;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
        overflow: hidden;
      }

      /* جای‌گذاریِ فیزیکی — عمداً absolute و نه grid: در سندِ RTL ترتیبِ ستون‌ها
         برعکس می‌شود و «چپِ بالا» به «راستِ بالا» می‌پرد. left/top و
         right/bottom هیچ ابهامی ندارند. */
      .party { position: absolute; width: 46%; }
      .party--sender { top: 12mm; left: 12mm; }
      .party--recipient { bottom: 12mm; right: 12mm; }

      .party__title {
        margin: 0 0 6px;
        padding-bottom: 6px;
        border-bottom: 2px solid #aa4725;
        color: #aa4725;
        font-size: 13pt;
        font-weight: 700;
      }
      .party__badge {
        display: inline-block;
        margin-right: 8px;
        padding: 1px 8px;
        border-radius: 999px;
        background: #f3f4f6;
        color: #6b7280;
        font-size: 8pt;
        font-weight: 500;
        vertical-align: middle;
      }

      .row {
        display: flex;
        gap: 8px;
        align-items: baseline;
        margin-top: 5px;
        line-height: 1.75;
      }
      .row__key {
        flex: none;
        width: 22mm;
        color: #9ca3af;
        font-size: 8.5pt;
      }
      .row__value {
        flex: 1;
        min-width: 0;
        color: #111827;
        font-size: 11pt;
        font-weight: 600;
        /* آدرس‌های بلندِ فارسی نباید برگه را بشکنند */
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .row__value--ltr { direction: ltr; text-align: right; font-family: Tahoma, monospace; }
      .row__value--soft { font-weight: 400; }

      /* نوارِ میانی: کدِ رهگیری و تاریخ */
      .meta {
        position: absolute;
        top: 50%;
        left: 12mm;
        right: 12mm;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 4mm 6mm;
        border-top: 1px dashed #d1d5db;
        border-bottom: 1px dashed #d1d5db;
        color: #6b7280;
        font-size: 9pt;
      }
      .meta__code { color: #111827; font-size: 12pt; font-weight: 700; letter-spacing: 0.5px; }

      .empty {
        margin: 0 auto;
        max-width: 520px;
        padding: 24px;
        border: 1px solid #fca5a5;
        border-radius: 8px;
        background: #fef2f2;
        color: #b91c1c;
        font-size: 13px;
        line-height: 2;
        text-align: center;
      }

      /* روی نمایشگرِ باریک‌تر از A4 افقی، برگه خودش اسکرول می‌خورد و صفحه
         بدشکل نمی‌شود. در چاپ این پوشش کاملاً بی‌اثر می‌شود. */
      .sheet-wrap { overflow-x: auto; padding: 0 8px 8px; }

      @media print {
        html, body { background: #fff; }
        .toolbar, .no-print { display: none !important; }
        .sheet-wrap { overflow: visible; padding: 0; }
        .sheet {
          width: auto;
          height: auto;
          min-height: 210mm;
          margin: 0;
          box-shadow: none;
          page-break-after: avoid;
        }
      }
    `}</style>
  );
}
