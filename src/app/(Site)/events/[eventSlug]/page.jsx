import { notFound } from "next/navigation";
import connectToDB from "base/configs/db";
import Event from "base/models/Event";
import { resolveEventProducts } from "base/services/eventProductResolver";
import EventThemeWrapper from "@/components/features/events/EventThemeWrapper";
import SectionRenderer from "@/components/features/events/sections/SectionRenderer";
import EventEffects from "@/components/features/events/EventEffects";
import Link from "next/link";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { eventSlug } = await params;
  await connectToDB();
  const event = await Event.findOne({
    slug: eventSlug,
    status: "active",
  })
    .select("name shortDescription seo social visualIdentity")
    .lean();

  if (!event) return {};

  const title = event.seo?.title || event.name;
  const description = event.seo?.description || event.shortDescription || "";
  const ogImage =
    event.social?.ogImage || event.visualIdentity?.coverImage || "";

  return {
    title: `${title} | تنادور`,
    description,
    openGraph: {
      title: event.social?.ogTitle || title,
      description: event.social?.ogDescription || description,
      images: ogImage ? [ogImage] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: event.social?.twitterTitle || title,
      description: event.social?.twitterDescription || description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function EventPage({ params }) {
  const { eventSlug } = await params;
  await connectToDB();

  const event = await Event.findOne({
    slug: eventSlug,
    status: "active",
  }).lean();

  if (!event) notFound();

  const serialized = JSON.parse(JSON.stringify(event));

  // Resolve + price products server-side. Not separately cached: this page is
  // ISR (revalidate = 300), so the whole output is cached and the resolver only
  // re-runs on revalidation.
  const products = await resolveEventProducts(serialized.productSelection);

  // If no sections configured, inject sensible defaults
  const sections =
    serialized.pageSections?.length > 0
      ? serialized.pageSections
      : buildDefaultSections(serialized);

  return (
    <EventThemeWrapper theme={serialized.theme}>
      {/* Ambient effects (client-only, lazy) */}
      <EventEffects effect={serialized.theme?.effect} />

      {/* Back nav — inherits event colors */}
      <div
        className="fixed top-4 right-4 z-50"
        style={{ direction: "rtl" }}
      >
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full backdrop-blur-sm transition-all hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{
            background: "rgba(0,0,0,0.5)",
            color: "var(--event-text, #fff)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          aria-label="بازگشت به رویدادها"
        >
          <span aria-hidden="true">←</span> رویدادها
        </Link>
      </div>

      {/* Page sections */}
      <SectionRenderer
        sections={sections}
        products={products}
        event={serialized}
      />

      {/* Footer strip */}
      <div
        className="py-8 px-6 text-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <p
          className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30"
          style={{ color: "var(--event-text, #fff)" }}
        >
          Tenador × {serialized.name}
        </p>
      </div>
    </EventThemeWrapper>
  );
}

/**
 * Builds a minimal default section list when the admin hasn't configured sections yet.
 * This ensures the page is never blank.
 */
function buildDefaultSections(event) {
  const sections = [];
  let order = 0;

  // Hero
  sections.push({
    id: "default-hero",
    type: "hero",
    order: order++,
    visible: true,
    config: {
      title: event.name,
      subtitle: event.shortDescription || "",
      ctaText: "مشاهده محصولات",
      ctaHref: "#event-products",
      height: "large",
      backgroundType: "image",
    },
  });

  // Countdown (if event has an end date)
  if (event.endDate) {
    sections.push({
      id: "default-countdown",
      type: "countdown",
      order: order++,
      visible: true,
      config: {
        title: "زمان باقی‌مانده تا پایان رویداد",
        endDate: event.endDate,
        style: "cards",
      },
    });
  }

  // Product slider
  sections.push({
    id: "default-products",
    type: "product-slider",
    order: order++,
    visible: true,
    config: { title: "محصولات ویژه رویداد", limit: 20 },
  });

  return sections;
}
