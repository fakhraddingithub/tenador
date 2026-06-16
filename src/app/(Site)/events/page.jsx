import { getActiveEvents } from "base/services/event.service";
import EventCard from "@/components/features/events/EventCard";
import Link from "next/link";

export const revalidate = 300;

export const metadata = {
  title: "رویدادها و کمپین‌ها | تنادور",
  description: "آخرین رویدادهای فروشگاه ورزشی تنادور — فروش ویژه، کمپین‌های فصلی و تجربه‌های منحصر‌به‌فرد",
};

export default async function EventsPage() {
  const events = await getActiveEvents();

  return (
    <main
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg, #080808 0%, #111111 100%)" }}
      dir="rtl"
    >
      {/* Hero header */}
      <section className="relative overflow-hidden pt-24 pb-16 px-6">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(170,71,37,0.18) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#aa4725] mb-4">
            Tenador Events
          </p>
          <h1
            className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight"
            style={{ fontFamily: "'Lalezar', 'Vazirmatn', sans-serif" }}
          >
            رویدادها و کمپین‌ها
          </h1>
          <p className="text-sm text-white/50 max-w-xl mx-auto leading-7">
            تجربه‌های خرید منحصربه‌فرد با هویت بصری مستقل — هر رویداد دنیایی جداگانه است
          </p>
        </div>
      </section>

      {/* Events grid */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        {events.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4" aria-hidden="true">🎪</div>
            <p className="text-white/30 font-bold text-sm">
              در حال حاضر رویداد فعالی وجود ندارد
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white border border-white/10 hover:border-[#aa4725] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0d]"
            >
              بازگشت به فروشگاه
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {events.map((event, i) => (
              <EventCard key={event._id} event={event} index={i} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
