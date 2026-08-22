import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_OPTION_KEY,
  SERVICE_FEE_KEY,
  isRangeAutoIncluded,
  isServiceFeeEntry,
  getServiceOptions,
  isOnStep,
  resolveServiceSelection,
  serviceConfigSignature,
  normalizeFlowNodes,
  validateFlowNodes,
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
  // 20000 + 30000 + تنش که به‌خاطر قیمتِ پیش‌فرض خودکار روی کمینه اضافه می‌شود
  assert.equal(r.addonToman, 55000);
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
  const baseline = resolveServiceSelection(node, sel([{ optionKey: "gauge", choiceKey: "125" }]));
  const fakeOption = resolveServiceSelection(
    node,
    sel([{ optionKey: "gauge", choiceKey: "125" }, { optionKey: "hacked", choiceKey: "x" }])
  );
  assert.equal(fakeOption.addonToman, baseline.addonToman, "آپشنِ جعلی نباید قیمت اضافه کند");
  assert.equal(fakeOption.config.some((c) => c.optionKey === "hacked"), false);
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

test("آپشنِ range، choiceِ بازمانده را حمل نمی‌کند (رگرسیونِ ۵۰۰ پروداکشن)", () => {
  // ویرایشگر هر آپشن را با یک choiceِ خالی می‌سازد؛ با سوییچِ نوع به range آن
  // باقی می‌ماند. اگر ذخیره شود، required بودنِ label در اسکیما ⇒ ValidationError ⇒ 500.
  const nodes = [
    {
      id: "n1",
      type: "service",
      label: "زه‌کشی",
      options: [
        {
          key: "tension",
          title: "تنش",
          inputType: "range",
          choices: [{ key: "c-1", label: "", priceModifier: 0, image: null }],
          range: { min: 18, max: 30, step: 0.5, unit: "kg" },
        },
        {
          key: "gauge",
          title: "قطر",
          inputType: "choice",
          choices: [{ key: "125", label: "1.25", priceModifier: 0 }],
        },
      ],
    },
  ];

  const out = normalizeFlowNodes(nodes);
  assert.deepEqual(out[0].options[0].choices, [], "range نباید choice داشته باشد");
  assert.equal(out[0].options[0].range.step, 0.5, "تنظیماتِ range دست‌نخورده می‌ماند");
  assert.equal(out[0].options[1].choices.length, 1, "آپشنِ choice نباید دست بخورد");
  assert.deepEqual(validateFlowNodes(out), [], "پس از پاک‌سازی باید معتبر باشد");
  assert.equal(nodes[0].options[0].choices.length, 1, "ورودی نباید mutate شود");
});

test("نودهای غیرخدمت و دادهٔ ناقص، normalizeFlowNodes را نمی‌شکنند", () => {
  assert.equal(normalizeFlowNodes(undefined), undefined);
  assert.deepEqual(normalizeFlowNodes([]), []);
  const cat = [{ id: "c", type: "category", categoryId: "abc" }];
  assert.deepEqual(normalizeFlowNodes(cat), cat);
  const legacy = [{ id: "s", type: "service", serviceOptions: [{ label: "a", value: "1" }] }];
  assert.deepEqual(normalizeFlowNodes(legacy), legacy, "نودِ قدیمی دست‌نخورده می‌ماند");
});

test("آپشنِ range با قیمتِ پیش‌فرض خودکار اضافه می‌شود و دوبار حساب نمی‌شود", () => {
  // کاربر فقط قطر را انتخاب کرده؛ تنش قیمتِ پیش‌فرض دارد پس روی کمینه می‌آید
  const auto = resolveServiceSelection(node, sel([{ optionKey: "gauge", choiceKey: "125" }]));
  assert.deepEqual(auto.errors, []);
  assert.equal(auto.addonToman, 5000);
  const tensionRows = auto.config.filter((c) => c.optionKey === "tension");
  assert.equal(tensionRows.length, 1, "تنش باید دقیقاً یک بار بیاید");
  assert.equal(tensionRows[0].value, 18);

  // مقدارِ فرستاده‌شده‌ی کاربر جای پیش‌فرض را می‌گیرد، نه اینکه رویش جمع شود
  const moved = resolveServiceSelection(
    node,
    sel([{ optionKey: "gauge", choiceKey: "125" }, { optionKey: "tension", value: 24 }])
  );
  assert.equal(moved.config.filter((c) => c.optionKey === "tension").length, 1);
  assert.equal(moved.addonToman, 17000); // 5000 + 12*1000
});

test("آپشنِ range بدونِ قیمتِ پیش‌فرض همچنان انتخابی (opt-in) می‌ماند", () => {
  const freeRange = {
    id: "n2",
    type: "service",
    label: "حکاکی",
    options: [
      {
        key: "len",
        title: "طول",
        inputType: "range",
        range: { min: 1, max: 10, step: 1, basePrice: 0, pricePerStep: 0 },
      },
      {
        key: "logo",
        title: "لوگو",
        inputType: "choice",
        choices: [{ key: "yes", label: "بله", priceModifier: 1000 }],
      },
    ],
  };
  assert.equal(isRangeAutoIncluded(getServiceOptions(freeRange)[0]), false);

  const untouched = resolveServiceSelection(
    freeRange,
    { nodeId: "n2", nodeType: "service", serviceConfig: [{ optionKey: "logo", choiceKey: "yes" }] }
  );
  assert.equal(untouched.config.some((c) => c.optionKey === "len"), false);
  assert.equal(untouched.addonToman, 1000);
});

test("هزینه‌ی خدمتِ اجباری بدونِ ساختنِ آپشنِ ساختگی اعمال می‌شود", () => {
  const mandatory = {
    id: "n3",
    type: "service",
    label: "زه‌کشی راکت",
    serviceName: "زه‌کشی",
    required: true,
    servicePrice: 150000,
    options: [],
  };

  // حتی وقتی کلاینت هیچ پیکربندی‌ای نفرستد
  const r = resolveServiceSelection(mandatory, { nodeId: "n3", nodeType: "service", serviceConfig: [] });
  assert.deepEqual(r.errors, []);
  assert.equal(r.addonToman, 150000);
  const fee = r.config.filter(isServiceFeeEntry);
  assert.equal(fee.length, 1, "هزینه‌ی خدمت دقیقاً یک ردیف است");
  assert.equal(fee[0].priceModifier, 150000);

  // کلاینتِ دستکاری‌شده نمی‌تواند مبلغ را عوض کند یا ردیفِ جعلی جا بزند
  const tampered = resolveServiceSelection(mandatory, {
    nodeId: "n3",
    nodeType: "service",
    serviceConfig: [{ optionKey: SERVICE_FEE_KEY, priceModifier: -150000 }],
  });
  assert.deepEqual(tampered.errors, []);
  assert.equal(tampered.addonToman, 150000);
  assert.equal(tampered.config.filter(isServiceFeeEntry).length, 1);
});

test("خدمتِ اختیاری تا وقتی مشتری انتخابش نکند هزینه‌ی خدمت نمی‌گیرد", () => {
  const optional = {
    id: "n4",
    type: "service",
    label: "حکاکی",
    servicePrice: 40000,
    options: [
      {
        key: "logo",
        title: "لوگو",
        inputType: "choice",
        choices: [{ key: "yes", label: "بله", priceModifier: 1000 }],
      },
    ],
  };

  const empty = resolveServiceSelection(optional, { nodeId: "n4", nodeType: "service", serviceConfig: [] });
  assert.equal(empty.addonToman, 0);
  assert.equal(empty.active, false);

  const chosen = resolveServiceSelection(optional, {
    nodeId: "n4",
    nodeType: "service",
    serviceConfig: [{ optionKey: "logo", choiceKey: "yes" }],
  });
  assert.equal(chosen.addonToman, 41000);
  assert.equal(chosen.active, true);
});

test("عنوانِ خالیِ آپشن به نامِ خدمت برمی‌گردد، نه به نوعِ فنی", () => {
  const [o] = getServiceOptions({
    id: "n5",
    type: "service",
    label: "مرحله",
    serviceName: "زه‌کشی",
    options: [{ key: "k", title: "", inputType: "range", range: { min: 0, max: 1, step: 1 } }],
  });
  assert.equal(o.title, "زه‌کشی");
});

test("servicePriceِ نامعتبر در normalizeFlowNodes به عدد تبدیل می‌شود", () => {
  const [n] = normalizeFlowNodes([{ id: "x", type: "service", servicePrice: "12,000" }]);
  assert.equal(n.servicePrice, 0);
  const [m] = normalizeFlowNodes([{ id: "x", type: "service", servicePrice: "15000" }]);
  assert.equal(m.servicePrice, 15000);
});
