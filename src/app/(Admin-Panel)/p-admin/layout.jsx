import '@/app/globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AdminLayout from "@/components/admin/Layout"
import SiteNavbar from "@/components/features/navbar/SiteNavbar"

export const metadata = {
  title: 'فروشگاه ورزشی تنادور | پنل مدیریت',
  description: 'پنل مدیریت یکپارچه فروشگاه ورزشی تنادور',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa-IR" dir="rtl" className="scroll-smooth">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
          type="text/css"
        />
      </head>
      <body
        className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] antialiased selection:bg-[var(--color-primary)] selection:text-white"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <main className="min-h-screen overflow-x-hidden">
          {/* نوبار اصلی سایت — بالای نوبار پنل مدیریت (دو نوبار روی‌هم چیده می‌شوند) */}
          <SiteNavbar />
          {/* transform یک containing-block می‌سازد تا سایدبار/هدرِ fixed و sticky پنل
              ادمین زیر نوبار سایت (۷۵px) قرار بگیرند، بدون تغییر خود کامپوننت ادمین */}
          <div style={{ transform: "translateZ(0)" }}>
            <AdminLayout>{children}</AdminLayout>
          </div>
        </main>

        <ToastContainer
          position="top-left"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={true}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </body>
    </html>
  );
}