import { getCompareCategories } from "base/services/compareCategory.service";
import MatchPageClient from "@/components/templates/productMatch/MatchPageClient";
import ToolSeoContent from "@/components/seo/ToolSeoContent";
import { matchableCategories } from "@/lib/matchTools";

export const revalidate = 3600;

export default async function MatchPage() {
  const categories = matchableCategories(await getCompareCategories());

  return (
    <>
      <MatchPageClient categories={categories} />
      <ToolSeoContent type="match" canonicalPath="/match" />
    </>
  );
}
