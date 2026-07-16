import { notFound, permanentRedirect } from "next/navigation";
import { getPublicArticleCategory } from "base/services/publicArticle.service";
import { decodeSlugParam, normalizeArticleSlug } from "base/utils/articleSlug";

export const dynamic = "force-dynamic";

// صفحهٔ دستهٔ مقالات در ریشهٔ سایت است (/[categorySlug])؛ این مسیرِ میانی
// (/articles/[categorySlug]) فقط برای این وجود دارد که کوتاه‌کردنِ URL مقاله
// توسط کاربر یا خزنده به 404 نخورد و به آدرسِ کانونیکال ریدایرکت شود.
export default async function ArticleCategoryRedirect({ params }) {
  const { categoryArticleSlug } = await params;
  const slug = normalizeArticleSlug(decodeSlugParam(categoryArticleSlug));
  const category = await getPublicArticleCategory(slug);
  if (!category) notFound();
  permanentRedirect(`/${encodeURIComponent(slug)}`);
}
