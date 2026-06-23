/**
 * SectionRenderer — هر بلوکِ محتوایی را به کامپوننتِ متناظرش نگاشت می‌کند.
 * سرور-کامپوننت است؛ بخش‌های تعاملی (faq/legal/contact) جزایرِ کلاینت هستند.
 */
import PageHero from "./PageHero";
import {
  RichText,
  ImageText,
  Cards,
  Timeline,
  Steps,
  TableSection,
  Quote,
  PaymentMethods,
} from "./sections";
import FaqSection from "./FaqSection";
import LegalSection from "./LegalSection";
import ContactSection from "./ContactSection";

export default function SectionRenderer({
  sections = [],
  accent = "#aa4725",
  enableLightbox = false,
}) {
  return (
    <>
      {sections.map((block, i) => {
        const key = block.id || `${block.type}-${i}`;
        switch (block.type) {
          case "hero":
            return (
              <PageHero
                key={key}
                eyebrow={block.eyebrow}
                title={block.title}
                subtitle={block.subtitle}
                image={block.image}
                align={block.align}
                accent={accent}
              />
            );
          case "richtext":
            return <RichText key={key} block={block} accent={accent} />;
          case "image-text":
            return (
              <ImageText
                key={key}
                block={block}
                accent={accent}
                zoom={enableLightbox}
              />
            );
          case "cards":
            return <Cards key={key} block={block} accent={accent} />;
          case "timeline":
            return <Timeline key={key} block={block} accent={accent} />;
          case "steps":
            return (
              <Steps
                key={key}
                block={block}
                accent={accent}
                zoom={enableLightbox}
              />
            );
          case "table":
            return <TableSection key={key} block={block} accent={accent} />;
          case "quote":
            return <Quote key={key} block={block} accent={accent} />;
          case "payment-methods":
            return <PaymentMethods key={key} block={block} accent={accent} />;
          case "faq":
            return <FaqSection key={key} block={block} accent={accent} />;
          case "legal":
            return <LegalSection key={key} block={block} accent={accent} />;
          case "contact":
            return <ContactSection key={key} block={block} accent={accent} />;
          default:
            return null;
        }
      })}
    </>
  );
}
