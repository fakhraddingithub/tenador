import "@/app/globals.css"

import SiteNavbar from '@/components/features/navbar/SiteNavbar'
import CartCleanup from '@/components/features/cart/CartCleanup'
import ScrollToTop from '@/components/common/ScrollToTop'
import NavigationLoader from '@/components/common/NavigationLoader'
import InitialLoadLoader from '@/components/common/InitialLoadLoader'
import DashboardBody from './DashboardBody'

// سرور-کامپوننت تا <SiteNavbar /> بتواند navData را روی سرور بگیرد.
// بخش‌های stateful (سایدبار و ترنزیشن صفحه) در DashboardBody کلاینتی هستند.
export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
          type="text/css"
        />
      </head>
      <body>
        <InitialLoadLoader />
        <NavigationLoader />
        <ScrollToTop />
        <CartCleanup />

        <div className="min-h-screen bg-[#f8fafc] text-slate-800 rtl font-sans">

          {/* منوی بالایی — نوبار اصلی سایت (جایگزین نوبار قدیمی داشبورد) */}
          <SiteNavbar />

          <DashboardBody>{children}</DashboardBody>
        </div>
      </body>
    </html>
  )
}
