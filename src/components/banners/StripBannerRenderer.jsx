"use client";

/**
 * StripBannerRenderer
 * رندر بنر نواری (strip) - برای نوار باریک زیر بنرها
 */
export default function StripBannerRenderer({ banner }) {
  if (!banner) return null;
  const c = banner.colors || {};

  const baseStyle = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
    direction: "rtl",
    cursor: banner.link ? "pointer" : "default",
    fontFamily: "var(--font-sans, Vazirmatn, sans-serif)",
  };

  const handleClick = () => {
    if (banner.link) window.location.href = banner.link;
  };

  switch (banner.template) {
    case "flame":
    case "neon":
      return <MarqueeStrip banner={banner} style={baseStyle} onClick={handleClick} c={c} dark />;
    case "luxury":
    case "editorial":
      return <ElegantStrip banner={banner} style={baseStyle} onClick={handleClick} c={c} />;
    case "geometric":
    case "brutalist":
      return <BoldStrip banner={banner} style={baseStyle} onClick={handleClick} c={c} />;
    case "symmetric":
        return <SymmetricStrip banner={banner} style={baseStyle} onClick={handleClick} c={c} />;
    default:
      return <MarqueeStrip banner={banner} style={baseStyle} onClick={handleClick} c={c} />;
  }
}

/* نوار متحرک مارکی */
function MarqueeStrip({ banner, style, onClick, c, dark }) {
  const bg = dark
    ? `linear-gradient(90deg, ${c.bg || "#0d0d0d"}, ${c.primary || "#aa4725"}44, ${c.bg || "#0d0d0d"})`
    : `linear-gradient(90deg, ${c.primary || "#aa4725"}, ${c.secondary || "#ffbf00"}, ${c.primary || "#aa4725"})`;

  const text = banner.title || banner.subtitle || "تخفیف ویژه";
  const repeated = Array(6).fill(`${text} ✦`).join("  ");

  return (
    <div style={{ ...style, background: bg }} onClick={onClick}>
      <style>{`
        @keyframes strip-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .strip-marquee-inner {
          display: flex;
          white-space: nowrap;
          animation: strip-marquee 20s linear infinite;
        }
      `}</style>
      <div style={{ overflow: "hidden", flex: 1 }}>
        <div className="strip-marquee-inner">
          <span style={{
            color: dark ? (c.text || "#fff") : "#fff",
            fontSize: "0.88rem", fontWeight: 700,
            letterSpacing: "0.08em",
            padding: "0 1rem",
          }}>
            {repeated} &nbsp;&nbsp;&nbsp; {repeated}
          </span>
        </div>
      </div>
      {banner.ctaText && (
        <button onClick={(e) => { e.stopPropagation(); if (banner.link) window.location.href = banner.link; }} style={{
          background: dark ? (c.primary || "#aa4725") : "rgba(255,255,255,0.25)",
          border: dark ? "none" : "1px solid rgba(255,255,255,0.5)",
          color: "#fff",
          padding: "0.35em 1.2em",
          borderRadius: "6px",
          fontSize: "0.8rem", fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          flexShrink: 0, marginRight: "1rem",
        }}>
          {banner.ctaText}
        </button>
      )}
    </div>
  );
}

/* نوار ظریف و لاکچری */
function ElegantStrip({ banner, style, onClick, c }) {
  return (
    <div style={{ ...style, background: c.bg || "#0a0a0a", borderTop: `2px solid ${c.secondary || "#ffbf00"}44` }} onClick={onClick}>
      {/* نقاط تزئینی */}
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${10 + i * 20}%`,
          top: "50%", transform: "translateY(-50%)",
          width: "4px", height: "4px", borderRadius: "50%",
          background: c.secondary || "#ffbf00",
          opacity: 0.4,
        }} />
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flex: 1, justifyContent: "center" }}>
        {banner.badge && (
          <span style={{
            color: c.secondary || "#ffbf00",
            fontSize: "0.72rem", letterSpacing: "0.25em", textTransform: "uppercase",
          }}>
            {banner.badge}
          </span>
        )}
        {banner.badge && banner.title && (
          <span style={{ color: `${c.secondary || "#ffbf00"}55`, fontSize: "0.7rem" }}>◆</span>
        )}
        {banner.title && (
          <span style={{
            color: c.text || "#fff",
            fontSize: "0.9rem", fontWeight: 600, letterSpacing: "0.05em",
          }}>
            {banner.title}
          </span>
        )}
        {banner.subtitle && (
          <>
            <span style={{ color: `${c.secondary || "#ffbf00"}55`, fontSize: "0.7rem" }}>◆</span>
            <span style={{ color: c.textSecondary || "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>
              {banner.subtitle}
            </span>
          </>
        )}
      </div>

      {banner.ctaText && (
        <button style={{
          background: "transparent",
          border: `1px solid ${c.secondary || "#ffbf00"}`,
          color: c.secondary || "#ffbf00",
          padding: "0.28em 1em",
          fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em",
          cursor: "pointer", fontFamily: "inherit",
        }}>
          {banner.ctaText}
        </button>
      )}
    </div>
  );
}

/* نوار پررنگ بولد */
function BoldStrip({ banner, style, onClick, c }) {
  return (
    <div style={{
      ...style,
      background: c.primary || "#aa4725",
    }} onClick={onClick}>
      {/* هاشور پس‌زمینه */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 12px)`,
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, position: "relative" }}>
        {banner.badge && (
          <span style={{
            background: c.secondary || "#ffbf00",
            color: "#000",
            padding: "0.2em 0.8em",
            fontSize: "0.75rem", fontWeight: 900,
            textTransform: "uppercase", letterSpacing: "0.1em",
            flexShrink: 0,
          }}>
            {banner.badge}
          </span>
        )}
        {banner.title && (
          <span style={{
            color: "#fff", fontSize: "1rem", fontWeight: 900,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {banner.title}
          </span>
        )}
        {banner.subtitle && (
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", fontWeight: 600 }}>
            {banner.subtitle}
          </span>
        )}
      </div>

      {banner.ctaText && (
        <button style={{
          background: "#fff",
          border: "none",
          color: c.primary || "#aa4725",
          padding: "0.35em 1.3em",
          fontSize: "0.82rem", fontWeight: 900,
          cursor: "pointer", fontFamily: "inherit",
          textTransform: "uppercase", letterSpacing: "0.05em",
          flexShrink: 0, position: "relative",
        }}>
          {banner.ctaText} ←
        </button>
      )}
    </div>
  );
}

function SymmetricStrip({ banner, style, onClick, c }) {
  const defaultBg            = "#090a0f";
  const defaultPrimary       = "#00f5d4";
  const defaultText          = "#ffffff";
  const defaultTextSecondary = "#ffffff";

  const titleText       = banner.title || "";
  const firstSpaceIndex = titleText.indexOf(" ");
  const firstWord       = firstSpaceIndex !== -1 ? titleText.substring(0, firstSpaceIndex) : titleText;
  const restOfTitle     = firstSpaceIndex !== -1 ? titleText.substring(firstSpaceIndex) : "";

  const imgs     = banner.images instanceof Map ? Object.fromEntries(banner.images) : (banner.images || {});
  const imageUrl = imgs.imageUrl || banner.imageUrl || "";

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        ...style,
        backgroundColor: c.bg || defaultBg,
        backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.02) 0%, transparent 65%)",
        padding: 0,
      }}
      onClick={onClick}
    >
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60 pointer-events-none z-[1]" />

      {/* تصویر سمت چپ */}
      {imageUrl && (
        <div className="absolute left-[4%] md:left-[8%] top-1/2 -translate-y-1/2 h-[85%] aspect-square z-[2] flex items-center justify-center">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
          />
        </div>
      )}

      {/* محتوای متنی — absolute وسط دقیق */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center justify-center text-center select-none leading-tight"
        style={{ width: "40%" }}
      >
        {banner.title && (
          <h2
            className="m-0 text-[2rem] font-black tracking-[2px] sm:tracking-[4px] uppercase leading-none whitespace-nowrap"
            style={{
              color: c.text || defaultText,
              fontFamily: "'Orbitron', 'Inter', sans-serif",
            }}
          >
            <span style={{ color: c.primary || defaultPrimary }}>{firstWord}</span>
            {restOfTitle}
          </h2>
        )}
        {banner.subtitle && (
          <p
            className="m-0 mt-1 text-[8px] sm:text-[10px] font-bold tracking-[0.18em] sm:tracking-[0.28em] uppercase opacity-90 leading-none whitespace-nowrap"
            style={{
              color: c.textSecondary || defaultTextSecondary,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {banner.subtitle}
          </p>
        )}
      </div>

      {/* تصویر سمت راست (قرینه) */}
      {imageUrl && (
        <div className="absolute right-[4%] md:right-[8%] top-1/2 -translate-y-1/2 h-[85%] aspect-square z-[2] flex items-center justify-center">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
          />
        </div>
      )}
    </div>
  );
}
 