export default function AnnouncementSection({ config = {} }) {
  const { text = "", icon = "📢", bgColor, textColor } = config;
  if (!text) return null;

  return (
    <section className="px-6 py-4">
      <div
        className="max-w-7xl mx-auto rounded-xl px-5 py-4 flex items-center gap-3 text-sm font-bold leading-6"
        style={{
          background: bgColor || "var(--event-primary, #aa4725)",
          color: textColor || "#fff",
        }}
        role="status"
        aria-live="polite"
      >
        {icon && (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{text}</span>
      </div>
    </section>
  );
}
