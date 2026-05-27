"use client";

/**
 * BannerRenderer
 * رندر بنر بر اساس تمپلیت و داده‌های دریافتی
 */

export default function BannerRenderer({ banner, preview = false }) {
  if (!banner) return null;

  // images از MongoDB ممکنه Map باشه یا plain object — هر دو رو handle کن
  const imgs =
    banner.images instanceof Map
      ? Object.fromEntries(banner.images)
      : banner.images || {};

  // یه proxy می‌سازیم که banner.imageUrl, banner.image2Url و ... کار کنه
  const b = {
    ...banner,
    imageUrl: imgs.imageUrl || banner.imageUrl || "",
    image2Url: imgs.image2Url || banner.image2Url || "",
    image3Url: imgs.image3Url || banner.image3Url || "",
  };

  const c =
    b.colors instanceof Map ? Object.fromEntries(b.colors) : b.colors || {};
  const fontSize = preview ? "0.55" : "1";

  const wrapStyle = {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    cursor: b.link ? "pointer" : "default",
    fontSize: `${fontSize}rem`,
  };

  const handleClick = () => {
    if (!preview && b.link) window.location.href = b.link;
  };

  switch (b.template) {
    case "flame":
      return (
        <FlameTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    case "luxury":
      return (
        <LuxuryTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    case "geometric":
      return (
        <GeometricTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    case "neon":
      return (
        <NeonTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    case "organic":
      return (
        <OrganicTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    case "editorial":
      return (
        <EditorialTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    case "brutalist":
      return (
        <BrutalistTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    case "gradient-wave":
      return (
        <GradientWaveTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    case "overlay-photo":
      return (
        <ElegantOverlayTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    case "elegant-overlay":
      return (
        <ElegantOverlayTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    case "adventure-shoes":
      return (
        <AdventureShoesTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
    default:
      return (
        <FlameTemplate
          banner={b}
          style={wrapStyle}
          onClick={handleClick}
          c={c}
        />
      );
  }
}

/* =====================================================
   TEMPLATE 1: FLAME — آتشین، برای کمپین‌های تخفیف
   ===================================================== */
function FlameTemplate({ banner, style, onClick, c }) {
  return (
    <div style={{ ...style, background: c.bg || "#0d0d0d" }} onClick={onClick}>
      {/* آتش SVG پس‌زمینه */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.18,
        }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="flameGrad" cx="50%" cy="80%" r="60%">
            <stop
              offset="0%"
              stopColor={c.primary || "#aa4725"}
              stopOpacity="1"
            />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="200" cy="300" rx="200" ry="150" fill={`url(#flameGrad)`} />
        <ellipse
          cx="200"
          cy="280"
          rx="120"
          ry="100"
          fill={c.secondary || "#ffbf00"}
          opacity="0.3"
        />
      </svg>

      {/* تصویر */}
      {banner.imageUrl && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "45%",
            height: "100%",
            backgroundImage: `url(${banner.imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            maskImage: "linear-gradient(to right, black 60%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, black 60%, transparent 100%)",
          }}
        />
      )}

      {/* خط مورب تزئینی */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          right: "35%",
          width: "3px",
          height: "150%",
          background: `linear-gradient(to bottom, transparent, ${c.primary || "#aa4725"}, transparent)`,
          transform: "rotate(-15deg)",
          opacity: 0.6,
        }}
      />

      {/* محتوا */}
      <div
        style={{
          position: "absolute",
          right: "8%",
          top: "50%",
          transform: "translateY(-50%)",
          textAlign: "right",
          width: "55%",
        }}
      >
        {banner.badge && (
          <span
            style={{
              display: "inline-block",
              background: `linear-gradient(135deg, ${c.primary || "#aa4725"}, ${c.secondary || "#ffbf00"})`,
              color: "#fff",
              padding: "0.25em 0.9em",
              borderRadius: "99px",
              fontSize: "0.75em",
              fontWeight: 800,
              marginBottom: "0.6em",
              letterSpacing: "0.05em",
            }}
          >
            {banner.badge}
          </span>
        )}
        {banner.title && (
          <h2
            style={{
              margin: "0 0 0.3em",
              color: c.text || "#fff",
              fontSize: "2em",
              fontWeight: 900,
              lineHeight: 1.15,
              textShadow: `0 2px 20px ${c.primary || "#aa4725"}88`,
            }}
          >
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p
            style={{
              margin: "0 0 1em",
              color: c.textSecondary || "rgba(255,255,255,0.7)",
              fontSize: "0.9em",
              lineHeight: 1.5,
            }}
          >
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            style={{
              background: `linear-gradient(135deg, ${c.primary || "#aa4725"}, ${c.secondary || "#ffbf00"}44)`,
              border: `1.5px solid ${c.primary || "#aa4725"}`,
              color: c.accent || "#fff",
              padding: "0.55em 1.5em",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.9em",
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: `0 4px 20px ${c.primary || "#aa4725"}55`,
              transition: "all 0.2s",
            }}
          >
            {banner.ctaText}
          </button>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE 2: LUXURY — لاکچری، برای کالکشن ویژه
   ===================================================== */
function LuxuryTemplate({ banner, style, onClick, c }) {
  return (
    <div style={{ ...style, background: c.bg || "#0a0a0a" }} onClick={onClick}>
      {/* پس‌زمینه طلایی نویز */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 30% 50%, ${c.secondary || "#ffbf00"}18 0%, transparent 60%)`,
        }}
      />

      {/* خطوط ظریف افقی */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${12 + i * 11}%`,
            height: "1px",
            background: `${c.secondary || "#ffbf00"}15`,
          }}
        />
      ))}

      {/* تصویر با فریم */}
      {banner.imageUrl && (
        <div
          style={{
            position: "absolute",
            left: "5%",
            top: "50%",
            transform: "translateY(-50%)",
            width: "38%",
            aspectRatio: "3/4",
            maxHeight: "85%",
            border: `1px solid ${c.secondary || "#ffbf00"}55`,
            outline: `4px solid ${c.secondary || "#ffbf00"}18`,
            outlineOffset: "6px",
          }}
        >
          <img
            src={banner.imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/* لوگو / عنوان */}
      <div
        style={{
          position: "absolute",
          right: "7%",
          top: "50%",
          transform: "translateY(-50%)",
          textAlign: "right",
          width: banner.imageUrl ? "48%" : "88%",
        }}
      >
        {/* خط طلایی بالا */}
        <div
          style={{
            width: "60px",
            height: "2px",
            background: c.secondary || "#ffbf00",
            marginBottom: "1em",
            marginRight: "auto",
            marginLeft: "0",
          }}
        />

        {banner.badge && (
          <p
            style={{
              margin: "0 0 0.5em",
              color: c.secondary || "#ffbf00",
              fontSize: "0.7em",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {banner.badge}
          </p>
        )}
        {banner.title && (
          <h2
            style={{
              margin: "0 0 0.5em",
              color: c.text || "#fff",
              fontSize: "2.2em",
              fontWeight: 300,
              lineHeight: 1.2,
              letterSpacing: "0.05em",
            }}
          >
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p
            style={{
              margin: "0 0 1.2em",
              color: c.textSecondary || "rgba(255,255,255,0.55)",
              fontSize: "0.85em",
              lineHeight: 1.7,
              fontWeight: 300,
            }}
          >
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            style={{
              background: "transparent",
              border: `1px solid ${c.secondary || "#ffbf00"}`,
              color: c.secondary || "#ffbf00",
              padding: "0.6em 2em",
              fontSize: "0.8em",
              letterSpacing: "0.15em",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
              transition: "all 0.3s",
            }}
          >
            {banner.ctaText}
          </button>
        )}

        {/* خط طلایی پایین */}
        <div
          style={{
            width: "30px",
            height: "2px",
            background: c.secondary || "#ffbf00",
            marginTop: "1.5em",
            marginRight: "auto",
          }}
        />
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE 3: GEOMETRIC — هندسی مدرن، برای محصول جدید
   ===================================================== */
function GeometricTemplate({ banner, style, onClick, c }) {
  return (
    <div style={{ ...style, background: c.bg || "#f5f0eb" }} onClick={onClick}>
      {/* مثلث‌های پس‌زمینه */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
      >
        <polygon
          points="0,300 180,0 360,300"
          fill={c.primary || "#aa4725"}
          opacity="0.08"
        />
        <polygon
          points="50,300 250,50 400,300"
          fill={c.secondary || "#ffbf00"}
          opacity="0.12"
        />
        <polygon
          points="300,0 400,150 280,300"
          fill={c.primary || "#aa4725"}
          opacity="0.1"
        />
        <circle
          cx="350"
          cy="50"
          r="80"
          fill={c.secondary || "#ffbf00"}
          opacity="0.15"
        />
      </svg>

      {/* تصویر دایره‌ای */}
      {banner.imageUrl && (
        <div
          style={{
            position: "absolute",
            left: "6%",
            top: "50%",
            transform: "translateY(-50%)",
            width: "38%",
            paddingBottom: "38%",
            borderRadius: "50%",
            overflow: "hidden",
            border: `4px solid ${c.primary || "#aa4725"}`,
            boxShadow: `0 8px 32px ${c.primary || "#aa4725"}44`,
          }}
        >
          <img
            src={banner.imageUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>
      )}

      {/* محتوا */}
      <div
        style={{
          position: "absolute",
          right: "6%",
          top: "50%",
          transform: "translateY(-50%)",
          width: banner.imageUrl ? "50%" : "88%",
          textAlign: "right",
        }}
      >
        {banner.badge && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: c.primary || "#aa4725",
              color: "#fff",
              padding: "0.3em 1em",
              marginBottom: "0.8em",
              fontSize: "0.72em",
              fontWeight: 700,
              letterSpacing: "0.05em",
              clipPath:
                "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)",
            }}
          >
            {banner.badge}
          </div>
        )}
        {banner.title && (
          <h2
            style={{
              margin: "0 0 0.4em",
              color: c.text || "#0d0d0d",
              fontSize: "2em",
              fontWeight: 900,
              lineHeight: 1.1,
            }}
          >
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p
            style={{
              margin: "0 0 1em",
              color: c.textSecondary || "#555",
              fontSize: "0.88em",
              lineHeight: 1.6,
            }}
          >
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            style={{
              background: c.primary || "#aa4725",
              color: "#fff",
              border: "none",
              padding: "0.6em 1.8em",
              fontSize: "0.88em",
              fontWeight: 700,
              clipPath:
                "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {banner.ctaText}
          </button>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE 4: NEON — نئون سایبرپانک، برای فروش ویژه
   ===================================================== */
function NeonTemplate({ banner, style, onClick, c }) {
  const neonColor = c.secondary || "#ffbf00";
  return (
    <div style={{ ...style, background: c.bg || "#070712" }} onClick={onClick}>
      {/* grid پس‌زمینه */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${neonColor}18 1px, transparent 1px), linear-gradient(90deg, ${neonColor}18 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />

      {/* هاله نئونی */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          top: "50%",
          transform: "translateY(-50%)",
          width: "40%",
          height: "70%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${neonColor}22 0%, transparent 70%)`,
          filter: "blur(20px)",
        }}
      />

      {/* تصویر */}
      {banner.imageUrl && (
        <div
          style={{
            position: "absolute",
            left: "4%",
            top: "50%",
            transform: "translateY(-50%)",
            width: "40%",
            height: "85%",
            backgroundImage: `url(${banner.imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            maskImage:
              "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
            filter: `drop-shadow(0 0 15px ${neonColor}66)`,
          }}
        />
      )}

      {/* محتوا نئونی */}
      <div
        style={{
          position: "absolute",
          right: "6%",
          top: "50%",
          transform: "translateY(-50%)",
          width: banner.imageUrl ? "50%" : "88%",
          textAlign: "right",
        }}
      >
        {banner.badge && (
          <span
            style={{
              display: "inline-block",
              border: `1px solid ${neonColor}`,
              color: neonColor,
              padding: "0.2em 0.8em",
              fontSize: "0.7em",
              letterSpacing: "0.15em",
              marginBottom: "0.7em",
              textTransform: "uppercase",
              boxShadow: `0 0 10px ${neonColor}44, inset 0 0 10px ${neonColor}22`,
            }}
          >
            {banner.badge}
          </span>
        )}
        {banner.title && (
          <h2
            style={{
              margin: "0 0 0.3em",
              color: c.text || "#fff",
              fontSize: "2em",
              fontWeight: 900,
              lineHeight: 1.1,
              textShadow: `0 0 20px ${neonColor}88, 0 0 40px ${neonColor}44`,
            }}
          >
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p
            style={{
              margin: "0 0 1em",
              color: c.textSecondary || "rgba(255,255,255,0.6)",
              fontSize: "0.85em",
              lineHeight: 1.6,
            }}
          >
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            style={{
              background: `linear-gradient(135deg, ${neonColor}22, ${neonColor}44)`,
              border: `1px solid ${neonColor}`,
              color: neonColor,
              padding: "0.55em 1.5em",
              fontSize: "0.85em",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: `0 0 15px ${neonColor}44, inset 0 0 15px ${neonColor}11`,
              letterSpacing: "0.08em",
            }}
          >
            {banner.ctaText}
          </button>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE 5: ORGANIC — طبیعی و آرگانیک، برای محصولات طبیعی
   ===================================================== */
function OrganicTemplate({ banner, style, onClick, c }) {
  return (
    <div style={{ ...style, background: c.bg || "#f9f4ef" }} onClick={onClick}>
      {/* blob‌های پس‌زمینه */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="blur1">
            <feGaussianBlur stdDeviation="20" />
          </filter>
        </defs>
        <ellipse
          cx="80"
          cy="80"
          rx="100"
          ry="80"
          fill={c.primary || "#aa4725"}
          opacity="0.12"
          filter="url(#blur1)"
        />
        <ellipse
          cx="350"
          cy="220"
          rx="120"
          ry="90"
          fill={c.secondary || "#ffbf00"}
          opacity="0.2"
          filter="url(#blur1)"
        />
        <ellipse
          cx="200"
          cy="280"
          rx="150"
          ry="70"
          fill={c.primary || "#aa4725"}
          opacity="0.07"
          filter="url(#blur1)"
        />
      </svg>

      {/* تصویر با کلیپ آرگانیک */}
      {banner.imageUrl && (
        <div
          style={{
            position: "absolute",
            left: "5%",
            top: "8%",
            width: "38%",
            height: "84%",
            borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
            overflow: "hidden",
            border: `3px solid ${c.primary || "#aa4725"}44`,
          }}
        >
          <img
            src={banner.imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/* محتوا */}
      <div
        style={{
          position: "absolute",
          right: "6%",
          top: "50%",
          transform: "translateY(-50%)",
          width: banner.imageUrl ? "50%" : "86%",
          textAlign: "right",
        }}
      >
        {banner.badge && (
          <span
            style={{
              display: "inline-block",
              background: `${c.secondary || "#ffbf00"}33`,
              color: c.primary || "#aa4725",
              padding: "0.3em 1em",
              borderRadius: "99px",
              fontSize: "0.72em",
              fontWeight: 700,
              marginBottom: "0.7em",
              border: `1px solid ${c.primary || "#aa4725"}33`,
            }}
          >
            🌿 {banner.badge}
          </span>
        )}
        {banner.title && (
          <h2
            style={{
              margin: "0 0 0.4em",
              color: c.text || "#2a1a0e",
              fontSize: "1.9em",
              fontWeight: 800,
              lineHeight: 1.25,
            }}
          >
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p
            style={{
              margin: "0 0 1em",
              color: c.textSecondary || "#7a5c44",
              fontSize: "0.87em",
              lineHeight: 1.7,
            }}
          >
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            style={{
              background: c.primary || "#aa4725",
              border: "none",
              color: "#fff",
              padding: "0.6em 1.7em",
              borderRadius: "99px",
              fontSize: "0.87em",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: `0 4px 16px ${c.primary || "#aa4725"}44`,
            }}
          >
            {banner.ctaText} ←
          </button>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE 6: EDITORIAL — مجله‌ای، برای محتوای فصلی
   ===================================================== */
function EditorialTemplate({ banner, style, onClick, c }) {
  return (
    <div style={{ ...style, background: c.bg || "#fafaf8" }} onClick={onClick}>
      {/* نوار رنگی بالا */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "5px",
          background: `linear-gradient(90deg, ${c.primary || "#aa4725"}, ${c.secondary || "#ffbf00"})`,
        }}
      />

      {/* شماره بزرگ تزئینی */}
      <div
        style={{
          position: "absolute",
          left: "-2%",
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "12em",
          fontWeight: 900,
          lineHeight: 1,
          color: c.primary || "#aa4725",
          opacity: 0.06,
          userSelect: "none",
          letterSpacing: "-0.05em",
        }}
      >
        ✦
      </div>

      {/* تصویر ستونی */}
      {banner.imageUrl && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "5px",
            width: "42%",
            bottom: 0,
            backgroundImage: `url(${banner.imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(to right, transparent 70%, ${c.bg || "#fafaf8"})`,
            }}
          />
        </div>
      )}

      {/* محتوا */}
      <div
        style={{
          position: "absolute",
          right: "5%",
          top: "50%",
          transform: "translateY(-50%)",
          width: banner.imageUrl ? "52%" : "88%",
          textAlign: "right",
        }}
      >
        {banner.badge && (
          <p
            style={{
              margin: "0 0 0.6em",
              color: c.primary || "#aa4725",
              fontSize: "0.68em",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            — {banner.badge} —
          </p>
        )}
        {banner.title && (
          <h2
            style={{
              margin: "0 0 0.5em",
              color: c.text || "#0d0d0d",
              fontSize: "2.1em",
              fontWeight: 900,
              lineHeight: 1.15,
              fontStyle: "italic",
            }}
          >
            {banner.title}
          </h2>
        )}
        {/* خط تزئینی */}
        <div
          style={{
            width: "40px",
            height: "2px",
            background: c.primary || "#aa4725",
            margin: "0.8em 0 0.8em auto",
          }}
        />
        {banner.subtitle && (
          <p
            style={{
              margin: "0 0 1.2em",
              color: c.textSecondary || "#666",
              fontSize: "0.85em",
              lineHeight: 1.7,
            }}
          >
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            style={{
              background: "transparent",
              border: `2px solid ${c.primary || "#aa4725"}`,
              color: c.primary || "#aa4725",
              padding: "0.55em 1.6em",
              fontSize: "0.82em",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.05em",
            }}
          >
            {banner.ctaText} →
          </button>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE 7: BRUTALIST — خشن و بولد، برای تخفیف شدید
   ===================================================== */
function BrutalistTemplate({ banner, style, onClick, c }) {
  return (
    <div
      style={{
        ...style,
        background: c.bg || "#fff",
        border: `3px solid ${c.text || "#0d0d0d"}`,
      }}
      onClick={onClick}
    >
      {/* پس‌زمینه هاشور */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(45deg, ${c.primary || "#aa4725"}18 0px, ${c.primary || "#aa4725"}18 1px, transparent 1px, transparent 10px)`,
        }}
      />

      {/* نوار رنگی بزرگ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: "8px",
          background: c.primary || "#aa4725",
        }}
      />

      {/* تصویر با border سیاه */}
      {banner.imageUrl && (
        <div
          style={{
            position: "absolute",
            left: "5%",
            top: "8%",
            width: "38%",
            height: "84%",
            border: `3px solid ${c.text || "#0d0d0d"}`,
            boxShadow: `6px 6px 0 ${c.text || "#0d0d0d"}`,
            overflow: "hidden",
          }}
        >
          <img
            src={banner.imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/* محتوا */}
      <div
        style={{
          position: "absolute",
          right: "5%",
          top: "50%",
          transform: "translateY(-50%)",
          width: banner.imageUrl ? "48%" : "84%",
          textAlign: "right",
        }}
      >
        {banner.badge && (
          <div
            style={{
              display: "inline-block",
              background: c.secondary || "#ffbf00",
              border: `2px solid ${c.text || "#0d0d0d"}`,
              color: c.text || "#0d0d0d",
              padding: "0.2em 0.8em",
              fontSize: "0.75em",
              fontWeight: 900,
              boxShadow: `3px 3px 0 ${c.text || "#0d0d0d"}`,
              marginBottom: "0.6em",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {banner.badge}
          </div>
        )}
        {banner.title && (
          <h2
            style={{
              margin: "0 0 0.3em",
              color: c.text || "#0d0d0d",
              fontSize: "2.2em",
              fontWeight: 900,
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p
            style={{
              margin: "0 0 1em",
              color: c.textSecondary || "#333",
              fontSize: "0.85em",
              lineHeight: 1.5,
              fontWeight: 600,
            }}
          >
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            style={{
              background: c.primary || "#aa4725",
              border: `2px solid ${c.text || "#0d0d0d"}`,
              color: "#fff",
              padding: "0.55em 1.5em",
              fontSize: "0.85em",
              fontWeight: 900,
              cursor: "pointer",
              fontFamily: "inherit",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              boxShadow: `4px 4px 0 ${c.text || "#0d0d0d"}`,
            }}
          >
            {banner.ctaText}
          </button>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE 8: GRADIENT WAVE — موج گرادیانت، مدرن و روشن
   ===================================================== */
function GradientWaveTemplate({ banner, style, onClick, c }) {
  return (
    <div
      style={{
        ...style,
        background: `linear-gradient(135deg, ${c.bg || "#1a0533"} 0%, ${c.primary || "#aa4725"}88 100%)`,
      }}
      onClick={onClick}
    >
      {/* موج SVG */}
      <svg
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "50%",
        }}
        viewBox="0 0 400 150"
        preserveAspectRatio="none"
      >
        <path
          d="M0,80 C80,20 160,120 240,60 S360,100 400,50 L400,150 L0,150 Z"
          fill={`${c.secondary || "#ffbf00"}22`}
        />
        <path
          d="M0,100 C100,40 200,130 300,80 S380,110 400,70 L400,150 L0,150 Z"
          fill={`${c.secondary || "#ffbf00"}15`}
        />
      </svg>

      {/* دایره‌های تزئینی */}
      <div
        style={{
          position: "absolute",
          top: "-30%",
          right: "-10%",
          width: "60%",
          paddingBottom: "60%",
          borderRadius: "50%",
          background: `${c.secondary || "#ffbf00"}18`,
        }}
      />

      {/* تصویر */}
      {banner.imageUrl && (
        <div
          style={{
            position: "absolute",
            left: "4%",
            top: "6%",
            width: "40%",
            height: "88%",
            backgroundImage: `url(${banner.imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderRadius: "12px",
            maskImage: "linear-gradient(to right, black 70%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, black 70%, transparent 100%)",
            boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
          }}
        />
      )}

      {/* محتوا */}
      <div
        style={{
          position: "absolute",
          right: "6%",
          top: "50%",
          transform: "translateY(-50%)",
          width: banner.imageUrl ? "50%" : "88%",
          textAlign: "right",
        }}
      >
        {banner.badge && (
          <span
            style={{
              display: "inline-block",
              background: `${c.secondary || "#ffbf00"}`,
              color: "#000",
              padding: "0.25em 0.9em",
              borderRadius: "99px",
              fontSize: "0.72em",
              fontWeight: 800,
              marginBottom: "0.7em",
            }}
          >
            {banner.badge}
          </span>
        )}
        {banner.title && (
          <h2
            style={{
              margin: "0 0 0.35em",
              color: c.text || "#fff",
              fontSize: "2.1em",
              fontWeight: 800,
              lineHeight: 1.15,
            }}
          >
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p
            style={{
              margin: "0 0 1.1em",
              color: c.textSecondary || "rgba(255,255,255,0.7)",
              fontSize: "0.87em",
              lineHeight: 1.6,
            }}
          >
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            style={{
              background: c.secondary || "#ffbf00",
              border: "none",
              color: "#000",
              padding: "0.6em 1.8em",
              borderRadius: "8px",
              fontSize: "0.87em",
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: `0 4px 20px ${c.secondary || "#ffbf00"}55`,
            }}
          >
            {banner.ctaText}
          </button>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE 9: OVERLAY PHOTO — عکس پس‌زمینه با متن روی آن
   مناسب برای کالکشن‌ها، فصل‌ها، سبک زندگی
   ===================================================== */
function ElegantOverlayTemplate({ banner, style, onClick, c }) {
  const data = {
    badge: banner.badge || "February",
    title: banner.title || "Content Ideas",
    imageUrl: banner.imageUrl,
  };

  return (
    <div
      style={style}
      className={`relative aspect-[9/16] overflow-hidden ${banner.link ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-[1.02]"
        style={{ backgroundImage: `url(${data.imageUrl})` }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40 z-[1]" />

      {/* Cinematic gradient */}
      <div
        className="absolute inset-0 z-[3]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,.24) 0%, rgba(0,0,0,.10) 42%, rgba(0,0,0,.40) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
        {/* Top script text */}
        <h3
          className="
              text-white
              text-[26px]
              md:text-[32px]
              leading-none
              mb-[2px]
              drop-shadow-[0_3px_12px_rgba(0,0,0,.4)]
              select-none
            "
          style={{ fontFamily: '"Heralgliph", cursive' }}
        >
          {data.badge}
        </h3>

        {/* Main title */}
        <h2
          className="
              text-white
              text-[32px]
              md:text-[42px]
              leading-[0.95]
              tracking-[-1px]
              font-light
              max-w-[230px]
              drop-shadow-[0_4px_18px_rgba(0,0,0,.45)]
              select-none
            "
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {data.title}
        </h2>

        {/* Divider */}
        <div className="flex items-center gap-4 w-[170px] opacity-90">
          <div className="flex-1 h-[1px] bg-white/55" />

          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L13.8 10.2L22 12L13.8 13.8L12 22L10.2 13.8L2 12L10.2 10.2L12 2Z"
              fill="white"
            />
          </svg>

          <div className="flex-1 h-[1px] bg-white/55" />
        </div>
      </div>
    </div>
  );
}

// Add this case to BannerRenderer switch:


import { CgBolt } from "react-icons/cg"; // ایمپورت آیکون جدید

export function AdventureShoesTemplate({ banner, style, onClick, c = {} }) {
  const bg = banner?.backgroundUrl || banner?.imageUrl || banner?.image1Url || "";
  const product = banner?.productUrl || banner?.image2Url || "";
  const brush = banner?.brushUrl || banner?.image3Url || "";

  const saleText = banner?.badge || "30%\nOFF";
  const mainTitle = banner?.title || "ADVENTURE";
  const bottomTitle = banner?.subtitle || "SHOES";

  const bgColor = c.bg || "#dcecff";
  const blue = c.primary || "#0f57c9";
  const yellow = c.secondary || "#ffe36a";
  const brown = c.accent || "#7a5538";
  const dark = c.text || "#3f3f3f";

  return (
    <div
      style={{ ...style, backgroundColor: bgColor }}
      onClick={onClick}
      className="relative w-full aspect-[2/1] overflow-hidden select-none"
    >
      {/* بک‌گراند تصویر */}
      {bg && (
        <img
          src={bg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center z-0"
        />
      )}

      {/* خطوط منحنی بک‌گراند */}
      <svg
        viewBox="0 0 2048 1024"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full z-[1] pointer-events-none"
      >
        <defs>
          <linearGradient id="advWave" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#94c7ff" stopOpacity="0.65" />
          </linearGradient>
        </defs>
        <path d="M-80,70 C220,-40 470,30 770,150 C1030,255 1310,230 1610,135 C1810,72 1940,55 2160,95" fill="none" stroke="url(#advWave)" strokeWidth="3" opacity="0.55" />
        <path d="M-60,100 C250,0 500,55 820,175 C1090,274 1370,270 1690,160 C1865,100 1980,92 2140,120" fill="none" stroke="url(#advWave)" strokeWidth="2" opacity="0.35" />
        <path d="M-40,430 C240,320 540,320 820,430 C1120,548 1400,540 1700,420 C1870,352 1985,340 2120,370" fill="none" stroke="url(#advWave)" strokeWidth="2" opacity="0.2" />
      </svg>

      {/* هاله سفید پشت کفش */}
      <div className="absolute left-[1%] top-[38%] w-[18%] h-[36%] rounded-full bg-white/92 z-[1] pointer-events-none" />

      {/* سایه زیر کفش */}
      <div className="absolute left-[11%] top-[90%] w-[36%] h-[10%] rounded-full bg-[#59637c]/22 blur-xl z-10 pointer-events-none" />

      {/* تصویر محصول - چرخش ۴۵ درجه ساعت‌گرد */}
      {product && (
        <img
          src={product}
          alt="Boot"
          className="absolute left-[10%] top-[40%] w-[38%] h-auto rotate-[15deg] drop-shadow-[0_15px_20px_rgba(0,0,0,0.15)] z-30"
        />
      )}

      {/* رعد و برق‌ها — هلالی دور محصول با فاصله ثابت با استفاده از آیکون CgBolt */}
      {[
        { top: "20%", left: "15%", rotate: "-40deg", size: "3.2vw" },
        { top: "20%", left: "10%", rotate: "-60deg", size: "3.5vw" },
        { top: "25%", left: "6%", rotate: "-70deg", size: "4.2vw" },
        { top: "35%", left: "6%", rotate: "-90deg", size: "3.8vw" },
        { top: "45%", left: "7%", rotate: "-110deg", size: "3.3vw" },
      ].map((b, i) => (
        <div
          key={i}
          className="absolute z-30 pointer-events-none"
          style={{ top: b.top, left: b.left, transform: `rotate(${b.rotate})`, color: dark }}
        >
          <CgBolt style={{ width: b.size, height: b.size }} />
        </div>
      ))}

          {/* دایره تخفیف - ۱۰ درصد بزرگتر شده، دایره بدون افکت متنی و فونت کوچک‌تر */}
      <div className="absolute left-[30%] top-[18%] w-[12%] aspect-square rounded-full bg-[#464243] flex items-center justify-center z-40 shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
        <div className="text-white -rotate-[7deg] font-['Cooper_Black',_Georgia,_serif] font-black italic text-center leading-[0.95] text-[1.8vw] whitespace-pre-line">
          {saleText}
        </div>
      </div>

      {/* بک‌گراند براش آبی رنگ - ۴۰ درصد بزرگتر شده */}
      <div className="absolute left-[30%] top-[32%] w-[74%] h-[32%] -rotate-[7deg] origin-left z-20 pointer-events-none">
        {brush ? (
          <img
            src={brush}
            alt=""
            className="w-full h-full object-contain object-center saturate-[1.12] contrast-[1.05]"
          />
        ) : (
          <div
            style={{ backgroundColor: blue }}
            className="w-full h-full [clip-path:polygon(0_18%,96%_0,100%_23%,98%_88%,7%_100%,0_79%)]"
          />
        )}
      </div>

      {/* تیتر اصلی: ADVENTURE - بدون هیچ افکت متنی (Stroke/Shadow) و سایز کوچک‌تر */}
      <div className="absolute left-[46%] top-[35%] -rotate-[7deg] origin-left z-40 pointer-events-none">
        <h2
          style={{ color: yellow }}
          className="m-0 font-['Gagalin',_Impact,_sans-serif] text-[4vw] leading-none tracking-[-0.01em] uppercase"
        >
          {mainTitle}
        </h2>
      </div>

      {/* تیتر فرعی: SHOES - بدون هیچ افکت متنی و سایز کوچک‌تر */}
      <div className="absolute left-[66%] top-[55%] -rotate-[8deg] origin-left z-40 pointer-events-none">
        <h3
          style={{ color: brown }}
          className="m-0 font-['Gagalin',_Impact,_sans-serif] text-[2.8vw] leading-none tracking-[-0.01em] uppercase"
        >
          {bottomTitle}
        </h3>
      </div>
    </div>
  );
}
function Bolt({ className, style, fill = "#3f3f3f" }) {
  return (
    <svg
      viewBox="0 0 60 120"
      aria-hidden="true"
      className={className}
      style={style}
      preserveAspectRatio="xMidYMid meet"
    >
      <polygon
        fill={fill}
        points="38,0 14,52 32,48 10,120 58,44 36,50 52,0"
      />
    </svg>
  );
}