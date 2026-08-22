import test from "node:test";
import assert from "node:assert/strict";
import {
  filterVisibleSelections,
  isNodeVisible,
  resolveOrderedSelections,
  resolveVisibleSteps,
  selectionsToMap,
  validateNodeConditions,
} from "../src/lib/flowConditions.js";

/**
 * قراردادِ نمایشِ شرطیِ مراحل.
 * مثالِ مرجع: مرحله‌ی «زه‌کشی» فقط وقتی دیده شود که در مرحله‌ی «انتخاب زه»
 * محصولی انتخاب شده باشد — ولی هیچ‌چیزِ مخصوصِ زه در کد نیست.
 */

const stringsStep = { id: "strings", type: "category", label: "انتخاب زه" };
const stringingStep = {
  id: "stringing",
  type: "service",
  label: "زه‌کشی",
  visibleWhen: { mode: "all", conditions: [{ type: "answered", nodeId: "strings" }] },
};
const gripStep = { id: "grip", type: "category", label: "انتخاب گریپ" };
const steps = [stringsStep, stringingStep, gripStep];

const pickedString = {
  nodeId: "strings", nodeType: "category", selectedProductId: "p1",
};

test("مرحله‌ی بدون شرط همیشه دیده می‌شود (سازگاریِ عقب‌رو)", () => {
  assert.equal(isNodeVisible(stringsStep, {}), true);
  assert.equal(isNodeVisible({ id: "x" }, {}), true);
  assert.equal(isNodeVisible({ id: "x", visibleWhen: { conditions: [] } }, {}), true);

  const { visibleNodes } = resolveVisibleSteps([stringsStep, gripStep], {});
  assert.deepEqual(visibleNodes.map((n) => n.id), ["strings", "grip"]);
});

test("مرحله‌ی وابسته تا وقتی مرجع پاسخ نگرفته پنهان است", () => {
  const { visibleNodes } = resolveVisibleSteps(steps, {});
  assert.deepEqual(visibleNodes.map((n) => n.id), ["strings", "grip"]);
});

test("با انتخابِ محصول در مرحله‌ی مرجع، مرحله‌ی وابسته ظاهر می‌شود", () => {
  const { visibleNodes } = resolveVisibleSteps(steps, { strings: pickedString });
  assert.deepEqual(visibleNodes.map((n) => n.id), ["strings", "stringing", "grip"]);
});

test("نودِ خدمت وقتی پاسخ‌دار است که حداقل یک آپشن پیکربندی شده باشد", () => {
  const svc = (config) => ({ nodeId: "s", nodeType: "service", serviceConfig: config });
  const dep = { id: "d", visibleWhen: { conditions: [{ type: "answered", nodeId: "s" }] } };
  assert.equal(isNodeVisible(dep, { s: svc([]) }), false);
  assert.equal(isNodeVisible(dep, { s: svc([{ optionKey: "a", choiceKey: "b" }]) }), true);
});

test("شرطِ choiceEquals فقط با همان آپشن و همان گزینه برقرار است", () => {
  const dep = {
    id: "d",
    visibleWhen: {
      conditions: [{ type: "choiceEquals", nodeId: "s", optionKey: "logo", choiceKey: "yes" }],
    },
  };
  const sel = (config) => ({ s: { nodeId: "s", nodeType: "service", serviceConfig: config } });
  assert.equal(isNodeVisible(dep, sel([{ optionKey: "logo", choiceKey: "yes" }])), true);
  assert.equal(isNodeVisible(dep, sel([{ optionKey: "logo", choiceKey: "no" }])), false);
  assert.equal(isNodeVisible(dep, sel([{ optionKey: "other", choiceKey: "yes" }])), false);
  assert.equal(isNodeVisible(dep, {}), false);
});

test("mode=any یعنی کافی است یکی از شرط‌ها برقرار باشد", () => {
  const node = {
    id: "d",
    visibleWhen: {
      mode: "any",
      conditions: [{ type: "answered", nodeId: "a" }, { type: "answered", nodeId: "b" }],
    },
  };
  const answered = { nodeId: "a", nodeType: "category", selectedProductId: "p" };
  assert.equal(isNodeVisible(node, {}), false);
  assert.equal(isNodeVisible(node, { a: answered }), true);

  const all = { ...node, visibleWhen: { ...node.visibleWhen, mode: "all" } };
  assert.equal(isNodeVisible(all, { a: answered }), false);
});

test("زنجیره: پنهان شدنِ A مرحله‌ی وابسته به A را هم پنهان می‌کند", () => {
  const a = { id: "a", type: "category", label: "A" };
  const b = { id: "b", label: "B", visibleWhen: { conditions: [{ type: "answered", nodeId: "a" }] } };
  const c = { id: "c", label: "C", visibleWhen: { conditions: [{ type: "answered", nodeId: "b" }] } };

  // انتخابِ کهنه‌ی B وجود دارد ولی A پاسخ ندارد → هم B و هم C باید پنهان بمانند
  const stale = { b: { nodeId: "b", nodeType: "service", serviceConfig: [{ optionKey: "o", choiceKey: "k" }] } };
  const { visibleNodes, effectiveSelections } = resolveVisibleSteps([a, b, c], stale);
  assert.deepEqual(visibleNodes.map((n) => n.id), ["a"]);
  assert.deepEqual(Object.keys(effectiveSelections), [], "انتخابِ مرحله‌ی پنهان نباید منتقل شود");
});

test("انتخابِ مرحله‌ی پنهان از سبد/سفارش کنار گذاشته می‌شود", () => {
  const staleSelections = [
    { nodeId: "stringing", nodeType: "service", serviceConfig: [{ optionKey: "t", value: 24 }] },
    { nodeId: "grip", nodeType: "category", selectedProductId: "g1" },
  ];
  const { kept, dropped } = filterVisibleSelections(steps, staleSelections);
  assert.deepEqual(kept.map((s) => s.nodeId), ["grip"]);
  assert.deepEqual(dropped.map((s) => s.nodeId), ["stringing"]);
});

test("با پاسخِ مرجع، انتخابِ مرحله‌ی وابسته حفظ می‌شود", () => {
  const sels = [
    pickedString,
    { nodeId: "stringing", nodeType: "service", serviceConfig: [{ optionKey: "t", value: 24 }] },
  ];
  const { kept, dropped } = filterVisibleSelections(steps, sels);
  assert.deepEqual(kept.map((s) => s.nodeId), ["strings", "stringing"]);
  assert.deepEqual(dropped, []);
});

test("نوعِ شرطِ ناشناخته مرحله را بی‌صدا ناپدید نمی‌کند", () => {
  const node = { id: "d", visibleWhen: { conditions: [{ type: "someFutureType", nodeId: "a" }] } };
  assert.equal(isNodeVisible(node, {}), true);
});

test("selectionsToMap با ورودیِ خراب نمی‌شکند", () => {
  assert.deepEqual(selectionsToMap(null), {});
  assert.deepEqual(selectionsToMap([null, {}, { nodeId: "a" }]), { a: { nodeId: "a" } });
});

test("اعتبارسنجیِ تعریفِ شرط‌ها در پنل ادمین", () => {
  assert.deepEqual(validateNodeConditions(steps), []);
  assert.deepEqual(validateNodeConditions([{ id: "a" }, { id: "b" }]), []);

  const errs = validateNodeConditions([
    { id: "a", label: "A" },
    { id: "b", label: "B", visibleWhen: { conditions: [{ type: "answered", nodeId: "b" }] } },
    { id: "c", label: "C", visibleWhen: { conditions: [{ type: "answered", nodeId: "zzz" }] } },
    { id: "d", label: "D", visibleWhen: { conditions: [{ type: "nope", nodeId: "a" }] } },
    { id: "e", label: "E", visibleWhen: { conditions: [{ type: "answered" }] } },
    { id: "f", label: "F", visibleWhen: { conditions: [{ type: "choiceEquals", nodeId: "a" }] } },
  ]);
  assert.ok(errs.some((e) => /به خودش وابسته/.test(e)));
  assert.ok(errs.some((e) => /مراحلِ قبلی/.test(e)));
  assert.ok(errs.some((e) => /نوعِ شرط/.test(e)));
  assert.ok(errs.some((e) => /اشاره نمی‌کند/.test(e)));
  assert.ok(errs.some((e) => /آپشن و گزینه/.test(e)));
});

test("ارجاع به مرحله‌ی بعدی رد می‌شود (جلوگیری از حلقه)", () => {
  const errs = validateNodeConditions([
    { id: "first", label: "اول", visibleWhen: { conditions: [{ type: "answered", nodeId: "second" }] } },
    { id: "second", label: "دوم" },
  ]);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /مراحلِ قبلی/);
});

/* ─── «اجباری» تابعِ شرطِ نمایش است ─── */

const racketStep = { id: "racket", type: "category", label: "انتخاب راکت" };
const mandatoryStringing = {
  id: "stringing",
  type: "service",
  label: "زه‌کشی",
  required: true,
  servicePrice: 150000,
  visibleWhen: { conditions: [{ type: "answered", nodeId: "racket" }] },
};
const mandatorySteps = [racketStep, mandatoryStringing];

test("خدمتِ اجباریِ بی‌شرط همیشه ساخته می‌شود، حتی اگر کلاینت نفرستدش", () => {
  const out = resolveOrderedSelections([{ ...mandatoryStringing, visibleWhen: undefined }], []);
  assert.equal(out.length, 1);
  assert.equal(out[0].nodeId, "stringing");
  assert.deepEqual(out[0].serviceConfig, []);
});

test("خدمتِ اجباری با شرطِ برقرار ساخته می‌شود", () => {
  const out = resolveOrderedSelections(mandatorySteps, [
    { nodeId: "racket", nodeType: "category", selectedProductId: "p1" },
  ]);
  assert.deepEqual(out.map((s) => s.nodeId), ["racket", "stringing"]);
});

test("خدمتِ اجباری با شرطِ برقرارنشده نه ساخته می‌شود نه نگه داشته می‌شود", () => {
  // مشتری راکت انتخاب نکرده → زه‌کشی نباید اجباری شود
  assert.deepEqual(resolveOrderedSelections(mandatorySteps, []), []);

  // و حتی اگر کلاینت انتخابِ کهنه‌ی زه‌کشی را بفرستد، دور ریخته می‌شود
  const stale = resolveOrderedSelections(mandatorySteps, [
    { nodeId: "stringing", nodeType: "service", serviceConfig: [{ optionKey: "x", choiceKey: "y" }] },
  ]);
  assert.deepEqual(stale, []);
});

test("با عوض شدنِ انتخابِ قبلی، وضعیتِ اجباری هم عوض می‌شود", () => {
  const withRacket = [{ nodeId: "racket", nodeType: "category", selectedProductId: "p1" }];
  assert.equal(resolveOrderedSelections(mandatorySteps, withRacket).length, 2);

  // مشتری راکت را برمی‌دارد → زه‌کشی دیگر اجباری نیست و ساخته هم نمی‌شود
  const cleared = [{ nodeId: "racket", nodeType: "category", selectedProductId: null }];
  assert.deepEqual(
    resolveOrderedSelections(mandatorySteps, cleared).map((s) => s.nodeId),
    ["racket"]
  );
});

test("چند خدمتِ اجباری هرکدام یک بار و به ترتیبِ مراحل می‌آیند", () => {
  const many = [
    racketStep,
    { id: "s1", type: "service", label: "الف", required: true },
    { id: "s2", type: "service", label: "ب", required: true },
    { id: "s3", type: "service", label: "ج" }, // اختیاری → ساخته نمی‌شود
  ];
  const out = resolveOrderedSelections(many, [
    { nodeId: "racket", nodeType: "category", selectedProductId: "p1" },
  ]);
  assert.deepEqual(out.map((s) => s.nodeId), ["racket", "s1", "s2"]);
});

test("هزینه‌ی خدمت پاسخِ مشتری حساب نمی‌شود (شرطِ answered را فعال نمی‌کند)", () => {
  const feeOnly = {
    nodeId: "stringing",
    nodeType: "service",
    serviceConfig: [{ optionKey: "__serviceFee", label: "هزینه‌ی خدمت", priceModifier: 150000 }],
  };
  const dependent = {
    id: "later",
    type: "service",
    label: "بعدی",
    visibleWhen: { conditions: [{ type: "answered", nodeId: "stringing" }] },
  };
  const { visibleIds } = resolveVisibleSteps([mandatoryStringing, dependent], {
    stringing: feeOnly,
  });
  assert.equal(visibleIds.has("later"), false);
});
