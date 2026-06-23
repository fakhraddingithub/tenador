import { notFound } from "next/navigation";
import { getPageContent } from "base/services/pageContent.service";
import { buildPageMetadata } from "@/lib/pageMeta";
import CmsPageBody from "@/components/pages/CmsPageBody";

const SLUG = "terms";
export const revalidate = 300;

export async function generateMetadata() {
  const content = await getPageContent(SLUG);
  return buildPageMetadata(content, SLUG);
}

export default async function Page() {
  const content = await getPageContent(SLUG);
  if (!content) notFound();
  return <CmsPageBody content={content} />;
}
