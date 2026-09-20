import BrandBrochurePreview from "@/components/admin/brands/BrandBrochurePreview";

export const metadata = { title: "پیش‌نمایش بروشور برند | پنل تنادور" };

export default async function BrandBrochurePreviewPage({ params }) {
  const { brandId } = await params;
  return <BrandBrochurePreview brandId={brandId} />;
}
