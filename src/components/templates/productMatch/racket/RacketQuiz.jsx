"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiCheck, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import ProductSearchBox from "@/components/templates/productMatch/ProductSearchBox";
import { THUMB_INPUT_CLASS } from "@/components/features/filters/PriceRangeFilter";
import useDragClickGuard from "@/hooks/useDragClickGuard";
// گام‌ها و برچسبِ اولویت‌ها از prop ورودیِ quiz می‌آیند، نه از پرسشنامهٔ یک
// ورزشِ خاص — همین باعث می‌شود این کامپوننت برای تنیس و پدل یکی باشد.
import { dragScrollLeft, scrollStepIntoView } from "@/lib/racketMatch/stepNavScroll";
import {
  activeStepIndex,
  isAnswered,
  nextUnansweredId,
  progressPercent,
  resolveActive,
  shouldAutoAdvance,
  siblingId,
  slideDirection,
  stepSummary,
} from "@/lib/racketMatch/quizNavigation";

/* ─────────────────────────── انیمیشن ─────────────────────────── */

// در RTL «جلو» یعنی حرکت به سمت چپ: پرسشِ تازه از چپ می‌آید و قبلی به راست می‌رود
const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? -48 : 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? 48 : -48, opacity: 0 }),
};

/* ─────────────────────────── اجزای کوچک ─────────────────────────── */

function OptionButton({ selected, order, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "relative w-full rounded-[var(--radius)] border-2 px-4 py-3.5 text-right text-sm font-bold transition-all duration-200 " +
        (selected
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-[var(--color-primary)]/50 hover:bg-neutral-50")
      }
    >
      <span className="block pl-8">{children}</span>
      {selected && order !== undefined && (
        <span className="absolute left-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-primary)] text-[11px] font-extrabold text-white">
          {Number(order + 1).toLocaleString("fa-IR")}
        </span>
      )}
      {selected && order === undefined && (
        <FiCheck
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-primary)]"
          size={18}
        />
      )}
    </button>
  );
}

/**
 * اسلایدرِ دوسَرهٔ بودجه — همان الگو و همان سرهای فیلترِ قیمتِ صفحهٔ ورزش
 * (THUMB_INPUT_CLASS مشترک است)، با یک تفاوتِ عمدی: این‌جا دامنه دقیقاً کف و
 * سقفِ قیمتِ راکت‌های موجود است و سنتینلِ «۰ یعنی بدون سقف» وجود ندارد، چون
 * کاربر نباید بتواند بازه‌ای بیرون از قیمت‌های واقعیِ فروشگاه انتخاب کند.
 *
 * تا وقتی هیچ سری جابه‌جا نشده، پاسخی ثبت نمی‌شود و گام «اختیاری» می‌ماند.
 */
function PriceRangeSlider({ bounds, value, onChange }) {
  // یک راکت یا همه هم‌قیمت ⇒ اسلایدر معنایی ندارد و ‎pct هم تقسیم‌بر‌صفر می‌شود
  if (!bounds || !(bounds.max > bounds.min)) {
    return (
      <p className="rounded-[var(--radius)] bg-neutral-50 px-3 py-4 text-center text-xs font-bold text-neutral-400">
        بازهٔ قیمتی برای فیلتر کردن در دسترس نیست.
      </p>
    );
  }

  const { min: lo, max: hi } = bounds;
  const clamp = (n) => Math.min(Math.max(n, lo), hi);
  const selMin = clamp(Number(value?.min) || lo);
  const selMax = clamp(Number(value?.max) || hi);

  // پلهٔ اعشاری تا دامنه دقیقاً به ۱۰۰ پله بخش شود و هر دو سر بتوانند به انتهای
  // واقعیِ دامنه برسند (همان قراردادِ فیلترِ قیمتِ سایت)
  const step = Math.max(1, (hi - lo) / 100);
  const pct = (n) => ((n - lo) / (hi - lo)) * 100;
  const money = (n) => Math.round(n).toLocaleString("fa-IR");

  return (
    <div>
      <div
        dir="rtl"
        className="mb-4 flex items-center justify-between gap-2 text-sm font-extrabold text-[var(--color-primary)]"
      >
        <span>{money(selMin)}</span>
        <span className="text-xs font-bold text-neutral-400">تا</span>
        <span>{money(selMax)}</span>
      </div>

      <div className="relative h-4" dir="rtl">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-neutral-100" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--color-primary)]"
          style={{ right: `${pct(selMin)}%`, width: `${Math.max(0, pct(selMax) - pct(selMin))}%` }}
        />
        <input
          type="range"
          dir="rtl"
          min={lo}
          max={hi}
          step={step}
          value={selMin}
          aria-label="حداقل قیمت (تومان)"
          onChange={(event) =>
            onChange({ min: Math.round(Math.min(Number(event.target.value), selMax)), max: Math.round(selMax) })
          }
          className={THUMB_INPUT_CLASS}
          // با چسبیدنِ هر دو سر به یک انتها، سرِ کف باید بالاتر بماند تا گرفتنی باشد
          style={{ zIndex: selMin > lo + (hi - lo) / 2 ? 5 : 3 }}
        />
        <input
          type="range"
          dir="rtl"
          min={lo}
          max={hi}
          step={step}
          value={selMax}
          aria-label="حداکثر قیمت (تومان)"
          onChange={(event) =>
            onChange({ min: Math.round(selMin), max: Math.round(Math.max(Number(event.target.value), selMin)) })
          }
          className={THUMB_INPUT_CLASS}
          style={{ zIndex: 4 }}
        />
      </div>

      <div dir="rtl" className="mt-2 flex justify-between text-[10px] font-bold text-neutral-400">
        <span>{money(lo)}</span>
        <span>{money(hi)}</span>
      </div>
    </div>
  );
}

/**
 * نوارِ گام‌ها. هر گام علاوه بر شماره، **پاسخِ داده‌شده** را هم نشان می‌دهد تا
 * کاربر بدون کلیک روی تک‌تکِ گام‌ها ببیند چه گفته است — و با یک کلیک بتواند
 * هر پاسخِ قبلی را عوض کند.
 *
 * نوار مثل اسلایدرهای دیگر سایت کشیدنی است (useDragClickGuard) و اسکرول‌بارش
 * پنهان است (کلاسِ مشترکِ no-scrollbar). با هر تغییرِ گامِ فعال — چه با پاسخ‌دادن
 * و رفتن به جلو، چه با کلیک روی گامی عقب‌تر — چیپِ همان گام به وسط می‌آید.
 */
function StepNav({ steps, answers, activeId, onJump }) {
  // شروعِ درگ: وضعیتِ اسکرول و جهتِ واقعیِ عنصر ذخیره می‌شود
  const dragStateRef = useRef(null);

  const navRef = useDragClickGuard({
    onDragStart: (event) => {
      // لمس را خودِ مرورگر با اسکرولِ بومی و اینرسی مدیریت می‌کند؛ فقط ماوس
      // به درگِ دستی نیاز دارد (همان قراردادِ SeriesSlider)
      if (event.pointerType !== "mouse") return;
      const element = navRef.current;
      if (!element) return;
      // جهتِ چیدمان لازم نیست: ردیابیِ یک‌به‌یک در RTL و LTR یک فرمول دارد
      dragStateRef.current = {
        element,
        startX: event.clientX,
        startScrollLeft: element.scrollLeft,
      };
      element.classList.add("cursor-grabbing");
    },
    onDragMove: (event) => {
      const state = dragStateRef.current;
      if (!state) return;
      event.preventDefault();
      state.element.scrollLeft = dragScrollLeft({
        startScrollLeft: state.startScrollLeft,
        startX: state.startX,
        currentX: event.clientX,
      });
    },
    onDragEnd: () => {
      const state = dragStateRef.current;
      if (!state) return;
      state.element.classList.remove("cursor-grabbing");
      dragStateRef.current = null;
    },
  });

  // گامِ فعال همیشه در دید بماند — مستقل از اینکه از کجا به آن رسیده‌ایم
  useEffect(() => {
    scrollStepIntoView(navRef.current, activeId);
  }, [activeId, navRef]);

  return (
    <nav
      ref={navRef}
      aria-label="گام‌های پرسشنامه"
      className="no-scrollbar -mx-1 flex cursor-grab gap-2 overflow-x-auto px-1 pb-2"
    >
      {steps.map((step, index) => {
        const summary = stepSummary(step, answers);
        const active = step.id === activeId;
        return (
          <button
            key={step.id}
            type="button"
            data-step-id={step.id}
            onClick={() => onJump(step.id)}
            aria-current={active ? "step" : undefined}
            className={
              "flex min-w-[7.5rem] shrink-0 flex-col gap-0.5 rounded-[var(--radius)] border-2 px-3 py-2 text-right transition-all " +
              (active
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                : summary
                  ? "border-transparent bg-neutral-100 hover:border-[var(--color-primary)]/40"
                  : "border-transparent bg-neutral-50 hover:border-neutral-300")
            }
          >
            <span className="flex items-center gap-1.5">
              <span
                className={
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold " +
                  (summary
                    ? "bg-[var(--color-primary)] text-white"
                    : active
                      ? "bg-[var(--color-primary)]/30 text-[var(--color-primary)]"
                      : "bg-neutral-300 text-white")
                }
              >
                {summary ? <FiCheck size={9} /> : Number(index + 1).toLocaleString("fa-IR")}
              </span>
              <span className="truncate text-[10px] font-bold text-neutral-500">{step.title}</span>
            </span>
            <span
              className={
                "truncate text-[11px] font-extrabold " +
                (summary ? "text-[var(--color-primary)]" : "text-neutral-300")
              }
            >
              {summary || (step.optional ? "اختیاری" : "—")}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ─────────────────────────── پرسشنامه ─────────────────────────── */

/**
 * پرسشنامهٔ گام‌به‌گام: هر بار فقط **یک** پرسش دیده می‌شود، بالای بخش، با نوارِ
 * گام‌ها بالای آن. هر گام همیشه با یک کلیک قابل بازگشت و ویرایش است و نتایج
 * پس از هر پاسخ بی‌درنگ به‌روز می‌شود.
 */
export default function RacketQuiz({
  quiz,
  answers,
  onAnswer,
  categoryId,
  categoryTitle,
  priceBounds,
}) {
  const { visibleSteps, priorityLabels } = quiz;
  const steps = visibleSteps(answers);

  // شناسه *و* شمارهٔ گامِ فعال با هم نگه داشته می‌شوند: شناسه مرجعِ اصلی است و
  // شماره فقط لنگرِ بازگشت، برای وقتی که خودِ آن گام از فهرست حذف می‌شود.
  const [active, setActive] = useState(() => ({ id: steps[0]?.id ?? null, index: 0 }));
  const [direction, setDirection] = useState(1);

  const { id: safeActiveId, index: activeIndex } = resolveActive(steps, active.id, active.index);
  const activeStep = steps[activeIndex] || null;

  const jump = (nextId, nextDirection) => {
    const index = activeStepIndex(steps, nextId);
    if (index === -1) return;
    setDirection(nextDirection ?? slideDirection(activeIndex, index));
    setActive({ id: nextId, index });
  };

  const goTo = (nextId) => {
    if (!nextId || nextId === safeActiveId) return;
    jump(nextId);
  };

  // فهرستِ گام‌ها ممکن است با همین پاسخ عوض شود، پس روی فهرستِ تازه حساب می‌کنیم
  const advanceFrom = (next, fromId) => {
    const nextSteps = visibleSteps(next);
    const target = nextUnansweredId(nextSteps, next, fromId);
    const index = activeStepIndex(nextSteps, target);
    if (target && index !== -1) {
      setDirection(1);
      setActive({ id: target, index });
    }
  };

  const handleSingle = (step, value) => {
    const next = { ...answers, [step.id]: value };
    onAnswer(next);
    advanceFrom(next, step.id);
  };

  const handleMulti = (step, value) => {
    const current = answers[step.id] || [];
    const exists = current.includes(value);
    let updated;
    if (exists) {
      updated = current.filter((item) => item !== value);
    } else if (step.max && current.length >= step.max) {
      // با پر بودنِ ظرفیت، قدیمی‌ترین انتخاب کنار می‌رود تا ترتیبِ اهمیت حفظ شود
      updated = [...current.slice(1), value];
    } else {
      updated = [...current, value];
    }
    const next = { ...answers, [step.id]: updated };
    onAnswer(next);
    // با پرشدنِ ظرفیتِ انتخاب (مثلاً هر سه اولویت) مثل بقیهٔ گام‌ها خودکار جلو می‌رویم
    if (shouldAutoAdvance(step, updated, exists)) advanceFrom(next, step.id);
  };

  if (!activeStep) return null;

  const previousId = siblingId(steps, safeActiveId, -1);
  const nextId = siblingId(steps, safeActiveId, 1);
  const answered = isAnswered(activeStep, answers);
  const percent = progressPercent(steps, answers);
  // گام‌های چندانتخابی و ورودی‌محور خودکار جلو نمی‌روند؛ کاربر خودش ادامه می‌دهد
  const needsManualNext = Boolean(activeStep.multi || activeStep.type);

  return (
    <section className="rounded-[var(--radius)] border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
      <StepNav steps={steps} answers={answers} activeId={safeActiveId} onJump={goTo} />

      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
        <motion.div
          className="h-full rounded-full bg-[var(--color-primary)]"
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={safeActiveId}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <h3 className="text-base font-extrabold text-neutral-900 md:text-lg">
            {activeStep.title}
          </h3>
          {activeStep.hint && (
            <p className="mt-1.5 text-xs leading-6 text-neutral-500">{activeStep.hint}</p>
          )}

          <div className="mt-4">
            <StepBody
              step={activeStep}
              answers={answers}
              onAnswer={onAnswer}
              onSingle={handleSingle}
              onMulti={handleMulti}
              onAdvance={() => jump(nextUnansweredId(steps, answers, activeStep.id), 1)}
              categoryId={categoryId}
              categoryTitle={categoryTitle}
              priceBounds={priceBounds}
              priorityLabels={priorityLabels}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      <footer className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
        <button
          type="button"
          onClick={() => goTo(previousId)}
          disabled={!previousId}
          className="flex items-center gap-1 rounded-[var(--radius)] px-3 py-2 text-xs font-bold text-neutral-500 transition-colors hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <FiChevronRight size={14} />
          مرحله قبل
        </button>

        <span className="text-[11px] font-bold text-neutral-400">
          گام {Number(activeIndex + 1).toLocaleString("fa-IR")} از{" "}
          {Number(steps.length).toLocaleString("fa-IR")}
        </span>

        <button
          type="button"
          onClick={() => goTo(nextId)}
          disabled={!nextId}
          className={
            "flex items-center gap-1 rounded-[var(--radius)] px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-30 " +
            (needsManualNext && answered
              ? "bg-[var(--color-primary)] text-white hover:opacity-90"
              : "text-neutral-500 hover:text-[var(--color-primary)]")
          }
        >
          {answered || !activeStep.optional ? "مرحله بعد" : "رد کردن"}
          <FiChevronLeft size={14} />
        </button>
      </footer>
    </section>
  );
}

/* ─────────────────────────── بدنهٔ هر گام ─────────────────────────── */

function StepBody({
  step,
  answers,
  onAnswer,
  onSingle,
  onMulti,
  onAdvance,
  categoryId,
  categoryTitle,
  priceBounds,
  priorityLabels,
}) {

  if (step.type === "product-search") {
    return answers.currentRacket ? (
      <div className="flex items-center gap-3 rounded-[var(--radius)] border border-neutral-200 bg-neutral-50 p-2.5">
        <img
          src={answers.currentRacket.mainImage || "/placeholder.png"}
          alt={answers.currentRacket.name}
          className="h-12 w-12 shrink-0 rounded object-contain"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-neutral-800">
          {answers.currentRacket.name}
        </span>
        <button
          type="button"
          onClick={() => onAnswer({ ...answers, currentRacket: null, currentFeedback: [] })}
          className="shrink-0 text-xs font-bold text-[var(--color-primary)]"
        >
          حذف
        </button>
      </div>
    ) : (
      <ProductSearchBox
        categoryId={categoryId}
        categoryTitle={categoryTitle}
        onSelect={(product) => {
          onAnswer({
            ...answers,
            currentRacket: {
              _id: String(product._id),
              name: product.name,
              mainImage: product.mainImage,
            },
          });
          onAdvance();
        }}
      />
    );
  }

  if (step.type === "price-range") {
    return (
      <PriceRangeSlider
        bounds={priceBounds}
        value={answers.priceRange}
        onChange={(priceRange) => onAnswer({ ...answers, priceRange })}
      />
    );
  }

  const selectedList = step.multi ? answers[step.id] || [] : null;

  return (
    <>
      <div className={"grid gap-2 " + (step.options.length > 4 ? "sm:grid-cols-2" : "grid-cols-1")}>
        {step.options.map((option) => {
          const selected = step.multi
            ? selectedList.includes(option.value)
            : answers[step.id] === option.value;
          return (
            <OptionButton
              key={option.value}
              selected={selected}
              order={step.multi && selected ? selectedList.indexOf(option.value) : undefined}
              onClick={() =>
                step.multi ? onMulti(step, option.value) : onSingle(step, option.value)
              }
            >
              {option.label}
            </OptionButton>
          );
        })}
      </div>

      {step.id === "priorities" && selectedList?.length > 0 && (
        <p className="mt-3 text-xs text-neutral-500">
          ترتیب فعلی:{" "}
          <span className="font-bold text-[var(--color-primary)]">
            {selectedList.map((key) => priorityLabels[key] || key).join(" ← ")}
          </span>
        </p>
      )}
    </>
  );
}
