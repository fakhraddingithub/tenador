/**
 * src/components/print/AddressSheet.jsx
 *
 * برگه‌ی آدرسِ ارسال. سلسله‌مراتبِ بصری:
 *
 *   بالا-راست  → لوگو (برچسبِ گوشه)
 *   بالا-چپ    → فرستنده
 *   پایین-راست → گیرنده
 *   پایینِ برگه → کدِ سفارش، خیلی ریز و کم‌رنگ
 *   دورِ برگه   → کادرِ دوخطی با گوشه‌ی ۸ پیکسل
 *
 * تاریخ عمداً هیچ‌جا چاپ نمی‌شود.
 *
 * بدونِ state و بدونِ افکت: چیزی برای «خراب شدن» ندارد. اندازه‌ها همه `em`
 * هستند تا با یک font-size (در AddressSheetStyles) بینِ A4 و A5 متناسب
 * مقیاس بگیرند.
 */

const DASH = "—";

function Row({ label, value, ltr = false, soft = false }) {
  const text = String(value ?? "").trim();
  return (
    <div className="row">
      <span className="row__key">{label}</span>
      <span
        className={[
          "row__value",
          ltr ? "row__value--ltr" : "",
          soft ? "row__value--soft" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        dir={ltr ? "ltr" : undefined}
      >
        {text || DASH}
      </span>
    </div>
  );
}

/**
 * یک طرفِ برگه. `party` هر شکلی از آدرس را می‌پذیرد که این فیلدها را داشته
 * باشد — هم اسنپ‌شاتِ سفارش، هم سندِ SenderAddress.
 */
function Party({ variant, title, badge, party }) {
  const a = party || {};
  return (
    <section className={`party party--${variant}`}>
      <h2 className="party__title">
        {title}
        {badge ? <span className="party__badge">{badge}</span> : null}
      </h2>
      <Row label="نام" value={a.fullName} />
      <Row label="تلفن" value={a.phone} ltr />
      <Row label="استان" value={a.province} />
      <Row label="شهر" value={a.city} />
      <Row label="کد پستی" value={a.postalCode} ltr />
      <Row label="آدرس" value={a.addressLine} soft />
    </section>
  );
}

export default function AddressSheet({ sender, recipient, trackingCode }) {
  return (
    <div className="sheet-wrap">
      <div className="sheet">
        {/* کادرِ دوخطی */}
        <div className="frame frame--outer" />
        <div className="frame frame--inner" />

        <div className="content">
          <div className="logo">
            {/* عمداً <img> ساده و نه next/image: لودرِ ImageKit و lazy-loading
                در مسیرِ چاپ فقط ریسک است — تصویر باید پیش از باز شدنِ دیالوگ
                آماده باشد. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo__img" src="/logo/logo.svg" alt="تنادور" loading="eager" />
            <span className="logo__text">tenador.com</span>
          </div>

          <Party
            variant="sender"
            title="فرستنده"
            badge={sender?.title || null}
            party={sender}
          />

          <Party variant="recipient" title="گیرنده" party={recipient} />

          <div className="code">کد سفارش: {trackingCode || DASH}</div>
        </div>
      </div>
    </div>
  );
}
