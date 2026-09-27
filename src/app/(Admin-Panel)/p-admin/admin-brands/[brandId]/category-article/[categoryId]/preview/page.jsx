import { notFound } from "next/navigation";
import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import Category from "base/models/Category";
import { getAdminContext } from "@/lib/adminContext";
import { canAccessAdminRoute } from "@/lib/permissions";
import { resolveArticleEntities } from "base/services/publicArticle.service";
import MiniArticlePreview from "@/components/admin/articles/MiniArticlePreview";

export const metadata = { title: "پیش‌نمایش مینی مقاله دسته | پنل تنادور" };

export default async function BrandCategoryArticlePreviewPage({ params }) {
  const ctx = await getAdminContext();
  if (!ctx?.can("brands.view")) notFound();
  const { brandId, categoryId } = await params;

  await connectToDB();
  const [brand, category] = await Promise.all([
    Brand.findById(brandId).select("+categoryArticles name title slug").lean(),
    Category.findById(categoryId).select("name title slug sport").populate("sport", "slug").lean(),
  ]);
  if (!brand || !category) notFound();

  const entry = (brand.categoryArticles || []).find((item) => String(item?.category) === String(categoryId));
  const blocks = entry?.blocks || [];
  const blocksBottom = entry?.blocksBottom || [];
  const [entities, entitiesBottom] = await Promise.all([
    blocks.length ? resolveArticleEntities({ blocks }) : null,
    blocksBottom.length ? resolveArticleEntities({ blocks: blocksBottom }) : null,
  ]);
  const plain = (value) => JSON.parse(JSON.stringify(value ?? null));
  const canEdit = canAccessAdminRoute(ctx?.permissions || [], "/p-admin/admin-brands/[brandId]/category-article/[categoryId]");
  // صفحه‌ی عمومیِ این محتوا: /[sport]/[category]/[brand]
  const live = category.sport?.slug && category.slug && brand.slug ? `/${category.sport.slug}/${category.slug}/${brand.slug}` : null;

  return (
    <MiniArticlePreview
      title={`پیش‌نمایش مینی مقاله ${brand.title || brand.name} — ${category.title || category.name}`}
      note="بالا و پایینِ صفحه‌ی همین برند در همین دسته، به همان ترتیبِ سایت."
      editHref={canEdit ? `/p-admin/admin-brands/${brandId}/category-article/${categoryId}` : null}
      liveHref={live}
      canEdit={canEdit}
      sections={[
        { key: "blocks", label: "مینی‌مقاله بالای صفحه", blocks: plain(blocks), entities: plain(entities), endpoint: { url: `/api/brands/${brandId}/category-article/${categoryId}`, method: "PUT", key: "blocks" } },
        { key: "blocksBottom", label: "مینی‌مقاله پایین صفحه", blocks: plain(blocksBottom), entities: plain(entitiesBottom), endpoint: { url: `/api/brands/${brandId}/category-article/${categoryId}`, method: "PUT", key: "blocksBottom" } },
      ]}
    />
  );
}
