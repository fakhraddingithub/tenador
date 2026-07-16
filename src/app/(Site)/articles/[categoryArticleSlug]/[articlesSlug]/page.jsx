import { notFound, permanentRedirect } from "next/navigation";
import { getPublicArticle } from "base/services/publicArticle.service";
import { decodeSlugParam } from "base/utils/articleSlug";
import PublicArticlePage from "@/components/features/articles/PublicArticlePage";
import { articleMetadata } from "@/lib/articleSeo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { categoryArticleSlug, articlesSlug } = await params;
  const result = await getPublicArticle(decodeSlugParam(categoryArticleSlug), decodeSlugParam(articlesSlug));

  if (result?.kind === "article") {
    return articleMetadata(result.article);
  }

  return {
    title: "\u0645\u0642\u0627\u0644\u0647 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f",
    robots: { index: false, follow: false },
  };
}

export default async function ArticlePage({ params }) {
  const { categoryArticleSlug, articlesSlug } = await params;
  const result = await getPublicArticle(decodeSlugParam(categoryArticleSlug), decodeSlugParam(articlesSlug));

  if (result?.kind === "redirect") {
    permanentRedirect(result.location);
  }

  if (result?.kind !== "article") {
    notFound();
  }

  return (
    <PublicArticlePage
      article={result.article}
      relatedArticles={result.relatedArticles}
      entities={result.entities}
    />
  );
}
