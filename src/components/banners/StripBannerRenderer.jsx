"use client";

import { useState } from "react";

/**
 * StripBannerRenderer
 * رندر بنر نواری (strip) - برای نوار باریک زیر بنرها همراه با تمپلیت پرمیوم
 */
export default function StripBannerRenderer({ banner }) {
  if (!banner) return null;
  const c = banner.colors || {};

  const handleClick = () => {
    if (banner.link) window.location.href = banner.link;
  };

  const cursorClass = banner.link ? "cursor-pointer select-none" : "cursor-default select-none";

  switch (banner.template) {
    case "premium":
      return <PremiumStrip banner={banner} onClick={handleClick} c={c} cursorClass={cursorClass} />;
    case "symmetric":
      // اصلاح شد: wrapperClasses حذف و cursorClass جایگزین شد تا از خطای کرش جلوگیری شود
      return <SymmetricTemplate banner={banner} cursorClass={cursorClass} onClick={handleClick} c={c} />;
    case "flame":
    case "neon":
      return <MarqueeStrip banner={banner} onClick={handleClick} c={c} cursorClass={cursorClass} dark />;
    case "luxury":
    case "editorial":
      return <ElegantStrip banner={banner} onClick={handleClick} c={c} cursorClass={cursorClass} />;
    case "geometric":
    case "brutalist":
      return <BoldStrip banner={banner} onClick={handleClick} c={c} cursorClass={cursorClass} />;
    default:
      return <MarqueeStrip banner={banner} onClick={handleClick} c={c} cursorClass={cursorClass} />;
  }
}

/* =====================================================
   NEW TEMPLATE: SYMMETRIC (استایل مدرن ورزشی و قرینه)
   ===================================================== */
function SymmetricTemplate({ banner, cursorClass, onClick, c }) {
  // رنگ‌های پیش‌فرض منطبق بر تصویر ورزشی (تیره، سبز‌آبی/Teal و سفید)
  const defaultBg = "#090a0f"; 
  const defaultPrimary = "#00f5d4"; 
  const defaultText = "#ffffff";
  const defaultTextSecondary = "#ffffff";

  // تفکیک کلمه اول عنوان برای دو رنگه کردن استایل هدر وسط
  const titleText = banner.title || "WARNER";
  const firstSpaceIndex = titleText.indexOf(" ");
  const firstWord = firstSpaceIndex !== -1 ? titleText.substring(0, firstSpaceIndex) : titleText;
  const restOfTitle = firstSpaceIndex !== -1 ? titleText.substring(firstSpaceIndex) : "";

  return (
    <div 
      className={`w-full h-full flex items-center justify-center bg-center bg-no-repeat relative overflow-hidden ${cursorClass}`}
      style={{ 
        backgroundColor: c.bg || defaultBg,
        backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.02) 0%, transparent 65%)"
      }}
      onClick={onClick}
    >
      {/* هاله تاریک دو طرف بنر برای تمرکز روی مرکز (Vignette) */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60 pointer-events-none z-[1]" />

      {/* المان تصویری سمت چپ */}
      {banner.imageUrl && (
        <div className="absolute left-[4%] md:left-[8%] top-1/2 -translate-y-1/2 h-[85%] aspect-square z-[2] flex items-center justify-center">
          <img 
            src={banner.imageUrl} 
            alt="" 
            className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
          />
        </div>
      )}

      {/* باکس محتوای متنی متمرکز در وسط - سایزها برای ارتفاع کم نوار بهینه‌سازی شدند */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 max-w-[50%] select-none leading-tight">
        {banner.title && (
          <h2 
            className="m-0 text-[2rem] sm:text-[2rem] md:text-[2rem] font-black tracking-[2px] sm:tracking-[4px] uppercase leading-none transition-all duration-200"
            style={{ 
              color: c.text || defaultText,
              fontFamily: "'Orbitron', 'Inter', sans-serif"
            }}
          >
            <span style={{ color: c.primary || defaultPrimary }}>{firstWord}</span>
            {restOfTitle}
          </h2>
        )}

        {banner.subtitle && (
          <p 
            className="m-0 mt-1 text-[8px] sm:text-[10px] font-bold tracking-[0.18em] sm:tracking-[0.28em] uppercase opacity-90 leading-none"
            style={{ 
              color: c.textSecondary || defaultTextSecondary,
              fontFamily: "'Inter', sans-serif"
            }}
          >
            {banner.subtitle}
          </p>
        )}
      </div>

      {/* المان تصویری سمت راست (قرینه) */}
      {banner.imageUrl && (
        <div className="absolute right-[4%] md:right-[8%] top-1/2 -translate-y-1/2 h-[85%] aspect-square z-[2] flex items-center justify-center">
          <img 
            src={banner.imageUrl} 
            alt="" 
            className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
          />
        </div>
      )}
    </div>
  );
}

/* ۱. نوار جدید و ویژه پرمیوم (Glassmorphism + Shimmer Effect) */
function PremiumStrip({ banner, onClick, c, cursorClass }) {
  return (
    <div 
      className={`w-full h-full flex items-center justify-between px-6 sm:px-8 overflow-hidden relative backdrop-blur-md border-y transition-all ${cursorClass}`}
      style={{ 
        background: `linear-gradient(135deg, ${c.bg || "#0d0d11"}ee, ${c.primary || "#16161a"}dd)`,
        borderColor: `${c.secondary || "#aa4725"}22`
      }} 
      onClick={onClick}
    >
      {/* افکت درخشش متحرک لوکس در پس‌زمینه */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[strip-shine_3s_infinite]" />
      <style>{`
        @keyframes strip-shine {
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div className="flex items-center gap-4 flex-1 justify-center z-10">
        {banner.badge && (
          <span 
            className="text-[9px] font-black tracking-[0.2em] uppercase px-2.5 py-0.5 rounded-full border border-current shadow-sm"
            style={{ color: c.secondary || "#ffbf00" }}
          >
            {banner.badge}
          </span>
        )}
        
        <div className="flex items-center gap-2">
          {banner.title && (
            <span className="text-xs sm:text-sm font-black tracking-wide" style={{ color: c.text || "#ffffff" }}>
              {banner.title}
            </span>
          )}
          {banner.subtitle && (
            <span className="text-[11px] font-medium opacity-75 hidden sm:inline" style={{ color: c.textSecondary || "#e4e4e7" }}>
              {banner.subtitle}
            </span>
          )}
        </div>
      </div>

      {banner.ctaText && (
        <button 
          className="text-[11px] font-bold py-1.5 px-4 rounded-full shrink-0 mr-4 transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 z-10"
          style={{
            background: c.secondary || "#aa4725",
            color: "#fff"
          }}
        >
          {banner.ctaText} ←
        </button>
      )}
    </div>
  );
}

/* ۲. نوار متحرک مارکی (Marquee) */
function MarqueeStrip({ banner, onClick, c, dark, cursorClass }) {
  const bg = dark
    ? `linear-gradient(90deg, ${c.bg || "#0d0d0d"}, ${c.primary || "#aa4725"}44, ${c.bg || "#0d0d0d"})`
    : `linear-gradient(90deg, ${c.primary || "#aa4725"}, ${c.secondary || "#ffbf00"}, ${c.primary || "#aa4725"})`;

  const text = banner.title || banner.subtitle || "تخفیف ویژه";
  const repeated = Array(6).fill(`${text} ✦`).join("  ");

  return (
    <div className={`w-full h-full flex items-center justify-between px-6 sm:px-8 overflow-hidden relative ${cursorClass}`} style={{ background: bg }} onClick={onClick}>
      <style>{`
        @keyframes strip-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .strip-marquee-inner {
          display: flex;
          white-space: nowrap;
          animation: strip-marquee 25s linear infinite;
        }
      `}</style>
      <div className="overflow-hidden flex-1">
        <div className="strip-marquee-inner">
          <span className="text-xs font-bold tracking-wider px-4" style={{ color: dark ? (c.text || "#fff") : "#fff" }}>
            {repeated} &nbsp;&nbsp;&nbsp; {repeated}
          </span>
        </div>
      </div>
      {banner.ctaText && (
        <button 
          onClick={(e) => { e.stopPropagation(); if (banner.link) window.location.href = banner.link; }} 
          className="text-[11px] font-bold py-1 px-3.5 rounded-md shrink-0 mr-4 active:scale-95 transition-transform"
          style={{
            background: dark ? (c.primary || "#aa4725") : "rgba(255,255,255,0.25)",
            border: dark ? "none" : "1px solid rgba(255,255,255,0.5)",
            color: "#fff",
          }}
        >
          {banner.ctaText}
        </button>
      )}
    </div>
  );
}

/* ۳. نوار ظریف و لاکچری (Elegant) */
function ElegantStrip({ banner, onClick, c, cursorClass }) {
  return (
    <div 
      className={`w-full h-full flex items-center justify-between px-6 sm:px-8 overflow-hidden relative ${cursorClass}`} 
      style={{ backgroundColor: c.bg || "#0a0a0a", borderTop: `2px solid ${c.secondary || "#ffbf00"}44` }} 
      onClick={onClick}
    >
      {[...Array(5)].map((_, i) => (
        <div 
          key={i} 
          className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full opacity-30 hidden md:block"
          style={{ left: `${15 + i * 18}%`, backgroundColor: c.secondary || "#ffbf00" }} 
        />
      ))}

      <div className="flex items-center gap-3 flex-1 justify-center z-10">
        {banner.badge && (
          <span className="text-[10px] tracking-[0.2em] uppercase font-medium" style={{ color: c.secondary || "#ffbf00" }}>
            {banner.badge}
          </span>
        )}
        {banner.badge && banner.title && (
          <span className="text-[9px] opacity-40" style={{ color: c.secondary || "#ffbf00" }}>◆</span>
        )}
        {banner.title && (
          <span className="text-xs sm:text-sm font-medium tracking-wide" style={{ color: c.text || "#fff" }}>
            {banner.title}
          </span>
        )}
        {banner.subtitle && (
          <>
            <span className="text-[9px] opacity-40 hidden sm:inline" style={{ color: c.secondary || "#ffbf00" }}>◆</span>
            <span className="text-xs opacity-70 hidden sm:inline" style={{ color: c.textSecondary || "#fff" }}>
              {banner.subtitle}
            </span>
          </>
        )}
      </div>

      {banner.ctaText && (
        <button 
          className="bg-transparent border text-[11px] font-medium py-1 px-3 transition-colors z-10"
          style={{ borderColor: c.secondary || "#ffbf00", color: c.secondary || "#ffbf00" }}
        >
          {banner.ctaText}
        </button>
      )}
    </div>
  );
}

/* ۴. نوار پررنگ بولد (Bold) */
function BoldStrip({ banner, onClick, c, cursorClass }) {
  return (
    <div 
      className={`w-full h-full flex items-center justify-between px-6 sm:px-8 overflow-hidden relative ${cursorClass}`} 
      style={{ background: c.primary || "#aa4725" }} 
      onClick={onClick}
    >
      <div 
        className="absolute inset-0 opacity-10" 
        style={{ backgroundImage: `repeating-linear-gradient(45deg, #fff 0px, #fff 1px, transparent 1px, transparent 12px)` }} 
      />

      <div className="flex items-center gap-3 flex-1 relative z-10">
        {banner.badge && (
          <span className="text-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shrink-0" style={{ backgroundColor: c.secondary || "#ffbf00" }}>
            {banner.badge}
          </span>
        )}
        {banner.title && (
          <span className="text-white text-xs sm:text-sm font-black uppercase tracking-wide">
            {banner.title}
          </span>
        )}
        {banner.subtitle && (
          <span className="text-white/80 text-xs font-bold hidden sm:inline">
            {banner.subtitle}
          </span>
        )}
      </div>

      {banner.ctaText && (
        <button 
          className="bg-white text-[11px] font-black py-1 px-4 shrink-0 relative transition-transform active:scale-95 uppercase tracking-wider z-10"
          style={{ color: c.primary || "#aa4725" }}
        >
          {banner.ctaText} ←
        </button>
      )}
    </div>
  );
}