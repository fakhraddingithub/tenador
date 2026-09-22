import SerieMiniArticleEditor from "@/components/admin/series/SerieMiniArticleEditor";

export const metadata = { title: "مینی مقاله سری | پنل تنادور" };

export default async function SerieMiniArticlePage({ params }) {
  const { brandId, serieId } = await params;
  return <SerieMiniArticleEditor brandId={brandId} serieId={serieId} />;
}
