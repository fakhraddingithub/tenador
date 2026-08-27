"use client";

import { useEffect, useRef, useState } from "react";
import { FiZap } from "react-icons/fi";
import RacketQuiz from "./RacketQuiz";
import RacketResults from "./RacketResults";
import { hasEnoughForPreview } from "@/lib/racketMatch/questions";

const DEBOUNCE_MS = 350;

/**
 * ابزارِ تطبیقِ راکت تنیس.
 *
 * چیدمان: پرسشنامه بالا (هر بار یک پرسش) و سه کارتِ پیشنهاد در یک ردیف زیرِ آن.
 * هیچ دکمهٔ «جستجو»یی وجود ندارد: به‌محض اینکه اطلاعات برای یک پیشنهادِ حداقل
 * «متوسط» کافی شود، نتیجه ظاهر می‌شود و با هر تغییر پاسخ — با تأخیرِ کوتاه —
 * دوباره محاسبه می‌شود.
 *
 * تیتر، «برترین‌های دسته» و «راهنمای شاخص‌ها» را والد (MatchToolClient) رندر
 * می‌کند تا در هر دو مسیرِ صفحه یک‌بار و همیشه دیده شوند.
 */
export default function RacketMatchClient({ category }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef(null);

  const ready = hasEnoughForPreview(answers);

  useEffect(() => {
    // تا وقتی اطلاعات برای یک پیشنهادِ حداقل «متوسط» کافی نشده، اصلاً درخواستی
    // زده نمی‌شود. پاک‌کردنِ نتیجهٔ قبلی هم این‌جا لازم نیست — پایین‌تر با ready
    // فیلتر می‌شود، تا از رندرِ آبشاری جلوگیری شود.
    if (!ready) return undefined;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/match/racket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            answers: { ...answers, currentRacketId: answers.currentRacket?._id || null },
          }),
        });
        if (!response.ok) throw new Error("match failed");
        const data = await response.json();
        setResult(data);
      } catch (error) {
        if (error.name !== "AbortError") console.error("Racket match error:", error);
      } finally {
        // با لغو شدنِ درخواست، درخواستِ بعدی خودش loading را مدیریت می‌کند
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [answers, ready]);

  // اگر کاربر پاسخی را پس بگیرد و اطلاعات دیگر کافی نباشد، نتیجهٔ کهنه نمایش داده نمی‌شود
  const visibleResult = ready ? result : null;
  const resultCount = visibleResult
    ? [visibleResult.best, ...(visibleResult.alternatives || [])].filter(Boolean).length
    : 0;

  return (
    <>
      {/* پرسشنامه بالای بخش می‌ماند تا پرسشِ فعال همیشه در دید باشد */}
      <div className="mx-auto max-w-3xl">
        <RacketQuiz
          answers={answers}
          onAnswer={setAnswers}
          categoryId={category._id}
          categoryTitle={category.title}
        />
      </div>

      <div ref={resultsRef} className="mt-8 scroll-mt-6">
        <RacketResults
          result={visibleResult}
          loading={ready && loading}
          ready={ready}
          hint={visibleResult?.confidence?.prompt}
        />
      </div>

      {/* نوارِ چسبانِ موبایل — میان‌بُر به بخشِ نتایج */}
      {resultCount > 0 && (
        <button
          type="button"
          onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] py-3 text-sm font-extrabold text-white shadow-lg lg:hidden"
        >
          <FiZap size={16} />
          {Number(resultCount).toLocaleString("fa-IR")} پیشنهاد آماده است
        </button>
      )}
    </>
  );
}
