/**
 * src/app/(Print)/layout.jsx
 *
 * ریشه‌ی مستقلِ صفحه‌های چاپ.
 *
 * ⚠️ این یک root layout مستقل است (مثلِ (Site) و p-admin) و عمداً هیچ‌کدام از
 * اینها را ایمپورت نمی‌کند: globals.css، تمِ ادمین، تیلویند، ToastContainer،
 * پروایدرها. دلیلش معماری است، نه سلیقه:
 *
 *   پیاده‌سازیِ قبلی یک پنجره‌ی `window.open("")` می‌ساخت و با `document.write`
 *   داخلش HTML می‌ریخت. آن پنجره هم‌مبدأ و در همان فرایندِ رندرِ صفحه‌ی اصلی
 *   بود، پس دیالوگِ چاپ کلِ آن فرایند را قفل می‌کرد و بستنش صفحه‌ی ادمین را
 *   نیمه‌مرده رها می‌کرد.
 *
 *   حالا برگه‌ی چاپ یک *سند واقعی روی یک URL واقعی* است که با
 *   `target="_blank" rel="noopener"` باز می‌شود. `noopener` تبِ جدید را در
 *   گروهِ context (و عملاً فرایندِ) جداگانه می‌گذارد: نه به window صفحه‌ی ادمین
 *   دسترسی دارد، نه صفحه‌ی ادمین به آن. بستن/لغو/رفرشِ آن تب هیچ اثری روی
 *   DOM، state، روتینگ یا استایلِ پنل ندارد، چون هیچ‌چیزِ مشترکی وجود ندارد.
 */

export const metadata = {
  title: "برگه چاپ",
  robots: { index: false, follow: false, nocache: true },
};

export default function PrintRootLayout({ children }) {
  return (
    <html lang="fa-IR" dir="rtl">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
          type="text/css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
