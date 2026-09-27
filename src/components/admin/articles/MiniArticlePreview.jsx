import Link from "next/link";
import { FiEdit3, FiExternalLink } from "react-icons/fi";
import PreviewCanvas from "@/components/admin/articles/PreviewCanvas";

/** جایگاهِ محتوای خودِ صفحه، بینِ دو مینی‌مقاله — تا ترتیبِ واقعیِ صفحه دیده شود. */
function PageContentPlaceholder() {
  return <div className="my-4 rounded-[var(--admin-radius)] border border-dashed p-6 text-center text-xs text-gray-400" style={{ borderColor: "var(--admin-border-strong)" }}>
    محتوای خودِ صفحه (فهرستِ محصولات و فیلترها)
  </div>;
}

/**
 * پوسته‌ی پیش‌نمایشِ یک سندِ بلوکی — محتوای *ذخیره‌شده* با همان رندرکننده‌ی
 * عمومی، داخلِ بومِ قابلِ ویرایش. کامپوننتِ سروری است و داده را از صفحه می‌گیرد.
 *
 * یک یا چند بخش. مینی‌مقاله دو بخش دارد — بالا و پایینِ صفحه — و هر دو در همین
 * یک پیش‌نمایش دیده می‌شوند، با جایگاهِ محتوای صفحه بینشان، تا ترتیبِ نهایی
 * همان چیزی باشد که سایت نشان می‌دهد. رندر همان PreviewCanvas است، یعنی همان
 * رندرکننده‌ی عمومی — نه یک نمایشِ موازی.
 */
export default function MiniArticlePreview({ title, note, editHref, liveHref, blocks = [], entities = null, endpoint, sections = null, canEdit = true, emptyMessage = "هنوز بلوکی اضافه نشده است." }) {
  const parts = sections || [{ key: "blocks", blocks, entities, endpoint }];
  const filled = parts.filter((part) => (part.blocks || []).length > 0);
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

      {filled.length ? (
        <div className="a-card">
          <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
            {parts.map((part, index) => <div key={part.key || index}>
              {sections ? <p className="mb-2 text-[11px] font-bold text-gray-500">{part.label}</p> : null}
              {(part.blocks || []).length
                ? <PreviewCanvas blocks={part.blocks} entities={part.entities} canEdit={canEdit} endpoint={part.endpoint} />
                : <p className="rounded-[var(--admin-radius)] bg-gray-50 p-6 text-center text-xs text-gray-400">{emptyMessage}</p>}
              {sections && index === 0 ? <PageContentPlaceholder /> : null}
            </div>)}
          </div>
        </div>
      ) : (
        <p className="a-card p-12 text-center text-sm text-gray-400">{emptyMessage}</p>
      )}
    </div>
  );
}
