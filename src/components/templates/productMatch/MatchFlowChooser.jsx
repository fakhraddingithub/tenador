"use client";

import { motion } from "framer-motion";
import { FiCompass, FiRefreshCw, FiArrowLeft } from "react-icons/fi";

/**
 * انتخابِ مسیر در ابزار مچ.
 *
 * دو کارِ کاملاً متفاوت که نباید در هم بروند:
 *   ۱) هنوز راکتی ندارم / نمی‌دانم چه می‌خواهم ← پرسشنامهٔ گام‌به‌گام
 *   ۲) راکت دارم و می‌خواهم بهترش کنم      ← همان ابزارِ ارتقای قبلی
 *
 * کارت‌ها عمداً هم‌وزن‌اند؛ هیچ‌کدام مسیرِ «پیش‌فرض» نیست.
 */

const CARDS = [
  {
    id: "quiz",
    icon: FiCompass,
    title: "پیدا کردن راکت ایده‌آل من",
    body: "به چند پرسش کوتاه دربارهٔ سطح بازی، سبک بازی و انتظاراتتان پاسخ دهید؛ در پایان سه راکتِ مناسب به شما پیشنهاد می‌شود.",
    cta: "شروع پرسش‌نامه",
  },
  {
    id: "optimize",
    icon: FiRefreshCw,
    title: "تغییر راکت فعلی من",
    body: "راکت فعلی‌تان را مشخص کنید و انتخاب کنید چه چیزی را می‌خواهید بهتر کنید: قدرت، کنترل، راحتی، مانورپذیری یا اسپین.",
    cta: "ارتقای راکت من",
  },
];

export default function MatchFlowChooser({ onChoose }) {
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
      {CARDS.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.button
            key={card.id}
            type="button"
            onClick={() => onChoose(card.id)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.06 }}
            className="group flex h-full flex-col rounded-[var(--radius)] border-2 border-neutral-200 bg-white p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-primary)] hover:shadow-xl"
          >
            <span className="mb-4 flex h-12 w-12 self-center items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-colors group-hover:bg-[var(--color-primary)] group-hover:text-white">
              <Icon size={22} />
            </span>

            <span className="mb-2 text-lg font-extrabold text-neutral-900">{card.title}</span>

            <span className="mb-6 flex-1 text-[13px] leading-7 text-neutral-500">{card.body}</span>

            <span className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius)] bg-[var(--color-primary)] py-2.5 text-sm font-extrabold text-white shadow-md shadow-[var(--color-primary)]/25 transition-all group-hover:shadow-lg group-hover:shadow-[var(--color-primary)]/40">
              {card.cta}
              <FiArrowLeft size={14} />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
