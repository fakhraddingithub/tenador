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
  const serie = await Serie.findById(serieId).select("+articleBlocks name title slug").lean();
  if (!serie) notFound();

  const blocks = serie.articleBlocks || [];
  const entities = blocks.length ? await resolveArticleEntities({ blocks }) : null;
  const plain = (value) => JSON.parse(JSON.stringify(value ?? null));
  const canEdit = canAccessAdminRoute(ctx?.permissions || [], "/p-admin/admin-brands/[brandId]/[serieId]/mini-article");

  return (
    <MiniArticlePreview
      title={`پیش‌نمایش مینی مقاله سری ${serie.title || serie.name || ""}`}
      note="این محتوا زیر هدرِ صفحه‌ی همین سری دیده می‌شود."
      editHref={canEdit ? `/p-admin/admin-brands/${brandId}/${serieId}/mini-article` : null}
      blocks={plain(blocks)}
      entities={plain(entities)}
      canEdit={canEdit}
      endpoint={{ url: `/api/series/${serieId}/mini-article`, method: "PUT" }}
    />
  );
}
