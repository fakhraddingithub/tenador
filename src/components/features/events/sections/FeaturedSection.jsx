import ProductList from "@/components/templates/products/ProductList";
import EventCardOverlay from "../EventCardOverlay";

/**
 * Featured products reuse the shared ProductList/ProductCard (same as the Sport
 * page). Theming flows through the --color-* overrides on .event-page and the
 * event's optional flair is injected via the card's `overlay` slot.
 */
export default function FeaturedSection({ config = {}, products = [], event }) {
  const { title = "محصولات ویژه", limit = 8 } = config;
  const visible = products.slice(0, limit);

  if (!visible.length) return null;

  const customization = event?.cardCustomization;
  const cardOverlay = customization ? (
    <EventCardOverlay customization={customization} />
  ) : null;

  return (
    <section className="py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {title && (
          <h2
            className="text-xl font-black mb-6 flex items-center gap-3"
            style={{
              color: "var(--event-text, #fff)",
              fontFamily: "var(--event-heading-font, Vazirmatn)",
            }}
          >
            <span
              className="w-1 h-6 rounded-full inline-block shrink-0"
              style={{ background: "var(--event-primary, #aa4725)" }}
              aria-hidden="true"
            />
            {title}
          </h2>
        )}

        <ProductList products={visible} cardOverlay={cardOverlay} />
      </div>
    </section>
  );
}
