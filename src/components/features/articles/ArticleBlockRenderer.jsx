import Image from "next/image";
import Link from "next/link";
import { FiArrowLeft, FiDownload, FiExternalLink, FiInfo } from "react-icons/fi";
import ArticleCard from "@/components/features/articles/ArticleCard";
import ArticleNewsletterForm from "@/components/features/articles/ArticleNewsletterForm";
import { PublicProductGrid, PublicUsedProductGrid } from "@/components/features/articles/PublicProductGrid";
import { sanitizeArticleHtml } from "@/lib/sanitizeArticleHtml";
import { sanitizeRichText } from "@/lib/sanitizeRichText";
import { BLOCK_ALIGN_SELF, BLOCK_WIDTH_CLASS, blockBoxProps, blockWidth, groupBlockRows } from "@/lib/articleBlockLayout";
import { imageBlockItems } from "@/lib/articleImageBlock";
import { flattenArticleBlocks, isMergedBlock, mergedChildren, sanitizeMergedGrid } from "@/lib/articleBlockTypes";

const ordered = (values, map) => (Array.isArray(values) ? values : values ? [values] : []).map((id) => map?.[String(id)]).filter(Boolean);
// فاصله‌ی پیش‌فرض صفر است: دو بلوکِ پشتِ‌سرِ‌هم که فاصله‌ای برایشان تنظیم نشده،
// چسبیده رندر می‌شوند (همان چیزی که در ویرایشگر دیده می‌شود). محتوای قدیمی با
// scripts/pinBlockSpacing.mjs فاصله‌ی قبلی‌اش را صریح گرفته است، پس جابه‌جا نمی‌شود.
// پاراگراف (my-5) و جداکننده (my-10) فاصله‌ی خودشان را دارند و دست‌نخورده‌اند.
const blockSection = "scroll-mt-28";

// ——— استایلِ اختیاریِ سطحِ بلوک ———————————————————————————————————————
// "md" دیگر پیش‌فرضِ ضمنی نیست، پس مقدارِ صریحِ خودش را دارد (همان ۳۶px قبلی).
const SPACING_CSS = { none: "0rem", sm: "1rem", md: "2.25rem", lg: "4rem" };

/** روی رنگِ داده‌شده، متنِ تیره یا روشن را انتخاب می‌کند تا خوانا بماند. */
function readableOn(hex) {
  const value = parseInt(hex.slice(1), 16);
  const luminance = 0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255);
  return luminance > 150 ? "#111827" : "#ffffff";
}

/**
 * استایلِ ذخیره‌شده را به مقادیرِ inline ترجمه می‌کند. کلیدِ غایب یعنی «دست نزن»
 * تا کلاس‌های فعلی دقیقاً همان‌طور که بودند بمانند.
 */
function blockVisuals(block) {
  const style = block?.style || {};
  const gap = SPACING_CSS[style.spacing];
  // فاصله‌ی دقیقِ هر طرف (چیدمان) بر پیش‌تنظیمِ بالا/پایین (استایل) اولویت دارد،
  // وگرنه دو مقدار روی هم جمع می‌شدند و «۱rem از بالا» عملاً ۳.۲۵rem می‌شد.
  const layout = block?.layout || {};
  const spacing = gap === undefined ? null : {
    ...(layout.mt === undefined ? { marginTop: gap } : null),
    ...(layout.mb === undefined ? { marginBottom: gap } : null),
  };
  return {
    // فاصله باید inline باشد: کلاسِ my-* تیلویند را نمی‌توان با کلاسِ دیگری
    // غلبه کرد، چون ترتیبِ استایل‌شیت تعیین‌کننده است نه ترتیبِ صفتِ class.
    spacing: spacing && Object.keys(spacing).length ? spacing : null,
    text: style.textColor || null,
    background: style.background || null,
    accent: style.accent || null,
    tableVariant: style.tableVariant || "default",
    align: style.align || null,
  };
}

/**
 * محتوای یک بلوکِ متنی: یا HTMLِ قالب‌بندی‌شده یا متنِ سادهٔ قبلی.
 *
 * بلوکی که data.html ندارد (یعنی هر بلوکِ موجود) دقیقاً همان `children` قبلی را
 * می‌گیرد، پس خروجی‌اش بایت‌به‌بایت بدون تغییر می‌ماند. پاک‌سازی اینجا هم تکرار
 * می‌شود چون ذخیره‌سازی تنها خطِ دفاع نیست — همان الگوی بلوکِ HTML سفارشی.
 */
function richContent(data) {
  const html = data.html ? sanitizeRichText(data.html) : "";
  return html ? { dangerouslySetInnerHTML: { __html: html } } : { children: data.text };
}

/** پس‌زمینه بدونِ فاصله‌ی داخلی بد به نظر می‌رسد؛ پس با هم می‌آیند. */
const padded = (visuals) => (visuals.background
  ? { backgroundColor: visuals.background, padding: "1.25rem", borderRadius: "var(--radius)" }
  : null);

/** اگر هیچ بخشی فعال نباشد undefined می‌دهد تا صفتِ style اصلاً رندر نشود. */
function merge(...parts) {
  const result = Object.assign({}, ...parts.filter(Boolean));
  return Object.keys(result).length ? result : undefined;
}

// `default` باید مو‌به‌مو همان ظاهرِ فعلی باشد؛ بقیه فقط وقتی انتخاب شوند اثر دارند.
const TABLE_VARIANTS = {
  default: { wrapper: "overflow-x-auto rounded-[var(--radius)] border border-gray-200", head: "bg-gray-900 text-white", th: "p-4 font-bold", row: "border-t border-gray-100 even:bg-gray-50", cell: "p-4 leading-7 text-gray-700" },
  striped: { wrapper: "overflow-x-auto rounded-[var(--radius)] border border-gray-200", head: "bg-gray-100 text-gray-900", th: "p-4 font-bold", row: "border-t border-gray-100 even:bg-gray-50", cell: "p-4 leading-7 text-gray-700" },
  bordered: { wrapper: "overflow-x-auto rounded-[var(--radius)] border border-gray-200", head: "bg-gray-900 text-white", th: "border border-gray-700 p-4 font-bold", row: "", cell: "border border-gray-200 p-4 leading-7 text-gray-700" },
  plain: { wrapper: "overflow-x-auto", head: "border-b-2 border-gray-300 text-gray-900", th: "p-4 font-bold", row: "border-t border-gray-100", cell: "p-4 leading-7 text-gray-700" },
};

function safeHeadingId(block) {
  return `article-${String(block.id || "heading").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

// تیترهای داخلِ بلوکِ ادغام‌شده هم به ترتیبِ خواندن شماره‌گذاری می‌شوند، تا
// سطحِ تیتر در متن و در فهرستِ مطالب یکی باشد.
function normalizeHeadingLevels(blocks = []) {
  let previous = 1;
  const normalize = (block) => {
    if (block.type !== "heading") return block;
    const requested = Number(String(block.data?.level || "h2").slice(1));
    previous = Math.max(2, Math.min(4, Number.isFinite(requested) ? requested : 2, previous + 1));
    return { ...block, data: { ...block.data, level: `h${previous}` } };
  };
  const walk = (block) => (isMergedBlock(block)
    ? { ...block, data: { ...block.data, blocks: mergedChildren(block).map(walk) } }
    : normalize(block));
  return blocks.map(walk);
}

export function articleHeadings(blocks = []) {
  return flattenArticleBlocks(normalizeHeadingLevels(blocks)).filter((block) => block.type === "heading" && block.data?.text).map((block) => ({ id: safeHeadingId(block), text: block.data.text, level: block.data.level || "h2" }));
}

// ——— بلوکِ ادغام‌شده ————————————————————————————————————————————————————
// یک سطرِ افقی که هرگز روی هم چیده نمی‌شود. هر فرزند عرضِ خودش را دارد (۱/۲،
// ۱/۳، ۲/۳) و فرزندِ بی‌عرض سهمِ مساوی می‌گیرد؛ کمینه‌ی ۱۶rem نمی‌گذارد محتوا
// له شود. وقتی صفحه جا ندارد (موبایل) سطر سرریز می‌شود و به یک اسلایدرِ افقیِ
// snap‌دار تبدیل می‌شود؛ در دسکتاپ جمعِ عرض‌ها دقیقاً ۱۰۰٪ است (فاصله کسر می‌شود).
const MERGED_WIDTH_PERCENT = { "1/2": 50, "1/3": 100 / 3, "2/3": 200 / 3 };

/**
 * چیدمانِ شبکه‌ای (data.grid)، جدا برای موبایل و دسکتاپ (مرز: md).
 *  - fit: دقیقاً columns ستونِ جمع‌شونده؛ ردیف‌ها خودکار؛ اسکرولِ افقی هرگز.
 *  - بدونِ fit: K = max(columns, ⌈n/rows⌉) ستون، هر ستون به پهنای یک‌ستونِ
 *    columns تایی (و دست‌کم minWidth)؛ هرچه بیرون بزند، اسلایدرِ افقیِ snap‌دار.
 * مقدارها با متغیرهای CSS می‌آیند و کلاس‌ها ثابت‌اند (تیلویند فقط رشته‌ی ثابت می‌سازد).
 */
function MergedGrid({ items, grid, spacing }) {
  const vars = {};
  for (const [key, settings] of [["m", grid.mobile], ["d", grid.desktop]]) {
    const columns = settings.fit ? settings.columns : Math.max(settings.columns, Math.ceil(items.length / settings.rows));
    vars[`--c${key}`] = settings.columns;
    vars[`--k${key}`] = columns;
    // فاصله‌ی هر breakpoint جداست و با media query عوض می‌شود، پس مقدارش متغیرِ
    // خودش را دارد و کلاس‌ها ثابت می‌مانند (inline style نمی‌تواند media query
    // داشته باشد — همان مرزِ «چیدمان» و «واکنش‌گرایی» در جعبه‌ی بلوک).
    vars[`--g${key}`] = `${settings.gap}rem`;
    vars[`--w${key}`] = `max(calc((100% - (${settings.columns} - 1) * var(--g)) / ${settings.columns}), ${settings.minWidth}px)`;
  }
  const scrolls = !grid.mobile.fit || !grid.desktop.fit;
  return <div
    data-merged-block
    {...(scrolls ? { role: "region", "aria-label": "محتوای کنارِ هم — برای دیدنِ بقیه به چپ و راست بکشید", tabIndex: 0 } : {})}
    className={[
      blockSection,
      "pb-2 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]",
      grid.mobile.fit ? "overflow-x-visible" : "overflow-x-auto overscroll-x-contain snap-x snap-mandatory",
      grid.desktop.fit ? "md:overflow-x-visible md:snap-none" : "md:overflow-x-auto md:snap-x md:snap-mandatory",
    ].join(" ")}
    style={spacing || undefined}
  >
    <div
      className={[
        "grid items-start gap-[var(--g)] [--g:var(--gm)] md:[--g:var(--gd)]",
        grid.mobile.fit ? "grid-cols-[repeat(var(--cm),minmax(0,1fr))]" : "grid-cols-[repeat(var(--km),var(--wm))]",
        grid.desktop.fit ? "md:grid-cols-[repeat(var(--cd),minmax(0,1fr))]" : "md:grid-cols-[repeat(var(--kd),var(--wd))]",
      ].join(" ")}
      style={vars}
    >
      {items.map(({ child, node }) => {
        // چیدمانِ فرزند روی *خانه‌ی خودش* می‌نشیند: عرض/فاصله/جای‌گیریِ افقی از
        // جعبه و هم‌ترازیِ عمودی از align-self. خانه همان سهمِ فرزند در شبکه
        // است، پس نه wrapper اضافه‌ای لازم است و نه با ریستِ حاشیه‌ی خانه
        // (*:my-0، که به فرزندانِ خانه می‌خورد نه خودش) تداخل می‌کند.
        const box = blockBoxProps(child);
        const alignSelf = BLOCK_ALIGN_SELF[child?.layout?.alignY];
        return <div
          key={child.id}
          className={`min-w-0 snap-start *:my-0${box ? ` ${box.className}` : ""}`}
          style={box || alignSelf ? { ...(box?.style || {}), ...(alignSelf ? { alignSelf } : null) } : undefined}
        >{node}</div>;
      })}
    </div>
  </div>;
}

function MergedBlock({ items, spacing }) {
  const share = 100 / items.length;
  const gapShare = (items.length - 1) / items.length;
  return <div
    role="region"
    aria-label="محتوای کنارِ هم — برای دیدنِ بقیه به چپ و راست بکشید"
    tabIndex={0}
    data-merged-block
    className={`${blockSection} snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]`}
    style={spacing || undefined}
  >
    {/* بلوکِ ادغام‌شده‌ی قدیمی (بدونِ grid) تنظیمِ فاصله ندارد، پس مثلِ حالتِ
        پیش‌فرضِ جدید فاصله‌ی صفر می‌گیرد؛ متغیر می‌ماند چون سهمِ هر خانه از آن کم می‌شود. */}
    <div className="flex items-start gap-[var(--merged-gap)] [--merged-gap:0rem]">
      {items.map(({ child, node }) => {
        const percent = MERGED_WIDTH_PERCENT[blockWidth(child)] ?? share;
        // همان قاعده‌ی شبکه، روی خانه‌ی flex: سهمِ خانه از flexBasis می‌آید و
        // اندازه/جای‌گیریِ خودِ فرزند داخلِ آن سهم از جعبه.
        const box = blockBoxProps(child);
        const alignSelf = BLOCK_ALIGN_SELF[child?.layout?.alignY];
        return <div
          key={child.id}
          className={`min-w-[16rem] shrink-0 grow-0 snap-start *:my-0${box ? ` ${box.className}` : ""}`}
          style={{ flexBasis: `calc(${percent}% - var(--merged-gap) * ${gapShare})`, ...(box?.style || {}), ...(alignSelf ? { alignSelf } : null) }}
        >{node}</div>;
      })}
    </div>
  </div>;
}

function EntityCards({ title, items, kind, visuals, inMerged = false }) {
  if (!items.length) return null;
  const v = visuals || {};
  const details = {
    brands: (item) => ({ image: item.logo || item.image || item.icon, href: `/${item.slug}` }),
    series: (item) => ({ image: item.logo || item.image || item.headImage, href: `/products?serie=${encodeURIComponent(item.slug || "")}` }),
    categories: (item) => ({ image: item.image || item.icon, href: item.sport?.slug ? `/${item.sport.slug}/${item.slug}` : "/products" }),
    sports: (item) => ({ image: item.image || item.icon, href: `/${item.slug}` }),
  };
  return (
    <section className={blockSection} style={v.spacing || undefined}>
      {title ? <h2 className="mb-5 text-xl font-black text-gray-900" style={v.text ? { color: v.text } : undefined}>{title}</h2> : null}
      <div className={`grid gap-3 ${inMerged ? slotGrid(items.length, SLOT_TILES) : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"}`}>
        {items.map((item) => {
          const meta = details[kind](item);
          return <Link key={item._id} href={meta.href} className="group flex min-h-32 flex-col items-center justify-center rounded-[var(--radius)] border border-black/10 bg-white p-5 text-center transition-[transform,border-color,box-shadow] motion-safe:hover:-translate-y-1 hover:border-[var(--color-primary)] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">{meta.image ? <span className="relative mb-3 block h-14 w-20"><Image src={meta.image} alt={item.title || item.name} fill sizes="80px" className="object-contain" /></span> : null}<strong className="text-sm text-gray-800 group-hover:text-[var(--color-primary)]">{item.title || item.name}</strong></Link>;
        })}
      </div>
    </section>
  );
}

// ——— بلوکِ تصویر: چند تصویر، ارتفاعِ دلخواه، متنِ روی تصویر، پیوند ————————
// بلوکِ «ساده» (یک تصویر، بدونِ ارتفاع/پیوند/متن) از مسیرِ قدیمی و با همان
// نشانه‌گذاریِ قبلی رندر می‌شود، تا مقاله‌های موجود ذره‌ای تغییر نکنند.
function isPlainImageBlock(data) {
  const items = imageBlockItems(data);
  return items.length <= 1 && !data.displayHeight && !items[0]?.href && !items[0]?.overlayText;
}

const OVERLAY_TEXT_SIZE = { sm: "text-sm md:text-base", md: "text-base md:text-2xl", lg: "text-lg md:text-3xl", xl: "text-xl md:text-5xl" };
const OVERLAY_VERTICAL = { top: "justify-start", center: "justify-center", bottom: "justify-end" };
const OVERLAY_TEXT_ALIGN = { right: "text-right", center: "text-center", left: "text-left" };
/**
 * ستون‌های یک شبکه‌ی داخلی وقتی بلوک داخلِ خانه‌ی یک بلوکِ ادغام‌شده است: بر اساسِ
 * عرضِ همان خانه (auto-fill)، نه نقطه‌شکن‌های صفحه. یک مورد تمامِ خانه را می‌گیرد.
 * min(...,100%) نمی‌گذارد در خانه‌ی باریک‌تر از کمینه، چیزی سرریز کند.
 */
const SLOT_ONE = "grid-cols-1";
const SLOT_CARDS = "grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))]";
const SLOT_TILES = "grid-cols-[repeat(auto-fill,minmax(min(8rem,100%),1fr))]";
const slotGrid = (count, many = SLOT_CARDS) => (count === 1 ? SLOT_ONE : many);

const IMAGE_GRID_COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };

function ImageTile({ item, height, overlay = {}, sizes }) {
  const alt = item.alt || item.overlayText || "تصویر مقاله";
  const media = height
    // ارتفاعِ ثابت با object-cover؛ در موبایل به ۷۵vw محدود می‌شود تا تصویرِ
    // باریک‌شده به نواری بلند و بریده تبدیل نشود.
    ? <div className="relative w-full" style={{ height: `min(${height}px, 75vw)` }}><Image src={item.url} alt={alt} fill sizes={sizes} className="object-cover" /></div>
    : <Image src={item.url} alt={alt} width={item.width || 1600} height={item.height || 900} sizes={sizes} className="h-auto w-full" />;
  const text = item.overlayText
    ? <div dir={overlay.dir || "rtl"} className={`absolute inset-0 flex flex-col p-4 md:p-8 ${OVERLAY_VERTICAL[overlay.position || "center"]} ${overlay.shade === false ? "" : "bg-black/35"}`}>
      <p className={`whitespace-pre-line font-black leading-snug ${OVERLAY_TEXT_SIZE[overlay.size || "md"]} ${OVERLAY_TEXT_ALIGN[overlay.align || "center"]}`} style={{ color: overlay.color || "#ffffff", textShadow: "0 1px 3px rgba(0,0,0,.45)" }}>{item.overlayText}</p>
    </div>
    : null;
  const tile = "relative block overflow-hidden rounded-[var(--radius)]";
  // پیوند در همان زبانه باز می‌شود (بدونِ target) — ناوبریِ عادیِ سایت.
  return item.href
    ? <Link href={item.href} aria-label={alt} className={`${tile} transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]`}>{media}{text}</Link>
    : <div className={tile}>{media}{text}</div>;
}

function ImageBlock({ data, spacing, inMerged = false }) {
  const items = imageBlockItems(data);
  if (!items.length) return null;
  const cols = Math.min(items.length, 4);
  const sizes = cols === 1 ? "(max-width: 1024px) 100vw, 1200px" : `(max-width: 640px) 100vw, ${Math.ceil(100 / cols)}vw`;
  return <figure className={blockSection} style={spacing || undefined}>
    <div className={cols === 1 ? "" : `grid gap-3 ${inMerged ? slotGrid(items.length, SLOT_TILES) : `grid-cols-1 ${IMAGE_GRID_COLS[cols]}`}`}>
      {items.map((item, index) => <ImageTile key={`${item.url}-${index}`} item={item} height={data.displayHeight} overlay={data.overlay} sizes={sizes} />)}
    </div>
    {data.caption ? <figcaption className="mt-3 text-center text-xs leading-6 text-gray-500">{data.caption}</figcaption> : null}
  </figure>;
}

// ——— دکمه ————————————————————————————————————————————————————————————
// همه‌ی کلیدها اختیاری‌اند: دکمه‌ی قدیمی (فقط label/href/style) دقیقاً مثل قبل
// رندر می‌شود — جز آیکنِ فلش که دیگر اجباری نیست و پیش‌فرض ندارد.
const BUTTON_SIZE_CLASS = { sm: "px-4 py-2 text-sm", md: "px-6 py-3", lg: "px-8 py-4 text-lg" };
const BUTTON_VARIANT_CLASS = {
  outline: "border-black/20 hover:bg-gray-900 hover:text-white",
  secondary: "border-[var(--color-secondary)] bg-[var(--color-secondary)] text-gray-900",
  primary: "border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:bg-transparent hover:text-[var(--color-primary)]",
};
// سند RTL است: «راست» یعنی شروعِ خط.
const BUTTON_JUSTIFY = { right: "flex-start", center: "center", left: "flex-end" };
const BUTTON_ICON = { arrow: FiArrowLeft, external: FiExternalLink, download: FiDownload };

function videoEmbed(url) {
  try {
    const value = new URL(url);
    if (value.hostname.includes("youtube.com")) return `https://www.youtube-nocookie.com/embed/${value.searchParams.get("v") || ""}`;
    if (value.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${value.pathname.slice(1)}`;
    if (value.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${value.pathname.split("/").filter(Boolean).pop()}`;
  } catch {}
  return null;
}

export default function ArticleBlockRenderer({ blocks = [], entities, preview = false, interactive = false }) {
  const maps = entities?.maps || {};
  const rate = entities?.rate || 1;
  /**
   * inMerged یعنی «این بلوک داخلِ خانه‌ی یک بلوکِ ادغام‌شده رندر می‌شود».
   *
   * تنها چیزی که با آن عوض می‌شود، شبکه‌ی *داخلیِ* خودِ بلوک است: بیرون، ستون‌ها
   * از نقطه‌شکن‌های صفحه می‌آیند (که همان اندازه‌ی همیشگیِ کارت را می‌دهد)، و
   * داخل، از عرضِ خانه‌ای که والد به بلوک داده است. محتوای بلوک دست‌نخورده است —
   * سلسله‌مراتب همان می‌ماند: ادغام جای بلوک را تعیین می‌کند، بلوک محتوای خودش را.
   */
  const renderBlock = (block, inMerged = false) => {
    const data = block.data || {};
    const v = blockVisuals(block);
    if (isMergedBlock(block)) {
      // فرزندان با همین renderBlock رندر می‌شوند — هر نوع بلوک داخلِ ادغام دقیقاً
      // همان‌طور دیده می‌شود که بیرونِ آن.
      const items = mergedChildren(block).map((child) => ({ child, node: renderBlock(child, true) })).filter((item) => item.node);
      if (!items.length) return null;
      // بدونِ grid: همان ردیفِ پیش‌فرضِ قبلی، بدونِ هیچ تغییری.
      // پیش‌نمایشِ ادمین وضعیتِ ذخیره‌نشده را رندر می‌کند، پس grid اینجا هم پاک‌سازی می‌شود.
      const grid = sanitizeMergedGrid(data.grid);
      return grid
        ? <MergedGrid key={block.id} items={items} grid={grid} spacing={v.spacing} />
        : <MergedBlock key={block.id} items={items} spacing={v.spacing} />;
    }
    if (block.type === "heading") {
      const level = ["h2", "h3", "h4"].includes(data.level) ? data.level : "h2";
      const Tag = level;
      const sizes = { h2: "text-2xl md:text-3xl", h3: "text-xl md:text-2xl", h4: "text-lg md:text-xl" };
      return <Tag key={block.id} id={safeHeadingId(block)} className={`${blockSection} ${sizes[level]} font-black leading-relaxed text-gray-900`} style={merge(v.spacing, padded(v), v.text && { color: v.text }, v.align && { textAlign: v.align })} {...richContent(data)} />;
    }
    if (block.type === "paragraph") {
      const content = richContent(data);
      // شکستِ خط در حالتِ HTML با <br> می‌آید، پس whitespace-pre-line آنجا فقط
      // فاصله‌های اضافیِ خودِ نشانه‌گذاری را دوباره نمایش می‌داد.
      return <p key={block.id} className={`my-5 ${content.children === undefined ? "" : "whitespace-pre-line "}text-[16px] leading-9 text-gray-700 md:text-[17px]`} style={merge(v.spacing, padded(v), v.text && { color: v.text }, v.align && { textAlign: v.align })} {...content} />;
    }
    // تصویرِ محتوا با نسبتِ واقعیِ خودش رندر می‌شود: عرض/ارتفاعِ ذخیره‌شده فقط
    // جا را پیش از بارگذاری رزرو می‌کند (aspect-ratio: auto w/h) و پس از بارگذاری
    // نسبتِ ذاتیِ تصویر جای آن را می‌گیرد — پس هیچ بُرشی رخ نمی‌دهد.
    if (block.type === "image" && !isPlainImageBlock(data)) return <ImageBlock key={block.id} data={data} spacing={v.spacing} inMerged={inMerged} />;
    if (block.type === "image" && data.url) return <figure key={block.id} className={blockSection} style={v.spacing || undefined}><Image src={data.url} alt={data.alt || "تصویر مقاله"} width={data.width || 1600} height={data.height || 900} sizes="(max-width: 1024px) 100vw, 820px" className="h-auto w-full rounded-[var(--radius)]" />{data.caption ? <figcaption className="mt-3 text-center text-xs leading-6 text-gray-500">{data.caption}</figcaption> : null}</figure>;
    if (block.type === "gallery") {
      const images = (data.images || []).map((image) => typeof image === "string" ? { url: image, alt: "" } : image).filter((image) => image.url);
      return images.length ? <div key={block.id} className={`${blockSection} grid gap-3 ${inMerged ? slotGrid(images.length, SLOT_TILES) : "grid-cols-2"}`} style={v.spacing || undefined}>{images.map((image, index) => <figure key={`${image.url}-${index}`} className={`relative overflow-hidden rounded-[var(--radius)] bg-gray-100 ${index === 0 && images.length % 2 ? "col-span-2 aspect-[16/8]" : "aspect-square"}`}><Image src={image.url} alt={image.alt || data.alt || "تصویر گالری مقاله"} fill sizes="(max-width: 768px) 50vw, 400px" className="object-cover" loading="lazy" />{image.caption ? <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-xs text-white">{image.caption}</figcaption> : null}</figure>)}</div> : null;
    }
    if (block.type === "video" && data.url) {
      const embed = videoEmbed(data.url);
      return <figure key={block.id} className={blockSection} style={v.spacing || undefined}><div className="aspect-video overflow-hidden rounded-[var(--radius)] bg-black">{embed ? <iframe src={embed} title={data.title || "ویدئوی مقاله"} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" /> : <video src={data.url} controls preload="metadata" className="h-full w-full" />}</div>{data.title ? <figcaption className="mt-3 text-center text-xs text-gray-500">{data.title}</figcaption> : null}</figure>;
    }
    if (block.type === "quote") return <blockquote key={block.id} className={`${blockSection} border-r-4 border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_6%,white)] px-6 py-5 text-lg font-bold leading-9 text-gray-800`} style={merge(v.spacing, v.accent && { borderRightColor: v.accent }, v.background && { backgroundColor: v.background }, v.text && { color: v.text }, v.align && { textAlign: v.align })}><p {...richContent(data)} />{data.author ? <footer className="mt-3 text-sm font-normal text-gray-500">— {data.author}</footer> : null}</blockquote>;
    if (block.type === "divider") return <hr key={block.id} className="my-10 border-gray-200" style={merge(v.spacing, v.accent && { borderColor: v.accent })} />;
    if (block.type === "button" && data.href) {
      // رنگِ دلخواه، حالتِ hover کلاس‌ها را کنار می‌گذارد (inline همیشه برنده است)
      // که رفتارِ قابلِ پیش‌بینی‌تری است تا ترکیبِ نیمه‌کاره‌ی دو رنگ.
      const label = v.text || (v.accent ? readableOn(v.accent) : null);
      const Icon = BUTTON_ICON[data.icon];
      return <div key={block.id} className={blockSection} style={merge(v.spacing, data.align && { textAlign: data.align })}>
        <Link
          href={data.href}
          className={`${data.fullWidth ? "flex w-full" : "inline-flex"} items-center gap-2 rounded-[var(--radius)] border-2 font-bold transition-colors ${BUTTON_SIZE_CLASS[data.size] || BUTTON_SIZE_CLASS.md} ${BUTTON_VARIANT_CLASS[data.style] || BUTTON_VARIANT_CLASS.primary}`}
          style={merge(
            v.accent && { backgroundColor: v.accent, borderColor: v.accent },
            label && { color: label },
            data.fontSize && { fontSize: `${data.fontSize}px` },
            // چینشِ متن فقط وقتی دیده می‌شود که دکمه از متنش پهن‌تر باشد (تمام‌عرض).
            data.fullWidth && { justifyContent: BUTTON_JUSTIFY[data.textAlign] || "center" },
          )}
        >{data.label || "مشاهده"}{Icon ? <Icon aria-hidden="true" /> : null}</Link>
      </div>;
    }
    if (block.type === "callout") return <aside key={block.id} className={`${blockSection} flex gap-4 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_7%,white)] p-5`} style={merge(v.spacing, v.background && { backgroundColor: v.background }, v.accent && { borderColor: v.accent })}><FiInfo className="mt-1 shrink-0 text-xl text-[var(--color-primary)]" style={v.accent ? { color: v.accent } : undefined} /><div>{data.title ? <strong className="mb-2 block text-gray-900" style={v.text ? { color: v.text } : undefined}>{data.title}</strong> : null}<p className="whitespace-pre-line text-sm leading-7 text-gray-700" style={v.text ? { color: v.text } : undefined}>{data.text}</p></div></aside>;
    if (block.type === "table") {
      const variant = TABLE_VARIANTS[v.tableVariant] || TABLE_VARIANTS.default;
      const head = v.accent ? { backgroundColor: v.accent, color: readableOn(v.accent) } : undefined;
      const cell = v.text ? { color: v.text } : undefined;
      return <div key={block.id} className={`${blockSection} ${variant.wrapper}`} style={v.spacing || undefined}><table className="w-full min-w-[560px] text-right text-sm"><thead className={variant.head} style={head}><tr>{(data.headers || []).map((header, index) => <th key={index} scope="col" className={variant.th}>{header}</th>)}</tr></thead><tbody>{(data.rows || []).map((row, rowIndex) => <tr key={rowIndex} className={variant.row}>{row.map((cellValue, index) => <td key={index} className={variant.cell} style={cell}>{cellValue}</td>)}</tr>)}</tbody></table></div>;
    }
    if (block.type === "faq") return <section key={block.id} className={blockSection} style={v.spacing || undefined}><div className="space-y-3">{(data.items || []).filter((item) => item.question).map((item, index) => <details key={index} className="group rounded-[var(--radius)] border border-gray-200 bg-white p-5" style={merge(v.background && { backgroundColor: v.background }, v.accent && { borderColor: v.accent })}><summary className="cursor-pointer list-none font-bold text-gray-900" style={v.text ? { color: v.text } : undefined}>{item.question}</summary><p className="mt-4 border-t border-gray-100 pt-4 leading-8 text-gray-600" style={v.text ? { color: v.text } : undefined}>{item.answer}</p></details>)}</div></section>;
    if (block.type === "productCard" || block.type === "productSlider") {
      const products = block.type === "productCard" ? ordered(data.product, maps.products) : ordered(data.products, maps.products);
      return products.length ? <section key={block.id} className={blockSection} style={v.spacing || undefined}>{data.title ? <h2 className="mb-5 text-xl font-black" style={v.text ? { color: v.text } : undefined}>{data.title}</h2> : null}<PublicProductGrid products={products} rate={rate} fill={inMerged} /></section> : null;
    }
    if (["latestProducts", "bestSellers", "amazingOffers"].includes(block.type)) {
      const products = entities?.dynamicProducts?.[String(block.id)] || [];
      return products.length ? <section key={block.id} className={blockSection} style={v.spacing || undefined}><h2 className="mb-5 text-xl font-black" style={v.text ? { color: v.text } : undefined}>{data.title}</h2><PublicProductGrid products={products} rate={rate} fill={inMerged} /></section> : null;
    }
    if (["brandSlider", "collectionSlider", "categorySlider", "sportSlider"].includes(block.type)) {
      const config = { brandSlider: ["brands", data.brands], collectionSlider: ["series", data.collections], categorySlider: ["categories", data.categories], sportSlider: ["sports", data.sports] }[block.type];
      return <EntityCards key={block.id} title={data.title} kind={config[0]} items={ordered(config[1], maps[config[0]])} visuals={v} inMerged={inMerged} />;
    }
    if (block.type === "usedProducts") return <section key={block.id} className={blockSection} style={v.spacing || undefined}>{data.title ? <h2 className="mb-5 text-xl font-black" style={v.text ? { color: v.text } : undefined}>{data.title}</h2> : null}<PublicUsedProductGrid fill={inMerged} products={ordered(data.products, maps.usedProducts)} /></section>;
    if (block.type === "relatedArticles") {
      const articles = ordered(data.articles, maps.articles).filter((item) => item.category?.status !== "archived");
      return articles.length ? <section key={block.id} className={blockSection} style={v.spacing || undefined}><h2 className="mb-5 text-xl font-black" style={v.text ? { color: v.text } : undefined}>{data.title || "مقالات مرتبط"}</h2><div className={`grid gap-4 ${inMerged ? slotGrid(articles.length) : "md:grid-cols-2"}`}>{articles.map((article) => <ArticleCard key={article._id} article={article} />)}</div></section> : null;
    }
    if (block.type === "newsletterCta") return <section key={block.id} className={`${blockSection} rounded-[var(--radius)] bg-[#20232a] p-6 text-white md:p-8`} style={merge(v.spacing, v.background && { backgroundColor: v.background }, v.text && { color: v.text })}><h2 className="text-2xl font-black">{data.title || "عضویت در خبرنامه تنادور"}</h2><p className="mt-2 leading-8 text-gray-300" style={v.text ? { color: v.text } : undefined}>{data.description || "جدیدترین راهنماها و پیشنهادهای تنادور را دریافت کنید."}</p>{preview ? <div className="mt-4 inline-flex rounded-[var(--radius)] bg-[var(--color-secondary)] px-5 py-2.5 text-sm font-bold text-gray-900" style={v.accent ? { backgroundColor: v.accent, color: readableOn(v.accent) } : undefined}>{data.buttonLabel || "\u0639\u0636\u0648\u06cc\u062a"}</div> : <ArticleNewsletterForm buttonLabel={data.buttonLabel} />}</section>;
    if (block.type === "customHtml" && data.html) return <div key={block.id} className={`${blockSection} leading-8 text-gray-700`} style={merge(v.spacing, padded(v), v.text && { color: v.text })} dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(data.html) }} />;
    return null;
  };

  // بلوک‌هایی که چیزی رندر نمی‌کنند پیش از گروه‌بندی کنار می‌روند تا نه جایی در
  // سطر بگیرند و نه دنباله‌ی کنارِ‌هم را بی‌دلیل بشکنند.
  /**
   * جعبه‌ی چیدمان دورِ بلوک — *فقط* وقتی چیزی برای اعمال هست. بلوکی که چیدمان
   * ندارد هیچ wrapper اضافه‌ای نمی‌گیرد، پس خروجیِ محتوای موجود بایت‌به‌بایت
   * همان قبلی است.
   *
   * در حالتِ interactive (پیش‌نمایشِ قابلِ ویرایش) همین wrapper شناسه‌ی بلوک را
   * هم حمل می‌کند: کلیک روی هر فرزندی — از جمله فرزندِ یک بلوکِ ادغام‌شده — با
   * closest به همین بیرونی‌ترین بلوک می‌رسد، پس انتخابِ بلوکِ ادغام‌شده هرگز به
   * فرزندش نمی‌شکند.
   */
  const boxed = (block, node) => {
    const box = blockBoxProps(block);
    if (!box && !interactive) return node;
    const hooks = interactive ? { "data-block-id": block.id, "data-block-type": block.type } : null;
    // دستگیره‌ی کشیدن باید *داخلِ* همین wrapper باشد تا با بلوک جابه‌جا شود.
    // نویسه‌ی ⠿ است تا رندرِ عمومی به هیچ آیکونی وابسته نشود؛ استایلش در تمِ
    // ادمین است و بیرونِ پیش‌نمایش اصلاً کلاسی برای نمایشش وجود ندارد.
    const handle = interactive
      ? <span key="handle" data-drag-handle="" className="preview-handle" aria-hidden="true">⠿</span>
      : null;
    // بدونِ چیدمان، wrapper فقط یک div خالیِ بی‌اثر است (نه flex) تا در حالتِ
    // interactive هم پیش‌نمایش دقیقاً همان چیزی باشد که سایت نشان می‌دهد.
    if (!box) return <div key={block.id} {...hooks}>{handle}{node}</div>;
    return <div key={block.id} className={box.className} style={box.style} {...hooks}>{handle}{node}</div>;
  };

  const rendered = [];
  for (const block of normalizeHeadingLevels(blocks)) {
    const node = renderBlock(block);
    if (node) rendered.push({ block, node: boxed(block, node) });
  }

  return groupBlockRows(rendered, (item) => blockWidth(item.block)).map((row) => {
    // سطرِ تمام‌عرض بدونِ هیچ wrapper اضافه‌ای برمی‌گردد؛ مقاله‌های قدیمی دقیقاً
    // همان خروجیِ قبلی را می‌دهند.
    if (!row.sized) return row.blocks[0].node;
    // زیرِ md اصلاً grid نیست، پس فرزندها بلوکی می‌مانند و طبیعی روی هم می‌چینند.
    return (
      <div key={`row-${row.blocks[0].block.id}`} className="md:grid md:grid-cols-6 md:items-start md:gap-x-6">
        {row.blocks.map((item) => {
          const alignSelf = BLOCK_ALIGN_SELF[item.block?.layout?.alignY];
          return <div key={item.block.id} className={`min-w-0 ${BLOCK_WIDTH_CLASS[blockWidth(item.block)]}`} style={alignSelf ? { alignSelf } : undefined}>{item.node}</div>;
        })}
      </div>
    );
  });
}

