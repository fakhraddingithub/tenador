import Link from "next/link";
import { FiEdit3, FiExternalLink } from "react-icons/fi";
import PreviewCanvas from "@/components/admin/articles/PreviewCanvas";

/**
 * پوسته‌ی پیش‌نمایشِ یک سندِ بلوکی — همان چیزی که پیش‌نمایشِ بروشور نشان می‌دهد:
 * محتوای *ذخیره‌شده* با همان رندرکننده‌ی عمومی، داخلِ بومِ قابلِ ویرایش.
 *
 * کامپوننتِ سروری است و داده را از صفحه می‌گیرد، چون هر سند از جای خودش
 * خوانده می‌شود؛ خودِ نمایش و ویرایش یکی است.
 */
export default function MiniArticlePreview({ title, note, editHref, liveHref, blocks = [], entities = null, endpoint, canEdit = true, emptyMessage = "هنوز بلوکی اضافه نشده است." }) {
  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="a-card sticky top-[132px] z-30 mb-4 flex flex-wrap items-center gap-3 p-3">
        <div>
          <strong className="block text-sm">{title}</strong>
          {note ? <small className="text-gray-400">{note}</small> : null}
        </div>
        <div className="mr-auto flex flex-wrap items-center gap-2">
          {liveHref ? (
            <a href={liveHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[var(--admin-radius)] border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--admin-border)" }}>
              <FiExternalLink aria-hidden="true" /> مشاهده در سایت
            </a>
          ) : null}
          {editHref ? (
            <Link href={editHref} className="inline-flex items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white">
              <FiEdit3 aria-hidden="true" /> ویرایش
            </Link>
          ) : null}
        </div>
      </div>

      {blocks.length ? (
        <div className="a-card">
          <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
            <PreviewCanvas blocks={blocks} entities={entities} canEdit={canEdit} endpoint={endpoint} />
          </div>
        </div>
      ) : (
        <p className="a-card p-12 text-center text-sm text-gray-400">{emptyMessage}</p>
      )}
    </div>
  );
}
