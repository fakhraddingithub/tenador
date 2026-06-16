import ProductList from "@/components/templates/products/ProductList";
import EventCardOverlay from "../EventCardOverlay";

/**
 * Event products are rendered with the SAME ProductList/ProductCard the Sport
 * page uses — only themed (via the --color-* overrides on .event-page) and
 * decorated with the event's optional ribbon/sticker/badge through the card's
 * `overlay` slot. No bespoke event card or slider is used here.
 */
export default function ProductSliderSection({ config = {}, products = [], event }) {
  const { title = "محصولات رویداد", limit } = config;
  const visible = limit ? products.slice(0, limit) : products;

  if (!visible.length) return null;

  const customization = event?.cardCustomization;
  const cardOverlay = customization ? (
    <EventCardOverlay customization={customization} />
  ) : null;

  return (
    <section className="py-12 px-6" id="event-products">
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
