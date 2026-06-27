import { notFound } from "next/navigation";
import { getPageContent } from "base/services/pageContent.service";
import { buildPageMetadata } from "@/lib/pageMeta";
import CmsPageBody from "@/components/pages/CmsPageBody";

const SLUG = "terms";
// CMS با تگِ "pages" کش/باطل می‌شود؛ TTL زمان‌محور → ۲۴ساعت برای کاهشِ ISR Writes.
export const revalidate = 86400;

export async function generateMetadata() {
  const content = await getPageContent(SLUG);
  return buildPageMetadata(content, SLUG);
}

export default async function Page() {
  const content = await getPageContent(SLUG);
  if (!content) notFound();
  return <CmsPageBody content={content} />;
}
