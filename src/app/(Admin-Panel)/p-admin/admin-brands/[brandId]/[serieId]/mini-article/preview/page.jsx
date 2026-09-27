import { notFound } from "next/navigation";
import connectToDB from "base/configs/db";
import Serie from "base/models/Serie";
import { getAdminContext } from "@/lib/adminContext";
import { canAccessAdminRoute } from "@/lib/permissions";
import { resolveArticleEntities } from "base/services/publicArticle.service";
import MiniArticlePreview from "@/components/admin/articles/MiniArticlePreview";

export const metadata = { title: "پیش‌نمایش مینی مقاله سری | پنل تنادور" };

export default async function SerieMiniArticlePreviewPage({ params }) {
  const ctx = await getAdminContext();
  if (!ctx?.can("series.view")) notFound();
  const { brandId, serieId } = await params;

  await connectToDB();
  const serie = await Serie.findById(serieId).select("+articleBlocks +articleBlocksBottom name title slug").lean();
  if (!serie) notFound();

  const blocks = serie.articleBlocks || [];
  const blocksBottom = serie.articleBlocksBottom || [];
  const [entities, entitiesBottom] = await Promise.all([
    blocks.length ? resolveArticleEntities({ blocks }) : null,
    blocksBottom.length ? resolveArticleEntities({ blocks: blocksBottom }) : null,
  ]);
  const plain = (value) => JSON.parse(JSON.stringify(value ?? null));
  const canEdit = canAccessAdminRoute(ctx?.permissions || [], "/p-admin/admin-brands/[brandId]/[serieId]/mini-article");

  return (
    <MiniArticlePreview
      title={`پیش‌نمایش مینی مقاله سری ${serie.title || serie.name || ""}`}
      note="بالا و پایینِ صفحه‌ی همین سری، به همان ترتیبی که روی سایت دیده می‌شود."
      editHref={canEdit ? `/p-admin/admin-brands/${brandId}/${serieId}/mini-article` : null}
      canEdit={canEdit}
      sections={[
        { key: "blocks", label: "مینی‌مقاله بالای صفحه", blocks: plain(blocks), entities: plain(entities), endpoint: { url: `/api/series/${serieId}/mini-article`, method: "PUT", key: "blocks" } },
        { key: "blocksBottom", label: "مینی‌مقاله پایین صفحه", blocks: plain(blocksBottom), entities: plain(entitiesBottom), endpoint: { url: `/api/series/${serieId}/mini-article`, method: "PUT", key: "blocksBottom" } },
      ]}
    />
  );
}
