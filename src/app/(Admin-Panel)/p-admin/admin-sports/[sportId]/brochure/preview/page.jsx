import BrochurePreview from "@/components/admin/brochure/BrochurePreview";

export const metadata = { title: "پیش‌نمایش بروشور ورزش | پنل تنادور" };

export default async function SportBrochurePreviewPage({ params }) {
  const { sportId } = await params;
  return <BrochurePreview owner="sport" ownerId={sportId} />;
}
