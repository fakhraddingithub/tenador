import { getCompareCategories } from "base/services/compareCategory.service";
import ComparePageClient from "@/components/templates/productCompare/ComparePageClient";
import ToolSeoContent from "@/components/seo/ToolSeoContent";

export const revalidate = 3600;

export default async function ComparePage() {
  const categories = await getCompareCategories();
  return (
    <>
      <ComparePageClient initialCategories={categories} />
      <ToolSeoContent type="compare" canonicalPath="/compare" />
    </>
  );
}
