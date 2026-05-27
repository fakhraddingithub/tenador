"use client";

/**
 * BannerRenderer
 * رندر بنر بر اساس تمپلیت و داده‌های دریافتی با استفاده از Tailwind CSS
 */

export default function BannerRenderer({ banner, preview = false }) {
  if (!banner) return null;

  const c = banner.colors || {};
  const fontSize = preview ? "text-[0.55rem]" : "text-base";

  const wrapperClasses = `w-full h-full relative overflow-hidden ${
    banner.link ? "cursor-pointer" : "cursor-default"
  } ${fontSize}`;

  const handleClick = () => {
    if (!preview && banner.link) window.location.href = banner.link;
  };

  switch (banner.template) {
    case "elegant-overlay":
      return <ElegantOverlayTemplate banner={banner} wrapperClasses={wrapperClasses} onClick={handleClick} c={c} />;
    case "flame":
      return <FlameTemplate banner={banner} wrapperClasses={wrapperClasses} onClick={handleClick} c={c} />;
    case "luxury":
      return <LuxuryTemplate banner={banner} wrapperClasses={wrapperClasses} onClick={handleClick} c={c} />;
    case "geometric":
      return <GeometricTemplate banner={banner} wrapperClasses={wrapperClasses} onClick={handleClick} c={c} />;
    case "neon":
      return <NeonTemplate banner={banner} wrapperClasses={wrapperClasses} onClick={handleClick} c={c} />;
    case "organic":
      return <OrganicTemplate banner={banner} wrapperClasses={wrapperClasses} onClick={handleClick} c={c} />;
    case "editorial":
      return <EditorialTemplate banner={banner} wrapperClasses={wrapperClasses} onClick={handleClick} c={c} />;
    case "brutalist":
      return <BrutalistTemplate banner={banner} wrapperClasses={wrapperClasses} onClick={handleClick} c={c} />;
    case "gradient-wave":
      return <GradientWaveTemplate banner={banner} wrapperClasses={wrapperClasses} onClick={handleClick} c={c} />;
    default:
      return <FlameTemplate banner={banner} wrapperClasses={wrapperClasses} onClick={handleClick} c={c} />;
  }
}


  /* =====================================================
   NEW TEMPLATE: ELEGANT OVERLAY — عمودی، بلور ملایم، سفید
   ===================================================== */
   function ElegantOverlayTemplate({
    banner,
    wrapperClasses,
    onClick,
  }) {
    const data = {
      badge: banner.badge || "February",
      title: banner.title || "Content Ideas",
      imageUrl: banner.imageUrl,
    };
  
    return (
      <div
        className={`
          ${wrapperClasses}
          relative
          aspect-[9/16]
          overflow-hidden
          ${banner.link ? "cursor-pointer" : ""}
        `}
        onClick={onClick}
      >
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center scale-[1.02]"
          style={{
            backgroundImage: `url(${data.imageUrl})`,
          }}
        />
  
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30 z-[1]" />
  
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
            style={{
              fontFamily: '"Heralgliph", cursive',
            }}
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
            style={{
              fontFamily: "'Cormorant Garamond', serif",
            }}
          >
            {data.title}
          </h2>
  
          {/* Divider */}
          <div className="flex items-center gap-4 w-[170px] opacity-90">
            <div className="flex-1 h-[1px] bg-white/55" />
  
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
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
/* =====================================================
   TEMPLATE 1: FLAME
   ===================================================== */
function FlameTemplate({ banner, wrapperClasses, onClick, c }) {
  return (
    <div className={wrapperClasses} style={{ backgroundColor: c.bg || "#0d0d0d" }} onClick={onClick}>
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.18]"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="flameGrad" cx="50%" cy="80%" r="60%">
            <stop offset="0%" stopColor={c.primary || "#aa4725"} stopOpacity="1" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="200" cy="300" rx="200" ry="150" fill="url(#flameGrad)" />
        <ellipse cx="200" cy="280" rx="120" ry="100" fill={c.secondary || "#ffbf00"} opacity="0.3" />
      </svg>

      {banner.imageUrl && (
        <div
          className="absolute left-0 top-0 w-[45%] h-full bg-cover bg-center"
          style={{
            backgroundImage: `url(${banner.imageUrl})`,
            WebkitMaskImage: "linear-gradient(to right, black 60%, transparent 100%)",
            maskImage: "linear-gradient(to right, black 60%, transparent 100%)",
          }}
        />
      )}

      <div
        className="absolute top-[-20%] right-[35%] w-[3px] h-[150%] opacity-60 origin-center -rotate-15"
        style={{ background: `linear-gradient(to bottom, transparent, ${c.primary || "#aa4725"}, transparent)` }}
      />

      <div className="absolute right-[8%] top-1/2 -translate-y-1/2 text-right w-[55%]">
        {banner.badge && (
          <span
            className="inline-block text-white px-3 py-1 rounded-full text-xs font-extrabold mb-2 tracking-wide"
            style={{ background: `linear-gradient(135deg, ${c.primary || "#aa4725"}, ${c.secondary || "#ffbf00"})` }}
          >
            {banner.badge}
          </span>
        )}
        {banner.title && (
          <h2
            className="m-0 mb-1 font-black text-3xl leading-tight"
            style={{ color: c.text || "#fff", textShadow: `0 2px 20px ${c.primary || "#aa4725"}88` }}
          >
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="m-0 mb-4 text-sm leading-relaxed" style={{ color: c.textSecondary || "rgba(255,255,255,0.7)" }}>
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            className="px-6 py-2 rounded-lg font-bold text-sm cursor-pointer transition-all duration-200"
            style={{
              background: `linear-gradient(135deg, ${c.primary || "#aa4725"}, ${c.secondary || "#ffbf00"}44)`,
              border: `1.5px solid ${c.primary || "#aa4725"}`,
              color: c.accent || "#fff",
              boxShadow: `0 4px 20px ${c.primary || "#aa4725"}55`,
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
   TEMPLATE 2: LUXURY
   ===================================================== */
function LuxuryTemplate({ banner, wrapperClasses, onClick, c }) {
  return (
    <div className={wrapperClasses} style={{ backgroundColor: c.bg || "#0a0a0a" }} onClick={onClick}>
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 30% 50%, ${c.secondary || "#ffbf00"}18 0%, transparent 60%)` }}
      />

      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 h-[1px]"
          style={{ top: `${12 + i * 11}%`, backgroundColor: `${c.secondary || "#ffbf00"}15` }}
        />
      ))}

      {banner.imageUrl && (
        <div
          className="absolute left-[5%] top-1/2 -translate-y-1/2 w-[38%] aspect-[3/4] max-h-[85%] border outline outline-4 outline-offset-[6px]"
          style={{
            borderColor: `${c.secondary || "#ffbf00"}55`,
            outlineColor: `${c.secondary || "#ffbf00"}18`,
          }}
        >
          <img src={banner.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div
        className="absolute right-[7%] top-1/2 -translate-y-1/2 text-right"
        style={{ width: banner.imageUrl ? "48%" : "88%" }}
      >
        <div className="w-[60px] h-[2px] mb-4 ml-0 mr-auto" style={{ backgroundColor: c.secondary || "#ffbf00" }} />

        {banner.badge && (
          <p
            className="m-0 mb-2 text-[0.7em] tracking-[0.25em] uppercase font-semibold"
            style={{ color: c.secondary || "#ffbf00" }}
          >
            {banner.badge}
          </p>
        )}
        {banner.title && (
          <h2 className="m-0 mb-2 text-3xl font-light leading-snug tracking-wide" style={{ color: c.text || "#fff" }}>
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="m-0 mb-5 text-sm leading-relaxed font-light" style={{ color: c.textSecondary || "rgba(255,255,255,0.55)" }}>
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            className="bg-transparent px-8 py-2 text-xs tracking-wider cursor-pointer font-semibold transition-all duration-300"
            style={{ border: `1px solid ${c.secondary || "#ffbf00"}`, color: c.secondary || "#ffbf00" }}
          >
            {banner.ctaText}
          </button>
        )}

        <div className="w-[30px] h-[2px] mt-6 ml-0 mr-auto" style={{ backgroundColor: c.secondary || "#ffbf00" }} />
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE 3: GEOMETRIC
   ===================================================== */
function GeometricTemplate({ banner, wrapperClasses, onClick, c }) {
  return (
    <div className={wrapperClasses} style={{ backgroundColor: c.bg || "#f5f0eb" }} onClick={onClick}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <polygon points="0,300 180,0 360,300" fill={c.primary || "#aa4725"} opacity="0.08" />
        <polygon points="50,300 250,50 400,300" fill={c.secondary || "#ffbf00"} opacity="0.12" />
        <polygon points="300,0 400,150 280,300" fill={c.primary || "#aa4725"} opacity="0.1" />
        <circle cx="350" cy="50" r="80" fill={c.secondary || "#ffbf00"} opacity="0.15" />
      </svg>

      {banner.imageUrl && (
        <div
          className="absolute left-[6%] top-1/2 -translate-y-1/2 w-[38%] pb-[38%] rounded-full overflow-hidden border-4"
          style={{ borderColor: c.primary || "#aa4725", boxShadow: `0 8px 32px ${c.primary || "#aa4725"}44` }}
        >
          <img src={banner.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      )}

      <div
        className="absolute right-[6%] top-1/2 -translate-y-1/2 text-right"
        style={{ width: banner.imageUrl ? "50%" : "88%" }}
      >
        {banner.badge && (
          <div
            className="inline-flex items-center gap-1.5 text-white px-4 py-1 mb-3 text-xs font-bold tracking-wide"
            style={{
              backgroundColor: c.primary || "#aa4725",
              clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)",
            }}
          >
            {banner.badge}
          </div>
        )}
        {banner.title && (
          <h2 className="m-0 mb-1 text-3xl font-black leading-tight" style={{ color: c.text || "#0d0d0d" }}>
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="m-0 mb-4 text-sm leading-relaxed" style={{ color: c.textSecondary || "#555" }}>
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            className="text-white border-none px-7 py-2 text-sm font-bold cursor-pointer"
            style={{
              backgroundColor: c.primary || "#aa4725",
              clipPath: "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)",
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
   TEMPLATE 4: NEON
   ===================================================== */
function NeonTemplate({ banner, wrapperClasses, onClick, c }) {
  const neonColor = c.secondary || "#ffbf00";
  return (
    <div className={wrapperClasses} style={{ backgroundColor: c.bg || "#070712" }} onClick={onClick}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${neonColor}18 1px, transparent 1px), linear-gradient(90deg, ${neonColor}18 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />

      <div
        className="absolute left-[10%] top-1/2 -translate-y-1/2 w-[40%] h-[70%] rounded-full blur-[20px]"
        style={{ background: `radial-gradient(ellipse, ${neonColor}22 0%, transparent 70%)` }}
      />

      {banner.imageUrl && (
        <div
          className="absolute left-[4%] top-1/2 -translate-y-1/2 w-[40%] h-[85%] bg-cover bg-center"
          style={{
            backgroundImage: `url(${banner.imageUrl})`,
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
            maskImage: "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
            filter: `drop-shadow(0 0 15px ${neonColor}66)`,
          }}
        />
      )}

      <div
        className="absolute right-[6%] top-1/2 -translate-y-1/2 text-right"
        style={{ width: banner.imageUrl ? "50%" : "88%" }}
      >
        {banner.badge && (
          <span
            className="inline-block px-3 py-1 text-xs tracking-wider mb-3 uppercase border"
            style={{
              borderColor: neonColor,
              color: neonColor,
              boxShadow: `0 0 10px ${neonColor}44, inset 0 0 10px ${neonColor}22`,
            }}
          >
            {banner.badge}
          </span>
        )}
        {banner.title && (
          <h2
            className="m-0 mb-1 text-3xl font-black leading-tight"
            style={{ color: c.text || "#fff", textShadow: `0 0 20px ${neonColor}88, 0 0 40px ${neonColor}44` }}
          >
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="m-0 mb-4 text-sm leading-relaxed" style={{ color: c.textSecondary || "rgba(255,255,255,0.6)" }}>
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            className="px-6 py-2 text-sm font-bold cursor-pointer tracking-wide border"
            style={{
              background: `linear-gradient(135deg, ${neonColor}22, ${neonColor}44)`,
              borderColor: neonColor,
              color: neonColor,
              boxShadow: `0 0 15px ${neonColor}44, inset 0 0 15px ${neonColor}11`,
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
   TEMPLATE 5: ORGANIC
   ===================================================== */
function OrganicTemplate({ banner, wrapperClasses, onClick, c }) {
  return (
    <div className={wrapperClasses} style={{ backgroundColor: c.bg || "#f9f4ef" }} onClick={onClick}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="blur1"><feGaussianBlur stdDeviation="20" /></filter>
        </defs>
        <ellipse cx="80" cy="80" rx="100" ry="80" fill={c.primary || "#aa4725"} opacity="0.12" filter="url(#blur1)" />
        <ellipse cx="350" cy="220" rx="120" ry="90" fill={c.secondary || "#ffbf00"} opacity="0.2" filter="url(#blur1)" />
        <ellipse cx="200" cy="280" rx="150" ry="70" fill={c.primary || "#aa4725"} opacity="0.07" filter="url(#blur1)" />
      </svg>

      {banner.imageUrl && (
        <div
          className="absolute left-[5%] top-[8%] w-[38%] h-[84%] overflow-hidden border-[3px]"
          style={{
            borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
            borderColor: `${c.primary || "#aa4725"}44`,
          }}
        >
          <img src={banner.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div
        className="absolute right-[6%] top-1/2 -translate-y-1/2 text-right"
        style={{ width: banner.imageUrl ? "50%" : "86%" }}
      >
        {banner.badge && (
          <span
            className="inline-block px-4 py-1 rounded-full text-xs font-bold mb-3 border"
            style={{
              backgroundColor: `${c.secondary || "#ffbf00"}33`,
              color: c.primary || "#aa4725",
              borderColor: `${c.primary || "#aa4725"}33`,
            }}
          >
            🌿 {banner.badge}
          </span>
        )}
        {banner.title && (
          <h2 className="m-0 mb-1 text-3xl font-extrabold leading-snug" style={{ color: c.text || "#2a1a0e" }}>
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="m-0 mb-4 text-sm leading-relaxed" style={{ color: c.textSecondary || "#7a5c44" }}>
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            className="border-none text-white px-6 py-2 rounded-full text-sm font-bold cursor-pointer"
            style={{
              backgroundColor: c.primary || "#aa4725",
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
   TEMPLATE 6: EDITORIAL
   ===================================================== */
function EditorialTemplate({ banner, wrapperClasses, onClick, c }) {
  return (
    <div className={wrapperClasses} style={{ backgroundColor: c.bg || "#fafaf8" }} onClick={onClick}>
      <div
        className="absolute top-0 left-0 right-0 h-[5px]"
        style={{ background: `linear-gradient(90deg, ${c.primary || "#aa4725"}, ${c.secondary || "#ffbf00"})` }}
      />

      <div
        className="absolute left-[-2%] top-1/2 -translate-y-1/2 text-[12em] font-black leading-none opacity-[0.06] select-none tracking-tighter"
        style={{ color: c.primary || "#aa4725" }}
      >
        ✦
      </div>

      {banner.imageUrl && (
        <div
          className="absolute left-0 top-[5px] w-[42%] bottom-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${banner.imageUrl})` }}
        >
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to right, transparent 70%, ${c.bg || "#fafaf8"})` }}
          />
        </div>
      )}

      <div
        className="absolute right-[5%] top-1/2 -translate-y-1/2 text-right"
        style={{ width: banner.imageUrl ? "52%" : "88%" }}
      >
        {banner.badge && (
          <p
            className="m-0 mb-2 text-xs font-bold tracking-[0.2em] uppercase"
            style={{ color: c.primary || "#aa4725" }}
          >
            — {banner.badge} —
          </p>
        )}
        {banner.title && (
          <h2
            className="m-0 mb-2 text-[2.1em] font-black leading-tight italic"
            style={{ color: c.text || "#0d0d0d" }}
          >
            {banner.title}
          </h2>
        )}
        <div className="w-[40px] h-[2px] my-3 ml-auto mr-0" style={{ backgroundColor: c.primary || "#aa4725" }} />
        {banner.subtitle && (
          <p className="m-0 mb-5 text-sm leading-relaxed" style={{ color: c.textSecondary || "#666" }}>
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            className="bg-transparent px-6 py-2 text-sm font-bold cursor-pointer tracking-wide border-2"
            style={{ borderColor: c.primary || "#aa4725", color: c.primary || "#aa4725" }}
          >
            {banner.ctaText} →
          </button>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE 7: BRUTALIST
   ===================================================== */
function BrutalistTemplate({ banner, wrapperClasses, onClick, c }) {
  return (
    <div
      className={`${wrapperClasses} border-[3px]`}
      style={{ backgroundColor: c.bg || "#fff", borderColor: c.text || "#0d0d0d" }}
      onClick={onClick}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${c.primary || "#aa4725"}18 0px, ${c.primary || "#aa4725"}18 1px, transparent 1px, transparent 10px)`,
        }}
      />

      <div className="absolute top-0 left-0 bottom-0 w-[8px]" style={{ backgroundColor: c.primary || "#aa4725" }} />

      {banner.imageUrl && (
        <div
          className="absolute left-[5%] top-[8%] w-[38%] h-[84%] border-[3px] overflow-hidden"
          style={{ borderColor: c.text || "#0d0d0d", boxShadow: `6px 6px 0 ${c.text || "#0d0d0d"}` }}
        >
          <img src={banner.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div
        className="absolute right-[5%] top-1/2 -translate-y-1/2 text-right"
        style={{ width: banner.imageUrl ? "48%" : "84%" }}
      >
        {banner.badge && (
          <div
            className="inline-block px-3 py-1 text-xs font-black mb-2 uppercase tracking-widest border-2"
            style={{
              backgroundColor: c.secondary || "#ffbf00",
              borderColor: c.text || "#0d0d0d",
              color: c.text || "#0d0d0d",
              boxShadow: `3px 3px 0 ${c.text || "#0d0d0d"}`,
            }}
          >
            {banner.badge}
          </div>
        )}
        {banner.title && (
          <h2 className="m-0 mb-1 text-[2.2em] font-black leading-none uppercase" style={{ color: c.text || "#0d0d0d" }}>
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="m-0 mb-4 text-sm leading-relaxed font-semibold" style={{ color: c.textSecondary || "#333" }}>
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            className="text-white px-6 py-2 text-sm font-black cursor-pointer uppercase tracking-wide border-2"
            style={{
              backgroundColor: c.primary || "#aa4725",
              borderColor: c.text || "#0d0d0d",
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
   TEMPLATE 8: GRADIENT WAVE
   ===================================================== */
function GradientWaveTemplate({ banner, wrapperClasses, onClick, c }) {
  return (
    <div
      className={wrapperClasses}
      style={{ background: `linear-gradient(135deg, ${c.bg || "#1a0533"} 0%, ${c.primary || "#aa4725"}88 100%)` }}
      onClick={onClick}
    >
      <svg className="absolute bottom-0 left-0 w-full h-1/2" viewBox="0 0 400 150" preserveAspectRatio="none">
        <path d="M0,80 C80,20 160,120 240,60 S360,100 400,50 L400,150 L0,150 Z" fill={`${c.secondary || "#ffbf00"}22`} />
        <path d="M0,100 C100,40 200,130 300,80 S380,110 400,70 L400,150 L0,150 Z" fill={`${c.secondary || "#ffbf00"}15`} />
      </svg>

      <div
        className="absolute top-[-30%] right-[-10%] w-[60%] pb-[60%] rounded-full"
        style={{ backgroundColor: `${c.secondary || "#ffbf00"}18` }}
      />

      {banner.imageUrl && (
        <div
          className="absolute left-[4%] top-[6%] w-[40%] h-[88%] bg-cover bg-center rounded-xl shadow-2xl"
          style={{
            backgroundImage: `url(${banner.imageUrl})`,
            WebkitMaskImage: "linear-gradient(to right, black 70%, transparent 100%)",
            maskImage: "linear-gradient(to right, black 70%, transparent 100%)",
          }}
        />
      )}

      <div
        className="absolute right-[6%] top-1/2 -translate-y-1/2 text-right"
        style={{ width: banner.imageUrl ? "50%" : "88%" }}
      >
        {banner.badge && (
          <span
            className="inline-block text-black px-3 py-1 rounded-full text-xs font-extrabold mb-3"
            style={{ backgroundColor: c.secondary || "#ffbf00" }}
          >
            {banner.badge}
          </span>
        )}
        {banner.title && (
          <h2 className="m-0 mb-1.5 text-[2.1em] font-extrabold leading-tight" style={{ color: c.text || "#fff" }}>
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="m-0 mb-4 text-sm leading-relaxed" style={{ color: c.textSecondary || "rgba(255,255,255,0.7)" }}>
            {banner.subtitle}
          </p>
        )}
        {banner.ctaText && (
          <button
            className="border-none text-black px-7 py-2 rounded-lg text-sm font-extrabold cursor-pointer"
            style={{
              backgroundColor: c.secondary || "#ffbf00",
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