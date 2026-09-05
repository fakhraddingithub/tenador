"use client";

import { useState } from "react";
import { FiArrowRight } from "react-icons/fi";
import { quizForCategory } from "@/lib/racketMatch/quizRegistry";
import MatchFlowChooser from "./MatchFlowChooser";
import MatchCategoryClient from "./MatchCategoryClient";
import RacketMatchClient from "./racket/RacketMatchClient";
import BestInCategorySection from "./BestInCategorySection";
import AttributeGuideSection from "./AttributeGuideSection";

/**
 * پوستهٔ صفحهٔ مچ برای دسته‌ای که هر دو مسیر را دارد (راکتِ تنیس و راکتِ پدل).
 *
 * ساختار عمداً این‌طور است که محتوای سئویی — تیتر، برترین‌های دسته و راهنمای
 * شاخص‌ها — همیشه رندر می‌شود، چه کاربر هنوز مسیری انتخاب نکرده باشد و چه در
 * میانهٔ یکی از دو مسیر باشد. انتخابِ مسیر فقط بخشِ میانی را عوض می‌کند.
 */
export default function MatchToolClient({ category, priceBounds }) {
  // کدام پرسشنامه؟ تنها جایی که این کامپوننت دربارهٔ ورزش چیزی می‌داند
  const quiz = quizForCategory(category);
  const [flow, setFlow] = useState(null);
  // محصولی که کاربر از «برترین‌های دسته» انتخاب کرده تا مسیرِ ارتقا با آن شروع شود
  const [seedProduct, setSeedProduct] = useState(null);

  const fullTitle = [category.title, category.sportTitle].filter(Boolean).join(" ");

  const backToChooser = () => {
    setFlow(null);
    setSeedProduct(null);
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] font-sans text-[var(--color-text)]">
      <div className="mx-auto max-w-7xl px-4 py-10 pb-24">
        <header className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-bold text-[var(--color-primary)] md:text-4xl">
            {fullTitle} مناسب خود را پیدا کنید
          </h1>
          <p className="mx-auto max-w-3xl leading-7 text-neutral-500">
            {flow === null
              ? "بگویید از کجا شروع کنیم: از صفر دنبال راکت مناسب می‌گردید، یا راکتی دارید و می‌خواهید نسخهٔ بهترش را پیدا کنید؟"
              : flow === "quiz"
                ? "به چند پرسش کوتاه دربارهٔ بازی‌تان پاسخ دهید تا سه راکتِ متناسب با سطح، سبک و توان بدنی شما را به‌صورت زنده پیدا کنیم."
                : "راکت فعلی‌تان را انتخاب کنید و با جابه‌جا کردن شاخص‌ها، نزدیک‌ترین گزینه‌های بهتر را ببینید."}
          </p>
        </header>

        {flow !== null && (
          <button
            type="button"
            onClick={backToChooser}
            className="mb-5 flex items-center gap-1.5 rounded-[var(--radius)] border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-600 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <FiArrowRight size={14} />
            بازگشت به انتخاب مسیر
          </button>
        )}

        {flow === null && <MatchFlowChooser onChoose={setFlow} />}

        {flow === "quiz" && quiz && (
          <RacketMatchClient category={category} quiz={quiz} priceBounds={priceBounds} />
        )}

        {flow === "optimize" && (
          // key تضمین می‌کند با انتخابِ یک محصولِ پایهٔ تازه، ابزار از نو با همان
          // محصول شروع شود — دقیقاً مثل رفتارِ قبلیِ همین ابزار
          <MatchCategoryClient
            key={seedProduct?._id || "blank"}
            category={category}
            initialBaseProduct={seedProduct}
            embedded
          />
        )}

        <BestInCategorySection
          categoryId={category._id}
          onSelectProduct={(product) => {
            setSeedProduct(product);
            setFlow("optimize");
            if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
        <AttributeGuideSection category={category} />
      </div>
    </div>
  );
}
