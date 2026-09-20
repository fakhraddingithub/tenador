import BrandBrochureEditor from "@/components/admin/brands/BrandBrochureEditor";

export const metadata = { title: "بروشور برند | پنل تنادور" };

export default async function BrandBrochurePage({ params }) {
  const { brandId } = await params;
  return <BrandBrochureEditor brandId={brandId} />;
}
