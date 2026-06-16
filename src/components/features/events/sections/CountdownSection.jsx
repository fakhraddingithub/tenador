import EventCountdown from "../EventCountdown";

export default function CountdownSection({ config = {}, event }) {
  const endDate = config.endDate || event?.endDate;
  const { title = "زمان باقی‌مانده", style = "cards" } = config;

  return (
    <section className="py-12 px-6">
      <div className="max-w-3xl mx-auto text-center">
        {title && (
          <p
            className="text-xs font-black uppercase tracking-[0.25em] mb-6 opacity-60"
            style={{ color: "var(--event-text, #fff)" }}
          >
            {title}
          </p>
        )}
        <EventCountdown endDate={endDate} style={style} />
      </div>
    </section>
  );
}
