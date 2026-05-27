/* =====================================================
   TEMPLATE: PRODUCT SHOWCASE
   یه عکس پس‌زمینه + یه عکس محصول روی آن
   مناسب برای معرفی محصول جدید، کالکشن ویژه
   ===================================================== */

export function ProductShowcaseTemplate({ banner, wrapperClasses, onClick, c }) {
  return (
    <div
      className={`${wrapperClasses} font-[Vazirmatn,sans-serif]`}
      style={{ backgroundColor: c.bg || "#0d0d0d" }}
      onClick={onClick}
    >
      {/* ─── لایه ۱: عکس پس‌زمینه ─── */}
      {banner.imageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${banner.imageUrl})`,
            filter: `brightness(${c.brightness || "0.55"}) saturate(${c.saturation || "0.9"})`,
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${c.bg || "#0d0d0d"} 0%, ${c.primary || "#aa4725"}44 100%)`,
          }}
        />
      )}

      {/* ─── لایه ۲: گرادیان روی پس‌زمینه ─── */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to left, ${c.bg || "#0d0d0d"}ee 35%, ${c.bg || "#0d0d0d"}88 60%, transparent 100%)`,
        }}
      />
      {/* گرادیان پایین */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, ${c.bg || "#0d0d0d"}cc 0%, transparent 50%)`,
        }}
      />

      {/* ─── لایه ۳: عکس محصول ─── */}
      {banner.image2Url && (
        <div className="absolute left-[3%] bottom-0 h-[95%] flex items-end justify-center" style={{ width: "44%" }}>
          <img
            src={banner.image2Url}
            alt={banner.title || "product"}
            className="h-full w-full object-contain object-bottom"
            style={{
              filter: `drop-shadow(0 8px 40px ${c.primary || "#aa4725"}66) drop-shadow(0 0 80px ${c.primary || "#aa4725"}33)`,
            }}
          />
        </div>
      )}

      {/* ─── لایه ۴: نوار رنگی عمودی کنار محصول ─── */}
      <div
        className="absolute bottom-0 top-0"
        style={{
          left: banner.image2Url ? "46%" : "0",
          width: "3px",
          background: `linear-gradient(to bottom, transparent, ${c.primary || "#aa4725"}, transparent)`,
          opacity: 0.6,
        }}
      />

      {/* ─── لایه ۵: محتوای متنی ─── */}
      <div
        className="absolute top-1/2 -translate-y-1/2 text-right flex flex-col gap-2"
        style={{ right: "5%", width: banner.image2Url ? "48%" : "88%" }}
      >
        {/* بج */}
        {banner.badge && (
          <span
            className="inline-block self-end text-white text-xs font-black px-3 py-1 rounded-full tracking-wide mb-1"
            style={{
              background: `linear-gradient(135deg, ${c.primary || "#aa4725"}, ${c.secondary || "#ffbf00"})`,
              boxShadow: `0 2px 12px ${c.primary || "#aa4725"}55`,
            }}
          >
            {banner.badge}
          </span>
        )}

        {/* عنوان */}
        {banner.title && (
          <h2
            className="m-0 font-black leading-tight text-right"
            style={{
              fontSize: "clamp(1.4rem, 3vw, 2.4rem)",
              color: c.text || "#fff",
              textShadow: `0 2px 24px ${c.primary || "#aa4725"}66`,
            }}
          >
            {banner.title}
          </h2>
        )}

        {/* خط تزئینی */}
        {banner.title && (
          <div className="flex items-center gap-2 justify-end">
            <div className="h-[1px] w-8" style={{ background: `${c.secondary || "#ffbf00"}` }} />
            <div className="h-[1px] w-16" style={{ background: `${c.primary || "#aa4725"}88` }} />
          </div>
        )}

        {/* زیرعنوان */}
        {banner.subtitle && (
          <p
            className="m-0 text-sm leading-relaxed text-right"
            style={{ color: c.textSecondary || "rgba(255,255,255,0.7)" }}
          >
            {banner.subtitle}
          </p>
        )}

        {/* دکمه */}
        {banner.ctaText && (
          <button
            className="self-end mt-2 px-6 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all duration-200"
            style={{
              background: `linear-gradient(135deg, ${c.primary || "#aa4725"}, ${c.secondary || "#ffbf00"}88)`,
              border: `1.5px solid ${c.primary || "#aa4725"}`,
              color: c.accent || "#fff",
              boxShadow: `0 4px 20px ${c.primary || "#aa4725"}44`,
            }}
          >
            {banner.ctaText} ←
          </button>
        )}
      </div>

      {/* ─── لایه ۶: لوگو / برچسب گوشه ─── */}
      {banner.subtitle2 && (
        <div
          className="absolute top-4 right-4 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded"
          style={{
            color: c.secondary || "#ffbf00",
            border: `1px solid ${c.secondary || "#ffbf00"}55`,
            background: `${c.secondary || "#ffbf00"}11`,
          }}
        >
          {banner.subtitle2}
        </div>
      )}
    </div>
  );
}
