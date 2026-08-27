import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { visibleSteps } from "../src/lib/racketMatch/questions.js";
import {
  activeStepIndex,
  isAnswered,
  nextUnansweredId,
  progressPercent,
  resolveActive,
  siblingId,
  slideDirection,
  stepSummary,
} from "../src/lib/racketMatch/quizNavigation.js";

/* ─────────────── خلاصهٔ پاسخ‌ها در نوارِ گام‌ها ─────────────── */

test("هر گامِ پاسخ‌داده‌شده خلاصهٔ خوانا نشان می‌دهد، نه فقط شماره", () => {
  const answers = {
    level: "consistent",
    style: "spin",
    priorities: ["spin", "control"],
    grip: "L2",
    priceRange: { min: 5000000, max: 20000000 },
    currentRacket: { _id: "x", name: "راکت تنیس ویلسون Blade 100" },
  };
  const steps = visibleSteps(answers);
  const byId = (id) => steps.find((step) => step.id === id);

  assert.equal(
    stepSummary(byId("level"), answers),
    "از ته زمین یکدست رَلی می‌زنم و توپ را کنترل می‌کنم",
  );
  assert.equal(stepSummary(byId("style"), answers), "اسپین‌محور — با چرخش زیاد بازی می‌کنم");
  assert.equal(stepSummary(byId("priorities"), answers), "اسپین، کنترل");
  assert.equal(stepSummary(byId("grip"), answers), "L2");
  assert.equal(stepSummary(byId("currentRacket"), answers), "راکت تنیس ویلسون Blade 100");
  assert.ok(stepSummary(byId("priceRange"), answers).includes("تا"));

  // گامِ بی‌پاسخ خلاصه‌ای ندارد
  assert.equal(stepSummary(byId("swingSpeed"), answers), null);
  assert.equal(isAnswered(byId("swingSpeed"), answers), false);
});

/* ─────────────── جابه‌جاییِ غیرخطی بین گام‌ها ─────────────── */

test("پرش به گامِ دلخواه، شماره و جهتِ انیمیشن را درست نگه می‌دارد", () => {
  const answers = { level: "consistent" };
  const steps = visibleSteps(answers);

  const gripIndex = activeStepIndex(steps, "grip");
  const levelIndex = activeStepIndex(steps, "level");
  assert.ok(gripIndex > levelIndex);

  assert.equal(slideDirection(levelIndex, gripIndex), 1, "پرش به جلو");
  assert.equal(slideDirection(gripIndex, levelIndex), -1, "پرش به عقب");
  // پرش به خودِ همان گام نباید جهتِ نامعتبر بدهد
  assert.equal(slideDirection(gripIndex, gripIndex), 1);
});

test("اگر گامِ فعال از فهرست حذف شود، کاربر بیرون نمی‌افتد", () => {
  // «ایرادِ راکت فعلی» فقط وقتی هست که راکتی انتخاب شده باشد
  const withRacket = { level: "consistent", currentRacket: { _id: "x", name: "راکت" } };
  const stepsWith = visibleSteps(withRacket);
  assert.ok(stepsWith.some((step) => step.id === "currentFeedback"));

  const activeIndex = activeStepIndex(stepsWith, "currentFeedback");
  const resolvedWhilePresent = resolveActive(stepsWith, "currentFeedback", activeIndex);
  assert.equal(resolvedWhilePresent.id, "currentFeedback");

  // کاربر راکت فعلی را حذف می‌کند ← آن گام ناپدید می‌شود
  const withoutRacket = { level: "consistent" };
  const stepsWithout = visibleSteps(withoutRacket);
  assert.ok(!stepsWithout.some((step) => step.id === "currentFeedback"));

  const fallback = resolveActive(stepsWithout, "currentFeedback", activeIndex);
  assert.ok(fallback.id, "باید به یک گامِ موجود برگردد");
  assert.ok(stepsWithout.some((step) => step.id === fallback.id));
  assert.equal(fallback.index, activeStepIndex(stepsWithout, fallback.id));
});

test("گامِ «قد» با تغییرِ سن ظاهر و ناپدید می‌شود بدون خراب‌کردنِ شماره‌ها", () => {
  const junior = visibleSteps({ age: "under10" });
  const adult = visibleSteps({ age: "adult" });
  assert.ok(junior.some((step) => step.id === "height"));
  assert.ok(!adult.some((step) => step.id === "height"));

  // گامِ فعالِ «سطح» در هر دو فهرست هست؛ فقط شماره‌اش عوض می‌شود
  const inJunior = resolveActive(junior, "level", activeStepIndex(junior, "level"));
  const inAdult = resolveActive(adult, "level", inJunior.index);
  assert.equal(inAdult.id, "level");
  assert.equal(inAdult.index, activeStepIndex(adult, "level"));
  assert.notEqual(inJunior.index, inAdult.index);
});

test("گامِ بعدی همیشه اولین گامِ بی‌پاسخ است", () => {
  const answers = { age: "adult", level: "consistent" };
  const steps = visibleSteps(answers);
  // «سطح» پاسخ دارد، پس از «سن» مستقیم به «توان بدنی» می‌رویم
  assert.equal(nextUnansweredId(steps, answers, "age"), "strength");

  const more = { ...answers, strength: "athletic" };
  assert.equal(nextUnansweredId(visibleSteps(more), more, "level"), "swingSpeed");
});

test("لبه‌های فهرست، گامِ قبلی/بعدی ندارند", () => {
  const steps = visibleSteps({ age: "adult" });
  assert.equal(siblingId(steps, steps[0].id, -1), null);
  assert.equal(siblingId(steps, steps[steps.length - 1].id, 1), null);
  assert.equal(siblingId(steps, steps[0].id, 1), steps[1].id);
});

test("درصدِ پیشرفت با پاسخ‌ها بالا می‌رود", () => {
  const none = visibleSteps({});
  assert.equal(progressPercent(none, {}), 0);

  const some = { age: "adult", level: "consistent", strength: "athletic" };
  const percent = progressPercent(visibleSteps(some), some);
  assert.ok(percent > 0 && percent < 100);
});

/* ─────────────── چیدمانِ سه کارتِ نتیجه ─────────────── */

test("سه کارتِ نتیجه در یک ردیف می‌نشینند، نه تمام‌عرض و روی‌هم", async () => {
  const source = await readFile(
    new URL("../src/components/templates/productMatch/racket/RacketResults.jsx", import.meta.url),
    "utf8",
  );

  const grid = source.match(/export const RESULTS_GRID = "([^"]+)"/)?.[1];
  assert.ok(grid, "قرارداد چیدمان باید یک ثابتِ صریح باشد");

  assert.ok(grid.includes("grid-cols-1"), "موبایل: تک‌ستونی");
  assert.ok(grid.includes("sm:grid-cols-2"), "تبلت: دوستونی");
  assert.ok(grid.includes("lg:grid-cols-3"), "دسکتاپ: هر سه کارت در یک ردیف");
  assert.ok(!/space-y-\d/.test(grid), "نباید دوباره به چیدمانِ روی‌هم برگردد");

  // هم اسکلتون و هم نتایج از همان شبکه استفاده می‌کنند تا جای کارت‌ها نپرد
  assert.equal(source.match(/\{RESULTS_GRID/g)?.length ?? 0, 1);
  assert.ok(source.includes("RESULTS_GRID +"));
  // عرضِ کل پنل مهار شده تا کارت‌ها هم‌اندازهٔ کارت‌های محصولِ بقیهٔ سایت بمانند
  assert.ok(source.includes("max-w-5xl"));
});
