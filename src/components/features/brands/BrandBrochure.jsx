import ArticleBlockRenderer, { ArticleHeaderBlock } from "@/components/features/articles/ArticleBlockRenderer";
import { splitHeaderBlock } from "@/lib/articleBlockTypes";

/**
 * بروشورِ برند: محتوای بلوکیِ تمام‌صفحه که جای محتوای صفحه‌ی برند را می‌گیرد.
 *
 * فقط *محتوا* عوض می‌شود: آدرس، متادیتا، کانونیکال و داده‌ی ساختاریِ صفحه همان
 * صفحه‌ی برند است و در page.jsx دست‌نخورده می‌ماند. عرض هم همان شبکه‌ی صفحه
 * (max-w-[1440px]) است تا بلوک‌ها با بقیه‌ی سایت هم‌تراز بمانند.
 */
export default function BrandBrochure({ blocks = [], entities, brandName = "", breadcrumbs = null }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  // همان ترتیبِ صفحه‌ی مقاله: هدرِ تمام‌عرض بالای بردکرامب، بیرونِ ظرفِ محتوا.
  const { header, blocks: body } = splitHeaderBlock(blocks);

  return (
    <main className="bg-white" data-brand-brochure>
      {header ? <ArticleHeaderBlock block={header} /> : null}
      {breadcrumbs}
      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 md:py-8 lg:px-8">
        <h1 className="sr-only">{brandName}</h1>
        <ArticleBlockRenderer blocks={body} entities={entities} />
      </div>
    </main>
  );
}
