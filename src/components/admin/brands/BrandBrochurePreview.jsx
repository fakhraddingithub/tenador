import BrochurePreview from "@/components/admin/brochure/BrochurePreview";

/** پیش‌نمایشِ بروشورِ برند — همان BrochurePreview ـِ مشترک (بروشورِ ورزش هم همان است). */
export default async function BrandBrochurePreview({ brandId }) {
  return <BrochurePreview owner="brand" ownerId={brandId} />;
}
