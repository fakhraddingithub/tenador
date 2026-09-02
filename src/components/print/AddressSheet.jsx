/**
 * src/components/print/AddressSheet.jsx
 *
 * برگه‌ی آدرسِ ارسال — A4 افقی. فرستنده بالا-چپ، گیرنده پایین-راست.
 *
 * سرور-کامپوننت و کاملاً بدونِ state: چیزی برای «خراب شدن» ندارد.
 * هیچ فیلدی حذف نمی‌شود؛ مقدارِ خالی «—» چاپ می‌شود تا جای دست‌نویس بماند.
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

export default function AddressSheet({ sender, recipient, trackingCode, orderDate }) {
  return (
    <div className="sheet-wrap">
      <div className="sheet">
        <Party
          variant="sender"
          title="فرستنده"
          badge={sender?.title || null}
          party={sender}
        />

        <div className="meta">
          <span>
            کد سفارش: <span className="meta__code" dir="ltr">{trackingCode || DASH}</span>
          </span>
          <span>{orderDate || ""}</span>
        </div>

        <Party variant="recipient" title="گیرنده" party={recipient} />
      </div>
    </div>
  );
}
