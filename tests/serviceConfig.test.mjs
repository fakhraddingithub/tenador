import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_OPTION_KEY,
  getServiceOptions,
  isOnStep,
  resolveServiceSelection,
  serviceConfigSignature,
  validateServiceOptions,
} from "../src/lib/serviceConfig.js";

/**
 * قراردادِ قیمت و اعتبارسنجیِ پیکربندیِ خدمت.
 * این تست‌ها تضمین می‌کنند سرور هرگز قیمتِ کلاینت را نمی‌پذیرد و
 * دادهٔ قدیمی (serviceOptions) بدون مهاجرت کار می‌کند.
 */

const node = {
  id: "n1",
  type: "service",
  label: "زه‌کشی",
  serviceName: "زه‌کشی راکت",
  options: [
    {
      key: "gauge",
      title: "قطر زه",
      inputType: "choice",
      required: true,
      choices: [
        { key: "125", label: "1.25", priceModifier: 0 },
        { key: "130", label: "1.30", priceModifier: 20000, image: "https://img/1.png" },
      ],
    },
    {
      key: "tension",
      title: "تنش",
      inputType: "range",
      range: { min: 18, max: 30, step: 0.5, unit: "kg", basePrice: 5000, pricePerStep: 1000 },
    },
    {
      key: "logo",
      title: "لوگو",
      inputType: "choice",
      choices: [
        { key: "no", label: "خیر", priceModifier: 0 },
        { key: "yes", label: "بله", priceModifier: 30000 },
      ],
    },
  ],
};

const sel = (config) => ({ nodeId: "n1", nodeType: "service", serviceConfig: config });

test("قیمت از تعریفِ سرور خوانده می‌شود، نه از کلاینت", () => {
  const r = resolveServiceSelection(
    node,
    sel([
      { optionKey: "gauge", choiceKey: "130", priceModifier: -999999 },
      { optionKey: "logo", choiceKey: "yes" },
    ])
  );
  assert.deepEqual(r.errors, []);
  assert.equal(r.addonToman, 50000); // 20000 + 30000
});

test("چند آپشن با هم جمع می‌شوند و range پلکانی درست حساب می‌شود", () => {
  // 24 kg = 12 گام بالای 18 → 5000 + 12*1000 = 17000
  const r = resolveServiceSelection(
    node,
    sel([
      { optionKey: "gauge", choiceKey: "125" },
      { optionKey: "tension", value: 24 },
    ])
  );
  assert.deepEqual(r.errors, []);
  assert.equal(r.addonToman, 17000);
  assert.equal(r.config.find((c) => c.optionKey === "tension").label, "24 kg");
});

test("گامِ اعشاری پذیرفته می‌شود و مقدارِ خارج از گام رد می‌شود", () => {
  const ok = resolveServiceSelection(
    node,
    sel([{ optionKey: "gauge", choiceKey: "125" }, { optionKey: "tension", value: 24.5 }])
  );
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.config.find((c) => c.optionKey === "tension").label, "24.5 kg");

  const bad = resolveServiceSelection(
    node,
    sel([{ optionKey: "gauge", choiceKey: "125" }, { optionKey: "tension", value: 24.3 }])
  );
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /مضرب/);
});

test("مقدارِ خارج از بازه رد می‌شود", () => {
  for (const v of [17.5, 30.5, 1000]) {
    const r = resolveServiceSelection(
      node,
      sel([{ optionKey: "gauge", choiceKey: "125" }, { optionKey: "tension", value: v }])
    );
    assert.ok(r.errors.some((e) => /بین/.test(e)), `مقدار ${v} باید رد شود`);
  }
});

test("آپشن یا گزینه‌ی جعلی رد می‌شود و قیمتی اضافه نمی‌کند", () => {
  const fakeOption = resolveServiceSelection(
    node,
    sel([{ optionKey: "gauge", choiceKey: "125" }, { optionKey: "hacked", choiceKey: "x" }])
  );
  assert.equal(fakeOption.addonToman, 0);
  assert.ok(fakeOption.errors.length > 0);

  const fakeChoice = resolveServiceSelection(node, sel([{ optionKey: "gauge", choiceKey: "999" }]));
  assert.equal(fakeChoice.addonToman, 0);
  assert.ok(fakeChoice.errors.length > 0);
});

test("آپشنِ اجباریِ پیکربندی‌نشده خطا می‌دهد", () => {
  const r = resolveServiceSelection(node, sel([{ optionKey: "logo", choiceKey: "no" }]));
  assert.ok(r.errors.some((e) => /اجباری/.test(e)));
});

test("نودِ حذف‌شده خطا می‌دهد و قیمت صفر است", () => {
  const r = resolveServiceSelection(null, sel([{ optionKey: "gauge", choiceKey: "130" }]));
  assert.equal(r.addonToman, 0);
  assert.equal(r.errors.length, 1);
});

test("دادهٔ قدیمی (serviceOptions) بدون مهاجرت کار می‌کند", () => {
  const legacyNode = {
    id: "old",
    type: "service",
    label: "تنش",
    serviceOptions: [
      { label: "۲۵ کیلو", value: "25", priceModifier: 0 },
      { label: "۲۷ کیلو", value: "27", priceModifier: 15000 },
    ],
  };
  const opts = getServiceOptions(legacyNode);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].key, LEGACY_OPTION_KEY);

  // شکلِ قدیمیِ انتخاب در سبد
  const r = resolveServiceSelection(legacyNode, {
    nodeId: "old",
    nodeType: "service",
    serviceOption: { value: "27", label: "۲۷ کیلو", priceModifier: 999 },
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.addonToman, 15000);
  assert.equal(r.config[0].label, "۲۷ کیلو");
});

test("isOnStep با اعشار دچار خطای ممیز شناور نمی‌شود", () => {
  assert.equal(isOnStep(18.5, 18, 0.5), true);
  assert.equal(isOnStep(20.1, 18, 0.5), false);
  assert.equal(isOnStep(23, 18, 2.5), true); // 18 + 2*2.5
  assert.equal(isOnStep(5, 0, 0), true); // گامِ نامعتبر → آزاد
});

test("امضا مستقل از ترتیب است", () => {
  const a = serviceConfigSignature([
    { optionKey: "gauge", choiceKey: "125" },
    { optionKey: "tension", value: 24.5 },
  ]);
  const b = serviceConfigSignature([
    { optionKey: "tension", value: 24.5 },
    { optionKey: "gauge", choiceKey: "125" },
  ]);
  assert.equal(a, b);
  assert.match(a, /tension=24\.5/);
});

test("اعتبارسنجیِ تعریفِ ادمین ایرادها را می‌گیرد", () => {
  assert.deepEqual(validateServiceOptions(node.options), []);
  const bad = validateServiceOptions([
    { key: "a", title: "", inputType: "choice", choices: [] },
    { key: "a", title: "تنش", inputType: "range", range: { min: 30, max: 10, step: 0 } },
    { key: "c", title: "نوع بد", inputType: "color" },
  ]);
  assert.ok(bad.some((e) => /عنوان الزامی/.test(e)));
  assert.ok(bad.some((e) => /حداقل یک گزینه/.test(e)));
  assert.ok(bad.some((e) => /تکراری/.test(e)));
  assert.ok(bad.some((e) => /بیشینه/.test(e)));
  assert.ok(bad.some((e) => /گام/.test(e)));
  assert.ok(bad.some((e) => /نوعِ ورودی/.test(e)));
});
