export default function RichTextSection({ config = {} }) {
  const { title, content = "", align = "right" } = config;
  if (!content) return null;

  return (
    <section className="py-10 px-6">
      <div className="max-w-3xl mx-auto">
        {title && (
          <h2
            className="text-xl font-black mb-4"
            style={{
              color: "var(--event-text, #fff)",
              fontFamily: "var(--event-heading-font, Vazirmatn)",
              textAlign: align,
            }}
          >
            {title}
          </h2>
        )}
        <div
          className="prose prose-invert max-w-none text-sm leading-8 opacity-80"
          style={{
            color: "var(--event-text-muted, rgba(255,255,255,0.65))",
            textAlign: align,
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </section>
  );
}
