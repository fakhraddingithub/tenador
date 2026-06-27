import { notFound } from "next/navigation";
import { getPageContent } from "base/services/pageContent.service";
import { buildPageMetadata } from "@/lib/pageMeta";
import CmsPageBody from "@/components/pages/CmsPageBody";

const SLUG = "about";
// محتوای CMS با تگِ "pages" کش و در زمانِ ذخیره در ادمین باطل می‌شود؛
// پس بازتولیدِ زمان‌محور را به ۲۴ساعت افزایش دادیم تا ISR Writes کم شود.
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
