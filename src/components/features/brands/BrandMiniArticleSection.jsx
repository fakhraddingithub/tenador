import ArticleBlockRenderer from "@/components/features/articles/ArticleBlockRenderer";

// Shared by the brand, brand+category and serie pages. The inner container
// matches the product grid below it (max-w-[1440px] px-4 lg:px-8) so the article
// lines up with the rest of the page instead of sitting in a narrow column.
export default function BrandMiniArticleSection({ blocks = [], entities, brandName = "", label }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  return (
    <section
      aria-label={label || (brandName ? `درباره برند ${brandName}` : "درباره برند")}
      className="border-b border-gray-100 bg-white"
      data-brand-mini-article
    >
      <div className="mx-auto w-full max-w-[1440px] px-4 py-3 md:py-5 lg:px-8">
        <ArticleBlockRenderer blocks={blocks} entities={entities} />
      </div>
    </section>
  );
}
