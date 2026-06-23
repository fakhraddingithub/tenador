/**
 * بلوک‌های محتوایی صفحات اطلاع‌رسانی (سرور-کامپوننت‌های بدون hook).
 * بخش‌های تعاملی (FAQ، قوانین، تماس) در فایل‌های جداگانه‌ی «use client» هستند.
 *
 * هر بلوک یک رنگِ تأکید (accent) از صفحه می‌گیرد و انیمیشنِ ورودِ اسکرول را از
 * طریق <Reveal> اعمال می‌کند.
 */
import Reveal from "./Reveal";
import { getIcon } from "./iconMap";
import ZoomableImage from "./ZoomableImage";

/* ─────────────── سرفصلِ مشترکِ بخش‌ها ─────────────── */
export function SectionHeading({ eyebrow, title, subtitle, accent, center = true }) {
  return (
    <div className={`mb-12 ${center ? "text-center mx-auto max-w-2xl" : "max-w-2xl"}`}>
      {eyebrow ? (
        <span
          className="inline-block text-sm font-black tracking-wide mb-3"
          style={{ color: accent }}
        >
          {eyebrow}
        </span>
      ) : null}
      {title ? (
        <h2 className="text-2xl sm:text-4xl font-black text-[var(--color-text)] leading-tight">
          {title}
        </h2>
      ) : null}
      {subtitle ? (
        <p className="mt-4 text-base sm:text-lg text-gray-500 leading-relaxed">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function Container({ children, className = "" }) {
  return (
    <div className={`max-w-6xl mx-auto px-5 sm:px-8 ${className}`}>{children}</div>
  );
}

/* ─────────────── متنِ غنی ─────────────── */
export function RichText({ block, accent }) {
  const paragraphs = String(block.body || "").split("\n").filter(Boolean);
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={block.eyebrow}
            title={block.title}
            accent={accent}
          />
        </Reveal>
        <Reveal delay={0.1} className="max-w-3xl mx-auto space-y-5">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-lg leading-9 text-gray-600 text-center">
              {p}
            </p>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

/* ─────────────── تصویر + متن ─────────────── */
export function ImageText({ block, accent, zoom = false }) {
  const left = block.imageSide === "left";
  const paragraphs = String(block.body || "").split("\n").filter(Boolean);
  const imgCls =
    "relative w-full h-[280px] sm:h-[440px] object-cover rounded-[6px] shadow-2xl";
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal
            y={32}
            className={`relative ${left ? "lg:order-1" : "lg:order-2"}`}
          >
            <div
              className="absolute -inset-3 rounded-[6px] opacity-30 blur-2xl"
              style={{ background: accent }}
            />
            {zoom && block.image ? (
              <ZoomableImage
                src={block.image}
                alt={block.title || ""}
                className={imgCls}
              />
            ) : (
              <img
                src={block.image || "/images/default-sport.jpg"}
                alt={block.title || ""}
                className={imgCls}
              />
            )}
          </Reveal>
          <Reveal
            delay={0.1}
            className={left ? "lg:order-2" : "lg:order-1"}
          >
            {block.eyebrow ? (
              <span
                className="inline-block text-sm font-black tracking-wide mb-3"
                style={{ color: accent }}
              >
                {block.eyebrow}
              </span>
            ) : null}
            {block.title ? (
              <h2 className="text-2xl sm:text-4xl font-black text-[var(--color-text)] leading-tight mb-5">
                {block.title}
              </h2>
            ) : null}
            <div className="space-y-4">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-lg leading-9 text-gray-600">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* ─────────────── کارت‌ها ─────────────── */
export function Cards({ block, accent }) {
  const cols = block.columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section
      className="py-16 sm:py-24"
      style={{
        background:
          "color-mix(in srgb, var(--color-primary) 4%, var(--color-background))",
      }}
    >
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={block.eyebrow}
            title={block.title}
            subtitle={block.subtitle}
            accent={accent}
          />
        </Reveal>
        <div className={`grid grid-cols-1 ${cols} gap-6`}>
          {(block.items || []).map((item, i) => {
            const Icon = getIcon(item.icon);
            return (
              <Reveal key={i} delay={i * 0.08} y={28}>
                <div className="group h-full bg-white rounded-[6px] p-7 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div
                    className="w-14 h-14 rounded-[6px] flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: `color-mix(in srgb, ${accent} 12%, white)`,
                      color: accent,
                    }}
                  >
                    <Icon size={26} strokeWidth={2} />
                  </div>
                  <h3 className="text-lg font-black text-[var(--color-text)] mb-2.5">
                    {item.title}
                  </h3>
                  <p className="text-gray-500 leading-7 text-[15px]">{item.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ─────────────── خط زمانی ─────────────── */
export function Timeline({ block, accent }) {
  return (
    <section className="py-16 sm:py-24">
      <Container className="max-w-3xl">
        <Reveal>
          <SectionHeading
            eyebrow={block.eyebrow}
            title={block.title}
            accent={accent}
          />
        </Reveal>
        {/* خط عمودی سمت راست (RTL) */}
        <div className="relative pr-10 sm:pr-14">
          <div
            className="absolute top-2 bottom-2 right-3 sm:right-5 w-[2px] rounded-[6px]"
            style={{ background: `color-mix(in srgb, ${accent} 35%, #e5e7eb)` }}
          />
          <div className="space-y-10">
            {(block.items || []).map((item, i) => (
              <Reveal key={i} delay={i * 0.06} y={20} className="relative">
                {/* نقطه‌ی روی خط */}
                <span
                  className="absolute -right-[34px] sm:-right-[46px] top-1 w-5 h-5 rounded-full ring-4 ring-[var(--color-background)] flex items-center justify-center"
                  style={{ background: accent }}
                >
                  <span className="w-2 h-2 rounded-full bg-white/90" />
                </span>
                <div>
                  {item.date ? (
                    <span
                      className="inline-block text-xs font-black px-2.5 py-1 rounded-[6px] mb-2"
                      style={{
                        background: `color-mix(in srgb, ${accent} 12%, white)`,
                        color: accent,
                      }}
                    >
                      {item.date}
                    </span>
                  ) : null}
                  <h3 className="text-lg font-black text-[var(--color-text)] mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-gray-500 leading-7">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ─────────────── گام‌ها ─────────────── */
export function Steps({ block, accent, zoom = false }) {
  return (
    <section
      className="py-16 sm:py-24"
      style={{
        background:
          "color-mix(in srgb, var(--color-primary) 4%, var(--color-background))",
      }}
    >
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={block.eyebrow}
            title={block.title}
            subtitle={block.subtitle}
            accent={accent}
          />
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {(block.items || []).map((item, i) => (
            <Reveal key={i} delay={i * 0.08} y={28}>
              <div className="relative h-full bg-white rounded-[6px] p-7 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
                {/* شماره‌ی بزرگ */}
                <span
                  className="block text-5xl font-black leading-none mb-4"
                  style={{ color: `color-mix(in srgb, ${accent} 22%, white)` }}
                >
                  {toFa(i + 1)}
                </span>
                {item.image ? (
                  zoom ? (
                    <ZoomableImage
                      src={item.image}
                      alt={item.title || ""}
                      className="w-full h-36 object-cover rounded-[6px] mb-4"
                    />
                  ) : (
                    <img
                      src={item.image}
                      alt={item.title || ""}
                      className="w-full h-36 object-cover rounded-[6px] mb-4"
                    />
                  )
                ) : null}
                <h3 className="text-lg font-black text-[var(--color-text)] mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-500 leading-7 text-[15px]">{item.body}</p>

                {/* رابطِ پیکانی بین گام‌ها (دسکتاپ) */}
                {i < (block.items || []).length - 1 ? (
                  <span
                    className="hidden lg:block absolute top-10 -left-4 text-2xl font-black"
                    style={{ color: `color-mix(in srgb, ${accent} 45%, white)` }}
                  >
                    ←
                  </span>
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ─────────────── جدول ─────────────── */
export function TableSection({ block, accent }) {
  return (
    <section className="py-16 sm:py-24">
      <Container className="max-w-4xl">
        <Reveal>
          <SectionHeading
            eyebrow={block.eyebrow}
            title={block.title}
            accent={accent}
          />
        </Reveal>
        <Reveal delay={0.1}>
          <div className="overflow-x-auto rounded-[6px] border border-gray-100 shadow-sm">
            <table className="w-full text-right border-collapse min-w-[480px]">
              <thead>
                <tr style={{ background: `color-mix(in srgb, ${accent} 10%, white)` }}>
                  {(block.columns || []).map((col, i) => (
                    <th
                      key={i}
                      className="px-5 py-4 text-sm font-black"
                      style={{ color: accent }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(block.rows || []).map((row, r) => (
                  <tr
                    key={r}
                    className="border-t border-gray-100 even:bg-gray-50/60"
                  >
                    {row.map((cell, c) => (
                      <td
                        key={c}
                        className="px-5 py-4 text-[15px] text-gray-600 font-medium"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* ─────────────── نقل‌قول ─────────────── */
export function Quote({ block, accent }) {
  return (
    <section className="py-16 sm:py-28">
      <Container className="max-w-4xl">
        <Reveal>
          <figure className="relative text-center">
            <span
              className="block text-8xl font-serif leading-none mb-2 select-none"
              style={{ color: `color-mix(in srgb, ${accent} 30%, white)` }}
              aria-hidden="true"
            >
              「
            </span>
            <blockquote className="text-2xl sm:text-3xl font-black text-[var(--color-text)] leading-snug">
              {block.text}
            </blockquote>
            {block.author ? (
              <figcaption className="mt-6 text-gray-500 font-bold">
                {block.author}
                {block.role ? (
                  <span className="text-gray-400 font-medium">
                    {" "}
                    — {block.role}
                  </span>
                ) : null}
              </figcaption>
            ) : null}
          </figure>
        </Reveal>
      </Container>
    </section>
  );
}

/* ─────────────── روش‌های پرداخت (کارت‌های ویژه) ─────────────── */
export function PaymentMethods({ block, accent }) {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={block.eyebrow}
            title={block.title}
            subtitle={block.subtitle}
            accent={accent}
          />
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(block.items || []).map((item, i) => {
            const Icon = getIcon(item.icon);
            return (
              <Reveal key={i} delay={i * 0.08} y={28}>
                <div
                  className="group relative h-full rounded-[6px] p-[1.5px] overflow-hidden transition-transform duration-300 hover:-translate-y-1"
                  style={{
                    background: `linear-gradient(140deg, ${accent}, color-mix(in srgb, ${accent} 20%, white))`,
                  }}
                >
                  <div className="h-full bg-white rounded-[6px] p-7">
                    {item.badge ? (
                      <span
                        className="absolute top-5 left-5 text-[11px] font-black px-2.5 py-1 rounded-[6px] text-white"
                        style={{ background: accent }}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                    <div
                      className="w-14 h-14 rounded-[6px] flex items-center justify-center mb-5 text-white transition-transform duration-300 group-hover:scale-110"
                      style={{ background: accent }}
                    >
                      <Icon size={26} strokeWidth={2} />
                    </div>
                    <h3 className="text-lg font-black text-[var(--color-text)] mb-2.5">
                      {item.title}
                    </h3>
                    <p className="text-gray-500 leading-7 text-[15px]">
                      {item.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* تبدیل عدد لاتین به فارسی */
function toFa(n) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
}
