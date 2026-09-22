"use client";

import { useState } from "react";
import { FiFileText } from "react-icons/fi";
import BlockDocumentEditor from "@/components/admin/articles/BlockDocumentEditor";

/**
 * مینی‌مقاله‌ی «برند در یک دسته» روی صفحه‌ی خودش — همان ویرایشگرِ بروشور،
 * فقط با endpointِ خودش. فقط ورودیِ همین دسته نوشته می‌شود؛ بقیه‌ی دسته‌ها
 * دست‌نخورده می‌مانند (سمتِ سرور تضمین شده است).
 */
export default function BrandCategoryArticleEditor({ brandId, categoryId }) {
  const [names, setNames] = useState(null);

  return (
    <BlockDocumentEditor
      endpoint={`/api/brands/${brandId}/category-article/${categoryId}`}
      title={`مینی مقاله${names ? ` ${names.brand} — ${names.category}` : " برند در دسته"}`}
      subtitle="این بلوک‌ها فقط روی صفحه‌ی همین برند در همین دسته دیده می‌شوند."
      icon={<FiFileText />}
      backHref={`/p-admin/admin-brands/edit/${brandId}`}
      backLabel="بازگشت به برند"
      previewHref={`/p-admin/admin-brands/${brandId}/category-article/${categoryId}/preview`}
      parse={(data) => {
        setNames({
          brand: data?.brand?.title || data?.brand?.name || "",
          category: data?.category?.title || data?.category?.name || "",
        });
        return { blocks: Array.isArray(data?.blocks) ? data.blocks : [] };
      }}
      missingMessage="بارگذاری مینی‌مقاله دسته انجام نشد"
    />
  );
}
