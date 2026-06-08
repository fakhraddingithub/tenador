// 404 سراسری برای آدرس‌های نامعتبر.
// چون root layout داخل گروهِ مسیرِ (Site) قرار دارد و app/layout.js نداریم،
// این فایل باید خودش <html> و <body> و استایل سراسری را فراهم کند.
import "@/app/globals.css";
import NotFoundContent from "@/components/ui/NotFoundContent";

export const metadata = {
  title: "صفحه پیدا نشد | تنادور",
};

export default function NotFound() {
  return (
    <html lang="fa-IR" dir="rtl">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
          type="text/css"
        />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body
        className="bg-[var(--color-background)] text-[var(--color-text)]"
        style={{ fontFamily: "Vazirmatn, system-ui, sans-serif" }}
      >
        <main className="min-h-screen">
          <NotFoundContent />
        </main>
      </body>
    </html>
  );
}
