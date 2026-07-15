// src/app/layout.js

import "@/app/globals.css";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Navbar from "@/components/features/navbar/Navbar";
import WhatsAppSupport from "@/components/features/WhatsAppSupport/WhatsAppSupport";
import Footer from "@/components/features/footer/Footer";

import { getCachedNavbar } from "@/lib/navbarService";
import { UserProvider } from "@/components/features/auth/UserContext";
import CartCleanup from "@/components/features/cart/CartCleanup";
import ScrollToTop from "@/components/common/ScrollToTop";
import NavigationLoader from "@/components/common/NavigationLoader";
import InitialLoadLoader from "@/components/common/InitialLoadLoader";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");
const SITE_IMAGE_FALLBACK_SRC = "/images/default-site-image.png";

function siteImageFallbackScript(src) {
  return `
    (() => {
      const fallbackSrc = ${JSON.stringify(src)};

      const applyFallback = (img) => {
        if (!(img instanceof HTMLImageElement)) return;

        const fallbackUrl = new URL(fallbackSrc, window.location.origin).href;
        const currentSrc = img.currentSrc || img.src || "";

        if (img.dataset.fallbackApplied === "true" || currentSrc === fallbackUrl) {
          return;
        }

        img.dataset.fallbackApplied = "true";
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");

        const picture = img.parentElement?.tagName === "PICTURE" ? img.parentElement : null;
        picture?.querySelectorAll("source").forEach((source) => {
          source.removeAttribute("srcset");
        });

        img.src = fallbackSrc;
      };

      window.addEventListener(
        "error",
        (event) => {
          applyFallback(event.target);
        },
        true
      );
    })();
  `;
}

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

  alternates: {
    types: { "application/rss+xml": `${SITE_URL}/rss.xml` },
  },

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

    "@id": `${SITE_URL}/#organization`,

    name: "تنادور",

    url: SITE_URL,

    logo: `${SITE_URL}/images/logo.png`,

    image: `${SITE_URL}/images/og-cover.jpg`,

    description: "فروشگاه آنلاین لوازم تنیس و پدل",

    sameAs: ["https://instagram.com/tenador.shop"],
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

        <script
          dangerouslySetInnerHTML={{
            __html: siteImageFallbackScript(SITE_IMAGE_FALLBACK_SRC),
          }}
        />
      </head>

      <body className="bg-[var(--color-background)] text-[var(--color-text)]">
        <InitialLoadLoader />
        <NavigationLoader />
        <UserProvider>
          <ScrollToTop />
          <CartCleanup />

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
