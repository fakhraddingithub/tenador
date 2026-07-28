import { getCompareCategories } from "base/services/compareCategory.service";
import MatchPageClient from "@/components/templates/productMatch/MatchPageClient";
import ToolSeoContent from "@/components/seo/ToolSeoContent";

export const revalidate = 3600;

export default async function MatchPage() {
  const categories = (await getCompareCategories()).filter(
    (category) => (category.technicalStats?.length || 0) >= 2,
  );

  return (
    <>
      <MatchPageClient categories={categories} />
      <ToolSeoContent type="match" canonicalPath="/match" />
    </>
  );
}
