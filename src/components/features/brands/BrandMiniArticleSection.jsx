import ArticleBlockRenderer from "@/components/features/articles/ArticleBlockRenderer";

export default function BrandMiniArticleSection({ blocks = [], entities, brandName = "" }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  return (
    <section
      aria-label={brandName ? `درباره برند ${brandName}` : "درباره برند"}
      className="border-b border-gray-100 bg-white"
      data-brand-mini-article
    >
      <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 md:py-5 lg:px-8">
        <ArticleBlockRenderer blocks={blocks} entities={entities} />
      </div>
    </section>
  );
}
