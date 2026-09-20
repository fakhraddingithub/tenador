import ArticleBlockRenderer from "@/components/features/articles/ArticleBlockRenderer";

/**
 * بروشورِ برند: محتوای بلوکیِ تمام‌صفحه که جای محتوای صفحه‌ی برند را می‌گیرد.
 *
 * فقط *محتوا* عوض می‌شود: آدرس، متادیتا، کانونیکال و داده‌ی ساختاریِ صفحه همان
 * صفحه‌ی برند است و در page.jsx دست‌نخورده می‌ماند. عرض هم همان شبکه‌ی صفحه
 * (max-w-[1440px]) است تا بلوک‌ها با بقیه‌ی سایت هم‌تراز بمانند.
 */
export default function BrandBrochure({ blocks = [], entities, brandName = "", breadcrumbs = null }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  return (
    <main className="bg-white" data-brand-brochure>
      {breadcrumbs}
      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 md:py-8 lg:px-8">
        <h1 className="sr-only">{brandName}</h1>
        <ArticleBlockRenderer blocks={blocks} entities={entities} />
      </div>
    </main>
  );
}
