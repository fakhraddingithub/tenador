/**
 * بررسیِ ماشینِ حالتِ startVisiblePoll بدون jest/jsdom.
 * (تستِ jest فعلاً قابل اجرا نیست چون tests/setup.js در مخزن وجود ندارد.)
 *
 * اجرا: node scripts/check-visible-poll.mjs
 */
import assert from "node:assert/strict";
import { startVisiblePoll } from "../src/hooks/useVisiblePoll.js";

// document قلابی — فقط چیزی که هوک لمس می‌کند
const listeners = new Set();
globalThis.document = {
  hidden: false,
  addEventListener: (t, fn) => t === "visibilitychange" && listeners.add(fn),
  removeEventListener: (t, fn) => t === "visibilitychange" && listeners.delete(fn),
};
const setHidden = (v) => {
  document.hidden = v;
  for (const fn of listeners) fn();
};

const calls = [];
const tick = () => new Promise((r) => setTimeout(r, 35));
const stop = startVisiblePoll((silent) => calls.push(silent), 10);

// واکشی اولیه باید بی‌صدا نباشد تا خطا در UI دیده شود
assert.deepEqual(calls, [false], "واکشی اولیه باید silent=false باشد");

await tick();
const whileVisible = calls.length;
assert.ok(whileVisible > 1, "تبِ visible باید poll کند");
assert.ok(calls.slice(1).every((s) => s === true), "poll باید بی‌صدا باشد");

// مخفی شدن: تایمر باید کاملاً متوقف شود
setHidden(true);
const atHide = calls.length;
await tick();
assert.equal(calls.length, atHide, "تبِ مخفی نباید هیچ درخواستی بزند");

// بازگشت: یک واکشیِ فوری + از سرگیریِ تایمر
setHidden(false);
assert.equal(calls.length, atHide + 1, "بازگشت به تب باید یک واکشیِ فوری بزند");
await tick();
assert.ok(calls.length > atHide + 2, "تایمر باید بعد از بازگشت از سر گرفته شود");

// cleanup: نه تایمر، نه لیسنر
stop();
const atStop = calls.length;
await tick();
assert.equal(calls.length, atStop, "بعد از cleanup نباید poll ادامه یابد");
assert.equal(listeners.size, 0, "لیسنر باید در cleanup حذف شود");

// مخفی‌بودن هنگام mount: نباید تایمری شروع شود
document.hidden = true;
const cold = [];
const stop2 = startVisiblePoll((s) => cold.push(s), 10);
await tick();
assert.deepEqual(cold, [false], "mount روی تبِ مخفی فقط واکشی اولیه دارد");
stop2();

console.log("✓ startVisiblePoll — همه‌ی بررسی‌ها موفق");
