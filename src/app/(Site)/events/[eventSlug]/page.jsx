import { notFound } from "next/navigation";
import connectToDB from "base/configs/db";
import Event from "base/models/Event";
import { resolveEventProducts } from "base/services/eventProductResolver";
import { getCachedRate } from "@/lib/Exchangerate";
import EventThemeWrapper from "@/components/features/events/EventThemeWrapper";
import EventCountdown from "@/components/features/events/EventCountdown";
import EventCardOverlay from "@/components/features/events/EventCardOverlay";
import SportPageClient from "@/components/templates/sports/SportPageClient";

export const revalidate = 300;

// Resolve the single header image with graceful fallback to the legacy fields so
// old events (which only had heroImage/coverImage) keep rendering correctly.
function resolveHeaderImage(vi = {}) {
  return vi.headerImage || vi.heroImage || vi.coverImage || "";
}

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
  const ogImage = event.social?.ogImage || resolveHeaderImage(event.visualIdentity);

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

  // Resolve + price products server-side (resolver attaches Toman prices), plus
  // the exchange rate for the shared ProductCard's local fallback. Not separately
  // cached — this page is ISR (revalidate = 300) so the whole output is cached.
  const [products, rate] = await Promise.all([
    resolveEventProducts(serialized.productSelection),
    getCachedRate(),
  ]);

  // pageInfo mirrors the Sport page's shape — title + header image + slug.
  const pageInfo = {
    title: serialized.name,
    headImage: resolveHeaderImage(serialized.visualIdentity),
    slug: serialized.slug,
  };

  // Event flair: ribbon/sticker render via the ProductCard `overlay` slot
  // (decoration), while the campaign BADGE renders inside the card's own badge
  // stack (exact discount-badge style) using the admin's text + color.
  const customization = serialized.cardCustomization;
  const cardOverlay = customization ? (
    <EventCardOverlay customization={customization} />
  ) : null;

  const badgeCfg = customization?.badge;
  const campaignBadge =
    badgeCfg?.enabled && badgeCfg?.text
      ? {
          text: badgeCfg.text,
          bgColor: badgeCfg.bgColor,
          textColor: badgeCfg.textColor,
        }
      : null;

  return (
    <EventThemeWrapper theme={serialized.theme}>
      {/*
        The Event page is a THEMED INSTANCE of the Sport slug page — same layout,
        filter sidebar, search bar, product grid and cards. Differences:
        • theme colors come from the event (re-pointed --color-* tokens)
        • series={[]} → no series/limited-edition sliders in/under the header
        • a small countdown sits under the title (headerExtra)
        • the event's full description sits below the header (belowHero)
        • no "back to events" button
      */}
      <SportPageClient
        pageInfo={pageInfo}
        products={products}
        rate={rate}
        series={[]}
        titleOverride={serialized.name}
        cardOverlay={cardOverlay}
        campaignBadge={campaignBadge}
        headerExtra={
          serialized.endDate ? (
            <div className="mt-2 flex justify-center">
              <EventCountdown endDate={serialized.endDate} style="minimal" />
            </div>
          ) : null
        }
        belowHero={
          serialized.description ? (
            <section className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-8">
              {/* Themed, glassy description block sitting on the campaign
                  background — uses the event's heading + body text colors. */}
              <div
                className="rounded-[var(--radius)] border p-6 backdrop-blur-sm"
                style={{
                  background: "color-mix(in srgb, var(--event-primary, #aa4725) 10%, transparent)",
                  borderColor: "color-mix(in srgb, var(--event-primary, #aa4725) 25%, transparent)",
                }}
              >
                {/* Section heading → Title Color (textPrimary / --event-text) */}
                <p
                  className="text-xs font-black mb-2"
                  style={{ color: "var(--event-text, #fff)" }}
                >
                  درباره رویداد
                </p>
                {/* Full description → Body Text Color (textSecondary / --event-text-muted) */}
                <div
                  className="leading-8 whitespace-pre-line"
                  style={{ color: "var(--event-text-muted, rgba(255,255,255,0.65))" }}
                >
                  {serialized.description}
                </div>
              </div>
            </section>
          ) : null
        }
      />
    </EventThemeWrapper>
  );
}
