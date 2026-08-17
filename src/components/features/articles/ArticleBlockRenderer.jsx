import Image from "next/image";
import Link from "next/link";
import { FiArrowLeft, FiInfo } from "react-icons/fi";
import ArticleCard from "@/components/features/articles/ArticleCard";
import ArticleNewsletterForm from "@/components/features/articles/ArticleNewsletterForm";
import { PublicProductGrid, PublicUsedProductGrid } from "@/components/features/articles/PublicProductGrid";
import { sanitizeArticleHtml } from "@/lib/sanitizeArticleHtml";

const ordered = (values, map) => (Array.isArray(values) ? values : values ? [values] : []).map((id) => map?.[String(id)]).filter(Boolean);
const blockSection = "my-9 scroll-mt-28";

// ——— استایلِ اختیاریِ سطحِ بلوک ———————————————————————————————————————
const SPACING_CSS = { none: "0rem", sm: "1rem", lg: "4rem" };

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
  return {
    // فاصله باید inline باشد: کلاسِ my-* تیلویند را نمی‌توان با کلاسِ دیگری
    // غلبه کرد، چون ترتیبِ استایل‌شیت تعیین‌کننده است نه ترتیبِ صفتِ class.
    spacing: gap === undefined ? null : { marginTop: gap, marginBottom: gap },
    text: style.textColor || null,
    background: style.background || null,
    accent: style.accent || null,
    tableVariant: style.tableVariant || "default",
  };
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

function normalizeHeadingLevels(blocks = []) {
  let previous = 1;
  return blocks.map((block) => {
    if (block.type !== "heading") return block;
    const requested = Number(String(block.data?.level || "h2").slice(1));
    previous = Math.max(2, Math.min(4, Number.isFinite(requested) ? requested : 2, previous + 1));
    return { ...block, data: { ...block.data, level: `h${previous}` } };
  });
}

export function articleHeadings(blocks = []) {
  return normalizeHeadingLevels(blocks).filter((block) => block.type === "heading" && block.data?.text).map((block) => ({ id: safeHeadingId(block), text: block.data.text, level: block.data.level || "h2" }));
}

function EntityCards({ title, items, kind, visuals }) {
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => {
          const meta = details[kind](item);
          return <Link key={item._id} href={meta.href} className="group flex min-h-32 flex-col items-center justify-center rounded-[var(--radius)] border border-black/10 bg-white p-5 text-center transition-[transform,border-color,box-shadow] motion-safe:hover:-translate-y-1 hover:border-[var(--color-primary)] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">{meta.image ? <span className="relative mb-3 block h-14 w-20"><Image src={meta.image} alt={item.title || item.name} fill sizes="80px" className="object-contain" /></span> : null}<strong className="text-sm text-gray-800 group-hover:text-[var(--color-primary)]">{item.title || item.name}</strong></Link>;
        })}
      </div>
    </section>
  );
}

function videoEmbed(url) {
  try {
    const value = new URL(url);
    if (value.hostname.includes("youtube.com")) return `https://www.youtube-nocookie.com/embed/${value.searchParams.get("v") || ""}`;
    if (value.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${value.pathname.slice(1)}`;
    if (value.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${value.pathname.split("/").filter(Boolean).pop()}`;
  } catch {}
  return null;
}

export default function ArticleBlockRenderer({ blocks = [], entities, preview = false }) {
  const maps = entities?.maps || {};
  const rate = entities?.rate || 1;
  return normalizeHeadingLevels(blocks).map((block) => {
    const data = block.data || {};
    const v = blockVisuals(block);
    if (block.type === "heading") {
      const level = ["h2", "h3", "h4"].includes(data.level) ? data.level : "h2";
      const Tag = level;
      const sizes = { h2: "text-2xl md:text-3xl", h3: "text-xl md:text-2xl", h4: "text-lg md:text-xl" };
      return <Tag key={block.id} id={safeHeadingId(block)} className={`${blockSection} ${sizes[level]} font-black leading-relaxed text-gray-900`} style={merge(v.spacing, padded(v), v.text && { color: v.text })}>{data.text}</Tag>;
    }
    if (block.type === "paragraph") return <p key={block.id} className="my-5 whitespace-pre-line text-[16px] leading-9 text-gray-700 md:text-[17px]" style={merge(v.spacing, padded(v), v.text && { color: v.text })}>{data.text}</p>;
    // تصویرِ محتوا با نسبتِ واقعیِ خودش رندر می‌شود: عرض/ارتفاعِ ذخیره‌شده فقط
    // جا را پیش از بارگذاری رزرو می‌کند (aspect-ratio: auto w/h) و پس از بارگذاری
    // نسبتِ ذاتیِ تصویر جای آن را می‌گیرد — پس هیچ بُرشی رخ نمی‌دهد.
    if (block.type === "image" && data.url) return <figure key={block.id} className={blockSection} style={v.spacing || undefined}><Image src={data.url} alt={data.alt || "تصویر مقاله"} width={data.width || 1600} height={data.height || 900} sizes="(max-width: 1024px) 100vw, 820px" className="h-auto w-full rounded-[var(--radius)]" />{data.caption ? <figcaption className="mt-3 text-center text-xs leading-6 text-gray-500">{data.caption}</figcaption> : null}</figure>;
    if (block.type === "gallery") {
      const images = (data.images || []).map((image) => typeof image === "string" ? { url: image, alt: "" } : image).filter((image) => image.url);
      return images.length ? <div key={block.id} className={`${blockSection} grid grid-cols-2 gap-3`} style={v.spacing || undefined}>{images.map((image, index) => <figure key={`${image.url}-${index}`} className={`relative overflow-hidden rounded-[var(--radius)] bg-gray-100 ${index === 0 && images.length % 2 ? "col-span-2 aspect-[16/8]" : "aspect-square"}`}><Image src={image.url} alt={image.alt || data.alt || "تصویر گالری مقاله"} fill sizes="(max-width: 768px) 50vw, 400px" className="object-cover" loading="lazy" />{image.caption ? <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-xs text-white">{image.caption}</figcaption> : null}</figure>)}</div> : null;
    }
    if (block.type === "video" && data.url) {
      const embed = videoEmbed(data.url);
      return <figure key={block.id} className={blockSection} style={v.spacing || undefined}><div className="aspect-video overflow-hidden rounded-[var(--radius)] bg-black">{embed ? <iframe src={embed} title={data.title || "ویدئوی مقاله"} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" /> : <video src={data.url} controls preload="metadata" className="h-full w-full" />}</div>{data.title ? <figcaption className="mt-3 text-center text-xs text-gray-500">{data.title}</figcaption> : null}</figure>;
    }
    if (block.type === "quote") return <blockquote key={block.id} className={`${blockSection} border-r-4 border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_6%,white)] px-6 py-5 text-lg font-bold leading-9 text-gray-800`} style={merge(v.spacing, v.accent && { borderRightColor: v.accent }, v.background && { backgroundColor: v.background }, v.text && { color: v.text })}><p>{data.text}</p>{data.author ? <footer className="mt-3 text-sm font-normal text-gray-500">— {data.author}</footer> : null}</blockquote>;
    if (block.type === "divider") return <hr key={block.id} className="my-10 border-gray-200" style={merge(v.spacing, v.accent && { borderColor: v.accent })} />;
    if (block.type === "button" && data.href) {
      // رنگِ دلخواه، حالتِ hover کلاس‌ها را کنار می‌گذارد (inline همیشه برنده است)
      // که رفتارِ قابلِ پیش‌بینی‌تری است تا ترکیبِ نیمه‌کاره‌ی دو رنگ.
      const label = v.text || (v.accent ? readableOn(v.accent) : null);
      return <div key={block.id} className={blockSection} style={v.spacing || undefined}><Link href={data.href} className={`inline-flex items-center gap-2 rounded-[var(--radius)] border-2 px-6 py-3 font-bold transition-colors ${data.style === "outline" ? "border-black/20 hover:bg-gray-900 hover:text-white" : data.style === "secondary" ? "border-[var(--color-secondary)] bg-[var(--color-secondary)] text-gray-900" : "border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:bg-transparent hover:text-[var(--color-primary)]"}`} style={merge(v.accent && { backgroundColor: v.accent, borderColor: v.accent }, label && { color: label })}>{data.label || "مشاهده"}<FiArrowLeft /></Link></div>;
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
      return products.length ? <section key={block.id} className={blockSection} style={v.spacing || undefined}>{data.title ? <h2 className="mb-5 text-xl font-black" style={v.text ? { color: v.text } : undefined}>{data.title}</h2> : null}<PublicProductGrid products={products} rate={rate} /></section> : null;
    }
    if (["latestProducts", "bestSellers", "amazingOffers"].includes(block.type)) {
      const products = entities?.dynamicProducts?.[String(block.id)] || [];
      return products.length ? <section key={block.id} className={blockSection} style={v.spacing || undefined}><h2 className="mb-5 text-xl font-black" style={v.text ? { color: v.text } : undefined}>{data.title}</h2><PublicProductGrid products={products} rate={rate} /></section> : null;
    }
    if (["brandSlider", "collectionSlider", "categorySlider", "sportSlider"].includes(block.type)) {
      const config = { brandSlider: ["brands", data.brands], collectionSlider: ["series", data.collections], categorySlider: ["categories", data.categories], sportSlider: ["sports", data.sports] }[block.type];
      return <EntityCards key={block.id} title={data.title} kind={config[0]} items={ordered(config[1], maps[config[0]])} visuals={v} />;
    }
    if (block.type === "usedProducts") return <section key={block.id} className={blockSection} style={v.spacing || undefined}>{data.title ? <h2 className="mb-5 text-xl font-black" style={v.text ? { color: v.text } : undefined}>{data.title}</h2> : null}<PublicUsedProductGrid products={ordered(data.products, maps.usedProducts)} /></section>;
    if (block.type === "relatedArticles") {
      const articles = ordered(data.articles, maps.articles).filter((item) => item.category?.status !== "archived");
      return articles.length ? <section key={block.id} className={blockSection} style={v.spacing || undefined}><h2 className="mb-5 text-xl font-black" style={v.text ? { color: v.text } : undefined}>{data.title || "مقالات مرتبط"}</h2><div className="grid gap-4 md:grid-cols-2">{articles.map((article) => <ArticleCard key={article._id} article={article} />)}</div></section> : null;
    }
    if (block.type === "newsletterCta") return <section key={block.id} className={`${blockSection} rounded-[var(--radius)] bg-[#20232a] p-6 text-white md:p-8`} style={merge(v.spacing, v.background && { backgroundColor: v.background }, v.text && { color: v.text })}><h2 className="text-2xl font-black">{data.title || "عضویت در خبرنامه تنادور"}</h2><p className="mt-2 leading-8 text-gray-300" style={v.text ? { color: v.text } : undefined}>{data.description || "جدیدترین راهنماها و پیشنهادهای تنادور را دریافت کنید."}</p>{preview ? <div className="mt-4 inline-flex rounded-[var(--radius)] bg-[var(--color-secondary)] px-5 py-2.5 text-sm font-bold text-gray-900" style={v.accent ? { backgroundColor: v.accent, color: readableOn(v.accent) } : undefined}>{data.buttonLabel || "\u0639\u0636\u0648\u06cc\u062a"}</div> : <ArticleNewsletterForm buttonLabel={data.buttonLabel} />}</section>;
    if (block.type === "customHtml" && data.html) return <div key={block.id} className={`${blockSection} leading-8 text-gray-700`} style={merge(v.spacing, padded(v), v.text && { color: v.text })} dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(data.html) }} />;
    return null;
  });
}

