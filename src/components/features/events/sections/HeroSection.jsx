import Image from "next/image";
import Link from "next/link";

export default function HeroSection({ config = {}, event }) {
  const {
    title,
    subtitle,
    description,
    ctaText = "مشاهده محصولات",
    ctaHref = "#event-products",
    backgroundType = "image",
    textAlign = "center",
    height = "large",
  } = config;

  const heroImage =
    config.backgroundImage ||
    event?.visualIdentity?.heroImage ||
    event?.visualIdentity?.coverImage;

  const gradientBg =
    config.gradient || event?.theme?.gradient ||
    `linear-gradient(135deg, ${event?.theme?.backgroundColor || "#0d0d0d"} 0%, ${event?.theme?.primaryColor || "#aa4725"}66 100%)`;

  const heights = {
    full: "min-h-screen",
    large: "min-h-[70vh]",
    medium: "min-h-[50vh]",
    small: "min-h-[35vh]",
  };

  return (
    <section
      className={`relative ${heights[height] || heights.large} flex items-center overflow-hidden`}
      aria-label={`هدر رویداد ${event?.name || ""}`}
    >
      {/* Background */}
      {heroImage && backgroundType !== "gradient" ? (
        <Image
          src={heroImage}
          alt=""
          fill
          className="object-cover"
          priority
          sizes="100vw"
          aria-hidden="true"
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            backgroundType === "gradient" || !heroImage
              ? gradientBg
              : `linear-gradient(to bottom, transparent 30%, ${event?.theme?.backgroundColor || "#0d0d0d"}ee 100%)`,
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        className={`relative z-10 w-full max-w-5xl mx-auto px-6 py-16 ${
          textAlign === "right" ? "text-right" : textAlign === "left" ? "text-left" : "text-center"
        }`}
      >
        {/* Eyebrow */}
        {config.eyebrow && (
          <p
            className="text-xs font-black uppercase tracking-[0.3em] mb-4 opacity-70"
            style={{ color: "var(--event-secondary, #ffbf00)" }}
          >
            {config.eyebrow}
          </p>
        )}

        {/* Title */}
        {title && (
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight mb-4"
            style={{
              color: "var(--event-text, #fff)",
              fontFamily: "var(--event-heading-font, Vazirmatn)",
              textShadow: "0 4px 24px rgba(0,0,0,0.4)",
            }}
          >
            {title}
          </h1>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p
            className="text-xl md:text-3xl font-bold mb-3"
            style={{
              color: "var(--event-primary, #aa4725)",
              fontFamily: "var(--event-heading-font, Vazirmatn)",
            }}
          >
            {subtitle}
          </p>
        )}

        {/* Description */}
        {description && (
          <p
            className="text-sm md:text-base max-w-2xl mx-auto leading-8 mb-8 opacity-75"
            style={{ color: "var(--event-text, #fff)" }}
          >
            {description}
          </p>
        )}

        {/* CTA */}
        {ctaText && (
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-black text-sm transition-all duration-300 hover:scale-105 hover:shadow-xl"
            style={{
              background: "var(--event-primary, #aa4725)",
              color: "#fff",
              boxShadow: `0 8px 32px var(--event-primary, #aa4725)44`,
            }}
          >
            {ctaText}
          </Link>
        )}
      </div>
    </section>
  );
}
