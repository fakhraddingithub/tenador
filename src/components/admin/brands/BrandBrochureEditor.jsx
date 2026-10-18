"use client";

import BrochureEditor from "@/components/admin/brochure/BrochureEditor";

/** ویرایشگرِ بروشورِ برند — همان BrochureEditor ـِ مشترک (بروشورِ ورزش هم همان است). */
export default function BrandBrochureEditor({ brandId }) {
  return <BrochureEditor owner="brand" ownerId={brandId} />;
}
