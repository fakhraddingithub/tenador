import { getLegacyArticleTarget } from "base/services/publicArticle.service";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { articleId } = await params;
  const target = await getLegacyArticleTarget(articleId);

  if (!target) {
    return new Response("Not Found", { status: 404 });
  }

  return Response.redirect(new URL(target, request.url), 301);
}
