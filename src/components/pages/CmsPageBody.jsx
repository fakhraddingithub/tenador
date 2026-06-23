/**
 * بدنه‌ی مشترکِ صفحات اطلاع‌رسانی — بلوک‌ها را از روی محتوای CMS رندر می‌کند.
 */
import SectionRenderer from "./SectionRenderer";

export default function CmsPageBody({ content }) {
  return (
    <div className="bg-[var(--color-background)] overflow-x-hidden">
      <SectionRenderer sections={content.sections} accent={content.accent} />
    </div>
  );
}
