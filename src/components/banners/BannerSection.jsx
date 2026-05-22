"use client";

import { useEffect, useState } from "react";
import BannerRenderer from "./BannerRenderer";
import StripBannerRenderer from "./StripBannerRenderer";

/**
 * BannerSection
 * کامپوننت اصلی نمایش بنرها در صفحه اصلی فروشگاه
 * لایوت: یک بنر افقی (wide) + دو بنر عمودی (tall-1, tall-2) + یک نوار (strip)
 */
export default function BannerSection() {
  const [banners, setBanners] = useState({ wide: null, tall1: null, tall2: null, strip: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await fetch("/api/banners");
      const data = await res.json();
      if (data.success) {
        const map = { wide: null, tall1: null, tall2: null, strip: null };
        data.banners.forEach((b) => {
          if (b.position === "wide" && !map.wide) map.wide = b;
          if (b.position === "tall-1" && !map.tall1) map.tall1 = b;
          if (b.position === "tall-2" && !map.tall2) map.tall2 = b;
          if (b.position === "strip" && !map.strip) map.strip = b;
        });
        setBanners(map);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <BannerSkeleton />;

  if (!banners.wide && !banners.tall1 && !banners.tall2 && !banners.strip) return null;

  return (
    <section style={{ padding: "24px 0", direction: "rtl", fontFamily: "var(--font-sans, Vazirmatn, sans-serif)" }}>
      <style>{`
        .banner-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          grid-template-rows: 320px;
          gap: 12px;
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 16px;
        }
        .banner-cell {
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .banner-cell:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 48px rgba(0,0,0,0.18);
        }
        .banner-strip-wrap {
          max-width: 1280px;
          margin: 12px auto 0;
          padding: 0 16px;
        }
        .banner-strip {
          height: 72px;
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .banner-strip:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        .banner-placeholder {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          background: linear-gradient(135deg, #f0f0f0, #e8e8e8);
          border: 2px dashed #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #aaa;
          font-size: 13px;
        }
        @media (max-width: 1024px) {
          .banner-grid {
            grid-template-columns: 2fr 1fr;
            grid-template-rows: 280px;
          }
          .banner-cell:nth-child(3) {
            display: none;
          }
        }
        @media (max-width: 640px) {
          .banner-grid {
            grid-template-columns: 1fr;
            grid-template-rows: 220px;
          }
          .banner-cell:nth-child(2),
          .banner-cell:nth-child(3) {
            display: none;
          }
          .banner-strip { height: 60px; }
        }
      `}</style>

      <div className="banner-grid">
        <div className="banner-cell">
          {banners.wide
            ? <BannerRenderer banner={banners.wide} />
            : <div className="banner-placeholder">بنر اصلی</div>}
        </div>
        <div className="banner-cell">
          {banners.tall1
            ? <BannerRenderer banner={banners.tall1} />
            : <div className="banner-placeholder">بنر کناری ۱</div>}
        </div>
        <div className="banner-cell">
          {banners.tall2
            ? <BannerRenderer banner={banners.tall2} />
            : <div className="banner-placeholder">بنر کناری ۲</div>}
        </div>
      </div>

      {banners.strip && (
        <div className="banner-strip-wrap">
          <div className="banner-strip">
            <StripBannerRenderer banner={banners.strip} />
          </div>
        </div>
      )}
    </section>
  );
}

function BannerSkeleton() {
  return (
    <section style={{ padding: "24px 0", direction: "rtl" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skel {
          border-radius: 12px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 800px 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", maxWidth: "1280px", margin: "0 auto", padding: "0 16px" }}>
        <div className="skel" style={{ height: "320px" }} />
        <div className="skel" style={{ height: "320px" }} />
        <div className="skel" style={{ height: "320px" }} />
      </div>
      <div style={{ maxWidth: "1280px", margin: "12px auto 0", padding: "0 16px" }}>
        <div className="skel" style={{ height: "72px" }} />
      </div>
    </section>
  );
}
