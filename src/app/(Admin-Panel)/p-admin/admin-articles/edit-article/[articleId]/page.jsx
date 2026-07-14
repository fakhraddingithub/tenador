export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function LegacyEditArticlePage({ params }) {
  const { articleId } = await params;
  redirect(`/p-admin/admin-articles/${articleId}`);
}
