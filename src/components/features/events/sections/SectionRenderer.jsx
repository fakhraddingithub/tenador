import HeroSection from "./HeroSection";
import CountdownSection from "./CountdownSection";
import ProductSliderSection from "./ProductSliderSection";
import FeaturedSection from "./FeaturedSection";
import AnnouncementSection from "./AnnouncementSection";
import RichTextSection from "./RichTextSection";

const sectionMap = {
  hero: HeroSection,
  countdown: CountdownSection,
  "product-slider": ProductSliderSection,
  "featured-products": FeaturedSection,
  announcement: AnnouncementSection,
  richtext: RichTextSection,
};

export default function SectionRenderer({ sections = [], products = [], event }) {
  const visible = sections
    .filter((s) => s.visible !== false)
    .sort((a, b) => a.order - b.order);

  return (
    <>
      {visible.map((section) => {
        const Component = sectionMap[section.type];
        if (!Component) return null;

        return (
          <Component
            key={section.id}
            config={section.config || {}}
            products={products}
            event={event}
          />
        );
      })}
    </>
  );
}
