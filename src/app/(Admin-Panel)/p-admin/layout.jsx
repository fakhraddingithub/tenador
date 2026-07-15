import '@/app/globals.css';
import '@/styles/admin-theme.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AdminLayout from "@/components/admin/Layout"
import SiteNavbar from "@/components/features/navbar/SiteNavbar"
import ScrollToTop from "@/components/common/ScrollToTop"
import NavigationLoader from "@/components/common/NavigationLoader"
import InitialLoadLoader from "@/components/common/InitialLoadLoader"

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
        className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] antialiased"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <InitialLoadLoader />
        <NavigationLoader />
        <ScrollToTop />
        <main className="min-h-screen overflow-x-hidden">
          {/* نوبار سایت — رنگ‌های سایت (خارج از admin-scope) دست‌نخورده می‌مانند */}
          <SiteNavbar />
          {/* از این‌جا به بعد داخل admin-scope هستیم: پریمری = سبز درباری، رادیوس = ۶ پیکسل */}
          <div className="admin-scope">
            <AdminLayout>{children}</AdminLayout>
          </div>
        </main>

        <ToastContainer
          position="top-left"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </body>
    </html>
  );
}
