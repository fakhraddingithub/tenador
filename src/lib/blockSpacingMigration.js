/**
 * «فاصله‌ی پیش‌فرضِ بلوک» از ۳۶px به صفر تغییر کرد تا دو بلوکِ پشتِ‌سرِ‌هم که
 * فاصله‌ای برایشان تنظیم نشده، واقعاً چسبیده رندر شوند.
 *
 * برای اینکه محتوای موجود ذره‌ای جابه‌جا نشود، این مهاجرت همان فاصله‌ی *فعلی* را
 * صریح می‌کند: هر بلوکی که امروز از فاصله‌ی مشترک (blockSection) استفاده می‌کند و
 * هیچ spacing ذخیره‌شده‌ای ندارد، `style.spacing = "md"` می‌گیرد.
 *
 * پاراگراف و جداکننده فاصله‌ی *خودشان* را دارند (my-5 و my-10)، نه فاصله‌ی مشترک،
 * و آن فاصله‌ها دست‌نخورده‌اند؛ پس نباید روی آن‌ها چیزی نوشت — نوشتنِ "md" آن‌ها را
 * از ۲۰/۴۰ به ۳۶ می‌برد، یعنی دقیقاً همان تغییری که نمی‌خواهیم.
 */
export const SPACING_EXEMPT_TYPES = ["paragraph", "divider"];

/** آیا این بلوک باید فاصله‌ی فعلی‌اش صریح شود؟ */
export function needsSpacingPin(block) {
  return Boolean(block)
    && !SPACING_EXEMPT_TYPES.includes(block.type)
    && !block.style?.spacing;
}

/**
 * بلوک‌ها را (با فرزندانِ بلوک‌های ادغام‌شده، در هر عمقی) در جا به‌روز می‌کند و
 * تعدادِ بلوک‌های تغییرکرده را برمی‌گرداند. idempotent: بارِ دوم صفر می‌دهد.
 */
export function pinBlockSpacing(blocks) {
  let changed = 0;
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (needsSpacingPin(block)) {
      block.style = { ...(block.style || {}), spacing: "md" };
      changed += 1;
    }
    if (block?.type === "merged" && Array.isArray(block.data?.blocks)) {
      changed += pinBlockSpacing(block.data.blocks);
    }
  }
  return changed;
}
