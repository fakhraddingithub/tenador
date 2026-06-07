// src/app/layout.js

import "@/app/globals.css";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Navbar from "@/components/features/navbar/Navbar";
import WhatsAppSupport from "@/components/features/WhatsAppSupport/WhatsAppSupport";
import Footer from "@/components/features/footer/Footer";

import { getCachedNavbar } from "@/lib/navbarService";
import { UserProvider } from "@/components/features/auth/UserContext";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com";

export const metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: "تنادور | فروشگاه آنلاین تنیس و پدل",
    template: "%s | تنادور",
  },

  description:
    "تنادور فروشگاه آنلاین لوازم تنیس و پدل؛ خرید انواع راکت، کفش، پوشاک و تجهیزات حرفه‌ای از برندهای معتبر جهانی با ضمانت اصالت و ارسال سریع.",

  keywords: [
    "لوازم تنیس",
    "لوازم پدل",
    "راکت تنیس",
    "راکت پدل",
    "کفش تنیس",
    "پوشاک تنیس",
    "فروشگاه تنیس",
    "فروشگاه پدل",
    "Wilson",
    "Head",
    "Babolat",
    "Yonex",
  ],

  authors: [{ name: "Tenador" }],
  creator: "Tenador",
  publisher: "Tenador",

  applicationName: "Tenador",

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  openGraph: {
    type: "website",

    locale: "fa_IR",

    url: SITE_URL,

    siteName: "تنادور",

    title: "تنادور | فروشگاه آنلاین تنیس و پدل",

    description:
      "خرید آنلاین تجهیزات حرفه‌ای تنیس و پدل از برندهای معتبر جهانی با ضمانت اصالت و ارسال سریع.",

    images: [
      {
        url: "/images/og-cover.jpg",
        width: 1200,
        height: 630,
        alt: "Tenador Tennis & Padel Shop",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title: "تنادور | فروشگاه آنلاین تنیس و پدل",

    description: "خرید آنلاین تجهیزات حرفه‌ای تنیس و پدل با ارسال سریع.",

    images: ["/images/og-cover.jpg"],
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },

  manifest: "/site.webmanifest",
};

export default async function RootLayout({ children }) {
  // ⚠️ هیچ `cookies()`/`headers()` در این layout صدا زده نمی‌شود تا کل درخت `(Site)`
  // بتواند static/ISR باقی بماند. وضعیت کاربر در جزیره‌ی کلاینت `UserProvider` مدیریت می‌شود.
  const navData = await getCachedNavbar();

  const jsonLd = {
    "@context": "https://schema.org",

    "@type": "Store",

    name: "تنادور",

    url: SITE_URL,

    logo: `${SITE_URL}/images/logo.png`,

    image: `${SITE_URL}/images/og-cover.jpg`,

    description: "فروشگاه آنلاین لوازم تنیس و پدل",

    sameAs: ["https://instagram.com/tenador"],
  };

  return (
    <html lang="fa-IR" dir="rtl">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
          type="text/css"
        />

        <meta name="theme-color" content="#ffffff" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
      </head>

      <body className="bg-[var(--color-background)] text-[var(--color-text)]">
        <UserProvider>
          <Navbar navData={navData} />

          <WhatsAppSupport />

          <main className="min-h-screen">{children}</main>

          <Footer />
        </UserProvider>

        <ToastContainer
          position="top-left"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
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
