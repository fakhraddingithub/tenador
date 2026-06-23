/**
 * ContactSection — چیدمانِ دوستونی: اطلاعات تماس (پنل تأکیدی) + فرم.
 */
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import Reveal from "./Reveal";
import ContactForm from "./ContactForm";

export default function ContactSection({ block, accent }) {
  const info = [
    block.phone && { icon: Phone, label: "تلفن", value: block.phone, dir: "ltr" },
    block.email && { icon: Mail, label: "ایمیل", value: block.email, dir: "ltr" },
    block.address && { icon: MapPin, label: "نشانی", value: block.address },
    block.hours && { icon: Clock, label: "ساعات پاسخ‌گویی", value: block.hours },
  ].filter(Boolean);

  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* اطلاعات تماس */}
          <Reveal y={28}>
            <div
              className="relative h-full rounded-[6px] p-8 sm:p-10 overflow-hidden text-white"
              style={{
                background: `linear-gradient(150deg, ${accent}, color-mix(in srgb, ${accent} 55%, #111))`,
              }}
            >
              {/* بافتِ تزئینی */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                  backgroundSize: "22px 22px",
                }}
              />
              <div className="relative">
                {block.eyebrow ? (
                  <span className="text-sm font-black text-white/80">
                    {block.eyebrow}
                  </span>
                ) : null}
                <h2 className="text-2xl sm:text-3xl font-black mt-2 mb-3">
                  {block.title}
                </h2>
                {block.subtitle ? (
                  <p className="text-white/80 leading-8 mb-8">{block.subtitle}</p>
                ) : null}

                <div className="space-y-5">
                  {info.map((it, i) => {
                    const Icon = it.icon;
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-[6px] bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                          <Icon size={20} />
                        </div>
                        <div>
                          <p className="text-xs text-white/60 font-bold mb-0.5">
                            {it.label}
                          </p>
                          <p
                            className="font-black"
                            dir={it.dir || "rtl"}
                            style={it.dir === "ltr" ? { textAlign: "right" } : null}
                          >
                            {it.value}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Reveal>

          {/* فرم */}
          <Reveal y={28} delay={0.1}>
            <div className="h-full bg-white rounded-[6px] p-7 sm:p-9 border border-gray-100 shadow-xl">
              <ContactForm accent={accent} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
