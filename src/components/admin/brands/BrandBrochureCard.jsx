"use client";

import BrochureCard from "@/components/admin/brochure/BrochureCard";

/** کارتِ بروشور در فرمِ برند — همان BrochureCard ـِ مشترک (بروشورِ ورزش هم همان است). */
export default function BrandBrochureCard({ brandId = null, status = null, className = "" }) {
  return <BrochureCard owner="brand" ownerId={brandId} status={status} className={className} />;
}
