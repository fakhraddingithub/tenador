"use client";

import { useState } from "react";
import { FiFileText } from "react-icons/fi";
import BlockDocumentEditor from "@/components/admin/articles/BlockDocumentEditor";

/**
 * مینی‌مقاله‌ی سری روی صفحه‌ی خودش — همان تجربه‌ی بروشورِ برند، با همان
 * BlockDocumentEditor. وضعیتِ انتشار ندارد: مینی‌مقاله‌ی سری همیشه روی صفحه‌ی
 * همان سری دیده می‌شود (رفتارِ قبلی، بدونِ تغییر).
 */
export default function SerieMiniArticleEditor({ brandId, serieId }) {
  const [serie, setSerie] = useState(null);
  const base = `/p-admin/admin-brands/${brandId}/${serieId}`;

  return (
    <BlockDocumentEditor
      endpoint={`/api/series/${serieId}/mini-article`}
      title={`مینی مقاله سری${serie ? ` ${serie.title || serie.name}` : ""}`}
      subtitle="این بلوک‌ها فقط زیر هدرِ صفحه‌ی همین سری دیده می‌شوند — نه سریِ والد و نه زیرسری‌ها."
      icon={<FiFileText />}
      backHref={`${base}/edit`}
      backLabel="بازگشت به سری"
      previewHref={`${base}/mini-article/preview`}
      parse={(data) => {
        setSerie(data?.serie || null);
        return { blocks: Array.isArray(data?.blocks) ? data.blocks : [] };
      }}
      missingMessage="بارگذاری مینی‌مقاله سری انجام نشد"
    />
  );
}
