import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  DRAG_THRESHOLD_PX,
  STEP_SCROLL_OPTIONS,
  dragScrollLeft,
  isDragGesture,
  scrollStepIntoView,
  stepChipSelector,
} from "../src/lib/racketMatch/stepNavScroll.js";

/* ─────────────── تفکیکِ درگ از کلیک ─────────────── */

test("جابه‌جاییِ کوچک هنوز کلیک است، نه درگ", () => {
  assert.equal(isDragGesture(0, 0), false, "بدون حرکت = کلیک");
  assert.equal(isDragGesture(3, 2), false, "لرزشِ دست نباید درگ حساب شود");
  assert.equal(isDragGesture(DRAG_THRESHOLD_PX - 1, 0), false);
});

test("عبور از آستانه، تعامل را به درگ تبدیل می‌کند", () => {
  assert.equal(isDragGesture(DRAG_THRESHOLD_PX, 0), true);
  assert.equal(isDragGesture(40, 0), true, "کشیدنِ افقی");
  assert.equal(isDragGesture(0, 40), true, "کشیدنِ عمودی هم درگ است");
  assert.equal(isDragGesture(-40, 0), true, "جهتِ منفی هم درگ است");
});

test("آستانه قابل تنظیم است اما پیش‌فرضش با اسلایدرهای سایت یکی است", () => {
  assert.equal(DRAG_THRESHOLD_PX, 6);
  assert.equal(isDragGesture(10, 0, 20), false);
  assert.equal(isDragGesture(30, 0, 20), true);
});

/* ─────────────── جهتِ کشیدن: محتوا باید دنبالِ انگشت بیاید ─────────────── */

/**
 * مدلِ یک ظرفِ اسکرول‌شونده.
 *
 * جای فیزیکیِ لبهٔ محتوا نسبت به پنجرهٔ دید برابرِ `-scrollLeft` است. این رابطه
 * در LTR و RTL یکی است؛ تنها فرقِ RTL مبدأِ محور است (از صفر شروع می‌شود و منفی
 * می‌رود) نه جهتِ آن. پس تست به‌جای بازنویسیِ فرمول، همان چیزی را می‌سنجد که
 * کاربر می‌بیند: محتوا به کدام سمت رفت.
 */
function drag({ startScrollLeft, from, to }) {
  const after = dragScrollLeft({ startScrollLeft, startX: from, currentX: to });
  return { scrollLeft: after, contentMoved: -after - -startScrollLeft };
}

test("کشیدن به راست، محتوا را به همان اندازه به راست می‌برد", () => {
  // LTR: از وسطِ محور شروع می‌کنیم تا جا برای حرکت در هر دو سو باشد
  const ltr = drag({ startScrollLeft: 100, from: 200, to: 250 });
  assert.equal(ltr.contentMoved, 50, "۵۰ پیکسل کشیدن = ۵۰ پیکسل جابه‌جاییِ محتوا به راست");

  // RTL: مبدأ صفر است و محور به سمتِ منفی می‌رود، اما رفتار باید یکسان باشد
  const rtl = drag({ startScrollLeft: -100, from: 200, to: 250 });
  assert.equal(rtl.contentMoved, 50);
  assert.equal(
    ltr.contentMoved,
    rtl.contentMoved,
    "جهتِ چیدمان نباید حسِ کشیدن را عوض کند",
  );
});

test("کشیدن به چپ، محتوا را به همان اندازه به چپ می‌برد", () => {
  const ltr = drag({ startScrollLeft: 100, from: 200, to: 150 });
  assert.equal(ltr.contentMoved, -50);

  const rtl = drag({ startScrollLeft: -100, from: 200, to: 150 });
  assert.equal(rtl.contentMoved, -50);
});

test("محتوا هرگز در خلافِ جهتِ اشاره‌گر حرکت نمی‌کند", () => {
  // همان باگی که گزارش شد: کشیدن به چپ، نوار را به راست می‌برد
  for (const startScrollLeft of [0, 120, -120]) {
    for (const delta of [-80, -25, -6, 6, 25, 80]) {
      const { contentMoved } = drag({ startScrollLeft, from: 300, to: 300 + delta });
      assert.equal(
        Math.sign(contentMoved),
        Math.sign(delta),
        `جهتِ حرکت با delta=${delta} و scrollLeft=${startScrollLeft} معکوس شد`,
      );
      assert.equal(Math.abs(contentMoved), Math.abs(delta), "ردیابی باید یک‌به‌یک باشد");
    }
  }
});

test("بدونِ حرکت، اسکرول تکان نمی‌خورد", () => {
  assert.equal(dragScrollLeft({ startScrollLeft: 77, startX: 300, currentX: 300 }), 77);
  assert.equal(dragScrollLeft({ startScrollLeft: -77, startX: 300, currentX: 300 }), -77);
});

/* ─────────────── بردنِ گامِ فعال به دید ─────────────── */

/** کمترین DOM ممکن: فقط چیزی که scrollStepIntoView واقعاً صدا می‌زند */
function fakeNav(stepIds) {
  const calls = [];
  const chips = new Map(
    stepIds.map((id) => [
      id,
      {
        id,
        scrollIntoView(options) {
          calls.push({ id, options });
        },
      },
    ]),
  );
  return {
    calls,
    querySelector(selector) {
      const match = selector.match(/\[data-step-id="([^"]+)"\]/);
      return match ? (chips.get(match[1]) ?? null) : null;
    },
  };
}

test("گامِ فعال هم در حرکت رو به جلو و هم رو به عقب به وسط می‌آید", () => {
  const nav = fakeNav(["age", "level", "strength", "swingSpeed", "grip"]);

  // جلو رفتن با پاسخ‌دادن
  assert.equal(scrollStepIntoView(nav, "level"), true);
  assert.equal(scrollStepIntoView(nav, "grip"), true);
  // برگشتن با کلیک روی گامِ قبلی
  assert.equal(scrollStepIntoView(nav, "age"), true);

  assert.deepEqual(
    nav.calls.map((call) => call.id),
    ["level", "grip", "age"],
    "هر تغییرِ گام باید یک اسکرول بدهد، در هر دو جهت",
  );
  for (const call of nav.calls) {
    assert.equal(call.options.behavior, "smooth");
    assert.equal(call.options.inline, "center");
    assert.equal(call.options.block, "nearest", "نباید صفحه را عمودی بپراند");
  }
});

test("گامِ ناموجود یا ورودیِ نامعتبر، خطا نمی‌دهد", () => {
  const nav = fakeNav(["age"]);
  assert.equal(scrollStepIntoView(nav, "does-not-exist"), false);
  assert.equal(scrollStepIntoView(null, "age"), false);
  assert.equal(scrollStepIntoView(nav, null), false);
  assert.equal(nav.calls.length, 0);
});

test("شناسهٔ گام قبل از رفتن به سلکتور اعتبارسنجی می‌شود", () => {
  assert.equal(stepChipSelector("swingSpeed"), '[data-step-id="swingSpeed"]');
  assert.equal(stepChipSelector('x"] , [data-step-id="y'), null);
  assert.equal(stepChipSelector(""), null);
  assert.ok(Object.isFrozen(STEP_SCROLL_OPTIONS));
});

/* ─────────────── قراردادِ کامپوننت ─────────────── */

test("نوارِ گام‌ها اسکرول‌بارِ پنهان، کرسرِ کشیدن و data-step-id دارد", async () => {
  const source = await readFile(
    new URL("../src/components/templates/productMatch/racket/RacketQuiz.jsx", import.meta.url),
    "utf8",
  );

  // کلاسِ مشترکِ پنهان‌کردنِ اسکرول‌بار در globals.css — نه راه‌حلِ تازه
  assert.ok(source.includes("no-scrollbar"));
  assert.ok(source.includes("cursor-grab"));
  assert.ok(source.includes("data-step-id={step.id}"));

  // درگ از هوکِ مشترکِ سایت می‌آید، نه منطقِ دست‌ساز
  assert.ok(source.includes("useDragClickGuard"));
  assert.ok(source.includes("dragScrollLeft"));
  // اسکرولِ خودکار با تغییرِ گامِ فعال اجرا می‌شود
  assert.ok(/useEffect\(\s*\(\)\s*=>\s*\{\s*scrollStepIntoView/.test(source));
  assert.ok(/\}, \[activeId/.test(source), "افکت باید به گامِ فعال وابسته باشد");
});

test("کلاسِ no-scrollbar واقعاً در استایل‌های سراسری تعریف شده است", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.ok(css.includes(".no-scrollbar::-webkit-scrollbar"));
  assert.ok(css.includes("scrollbar-width: none"));
});
