import test from "node:test";
import assert from "node:assert/strict";

import {
  TARGET_AUDIENCE_VALUES,
  attributeAppliesToAudience,
  buildTargetAudienceMatch,
  filterAttributesByAudience,
  getEffectiveTargetAudienceFilters,
  normalizeTargetAudience,
  targetAudienceListMatches,
} from "../utils/targetAudience.js";

test("مقادیر canonical شامل یونی سکس است و همه را شامل نمی‌شود", () => {
  assert.deepEqual(TARGET_AUDIENCE_VALUES, [
    "مردانه",
    "زنانه",
    "بچگانه",
    "یونی سکس",
  ]);
  assert.equal(TARGET_AUDIENCE_VALUES.includes("همه"), false);
});

test("مقدار قدیمی همه هنگام نوشتن به یونی سکس نرمال می‌شود", () => {
  assert.equal(normalizeTargetAudience("همه"), "یونی سکس");
  assert.equal(normalizeTargetAudience("یونی‌سکس"), "یونی سکس");
  assert.equal(normalizeTargetAudience("نامعتبر"), null);
});

test("فیلتر مردانه و زنانه، یونی سکس و داده قدیمی را هم شامل می‌شود", () => {
  assert.deepEqual(buildTargetAudienceMatch("مردانه"), {
    $in: ["مردانه", "یونی سکس", "همه"],
  });
  assert.deepEqual(buildTargetAudienceMatch("زنانه"), {
    $in: ["زنانه", "یونی سکس", "همه"],
  });
});

test("فیلتر بچگانه فقط محصول بچگانه را شامل می‌شود", () => {
  assert.deepEqual(buildTargetAudienceMatch("بچگانه"), {
    $in: ["بچگانه"],
  });
});

test("یونی سکس در نوبار فقط مردانه و زنانه را فعال می‌کند", () => {
  assert.deepEqual(getEffectiveTargetAudienceFilters(["یونی سکس"]), [
    "مردانه",
    "زنانه",
  ]);
  assert.equal(targetAudienceListMatches(["یونی سکس"], "مردانه"), true);
  assert.equal(targetAudienceListMatches(["یونی سکس"], "زنانه"), true);
  assert.equal(targetAudienceListMatches(["یونی سکس"], "بچگانه"), false);
});

test("داده قدیمی همه نیز در نوبار هرگز بچگانه حساب نمی‌شود", () => {
  assert.deepEqual(getEffectiveTargetAudienceFilters(["همه"]), [
    "مردانه",
    "زنانه",
  ]);
  assert.equal(targetAudienceListMatches(["همه"], "بچگانه"), false);
});

// ── کاربردِ ویژگی‌های ثابتِ دسته بر اساس مخاطب هدف ───────────────────────────
// قاعده: فهرستِ خالی یعنی «بدونِ محدودیت» (رفتارِ قبلی تمامِ ویژگی‌های موجود)، و
// «یونی سکس» دقیقاً مثلِ فیلترها یعنی بزرگسال (مردانه + زنانه) و هرگز بچگانه.

test("ویژگیِ بدونِ محدودیت برای هر مخاطبی کاربرد دارد", () => {
  for (const audience of [...TARGET_AUDIENCE_VALUES, "", null, undefined]) {
    assert.equal(attributeAppliesToAudience([], audience), true);
    assert.equal(attributeAppliesToAudience(undefined, audience), true);
    assert.equal(attributeAppliesToAudience(null, audience), true);
  }
});

test("ویژگیِ یونی سکس برای بزرگسالان کاربرد دارد و برای بچگانه نه", () => {
  assert.equal(attributeAppliesToAudience(["یونی سکس"], "مردانه"), true);
  assert.equal(attributeAppliesToAudience(["یونی سکس"], "زنانه"), true);
  assert.equal(attributeAppliesToAudience(["یونی سکس"], "یونی سکس"), true);
  assert.equal(attributeAppliesToAudience(["یونی سکس"], "بچگانه"), false);
});

test("ویژگیِ بچگانه فقط برای محصولِ بچگانه کاربرد دارد", () => {
  assert.equal(attributeAppliesToAudience(["بچگانه"], "بچگانه"), true);
  assert.equal(attributeAppliesToAudience(["بچگانه"], "مردانه"), false);
  assert.equal(attributeAppliesToAudience(["بچگانه"], "یونی سکس"), false);
});

test("ویژگیِ مردانه روی محصولِ یونی سکس کاربرد ندارد", () => {
  assert.equal(attributeAppliesToAudience(["مردانه"], "مردانه"), true);
  assert.equal(attributeAppliesToAudience(["مردانه"], "زنانه"), false);
  assert.equal(attributeAppliesToAudience(["مردانه"], "یونی سکس"), false);
  // چند مقدار: کافی است یکی بخورد
  assert.equal(attributeAppliesToAudience(["مردانه", "بچگانه"], "بچگانه"), true);
});

test("مقدار قدیمی همه و مخاطبِ نامشخص، ویژگی را پنهان نمی‌کنند", () => {
  // «همه» در هر دو سمت به یونی سکس نرمال می‌شود
  assert.equal(attributeAppliesToAudience(["همه"], "مردانه"), true);
  assert.equal(attributeAppliesToAudience(["یونی سکس"], "همه"), true);
  // محصولِ قدیمی بدونِ مخاطب هدف: هیچ ویژگی‌ای پنهان نمی‌شود
  assert.equal(attributeAppliesToAudience(["بچگانه"], null), true);
  assert.equal(attributeAppliesToAudience(["بچگانه"], ""), true);
  assert.equal(attributeAppliesToAudience(["بچگانه"], "نامعتبر"), true);
  // مقدارِ تگِ نامعتبر نادیده گرفته می‌شود، نه اینکه همه‌چیز را پنهان کند
  assert.equal(attributeAppliesToAudience(["نامعتبر"], "بچگانه"), true);
});

test("فیلترِ فهرستِ ویژگی‌ها همان قاعده را روی آرایه اعمال می‌کند", () => {
  const attributes = [
    { name: "Balance", label: "بالانس", targetAudiences: ["یونی سکس"] },
    { name: "Head Size", label: "اندازه سر" },
    { name: "Kid Grip", label: "گریپ کودک", targetAudiences: ["بچگانه"] },
  ];

  assert.deepEqual(
    filterAttributesByAudience(attributes, "مردانه").map((a) => a.name),
    ["Balance", "Head Size"],
  );
  assert.deepEqual(
    filterAttributesByAudience(attributes, "بچگانه").map((a) => a.name),
    ["Head Size", "Kid Grip"],
  );
  // محصولِ بدونِ مخاطب هدف همه‌ی ویژگی‌ها را می‌بیند (رفتارِ قبلی)
  assert.equal(filterAttributesByAudience(attributes, null).length, 3);
  assert.deepEqual(filterAttributesByAudience(null, "مردانه"), []);
});
