import test from "node:test";
import assert from "node:assert/strict";

import {
  TARGET_AUDIENCE_VALUES,
  attributeAppliesToAudience,
  buildTargetAudienceMatch,
  filterAttributesByAudience,
  getEffectiveTargetAudienceFilters,
  isKidsAudience,
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

test("محصولِ بدونِ مخاطب هدف فقط ویژگی‌های بدونِ محدودیت را می‌گیرد", () => {
  // مقدارِ ذخیره‌شده هرگز قاعده را نقض نمی‌کند: نبودِ مخاطب هدف یعنی هیچ
  // محدودیتی برآورده نشده، نه «همه‌چیز را نشان بده».
  for (const audience of [null, undefined, "", "   ", "نامعتبر"]) {
    assert.equal(attributeAppliesToAudience(["بچگانه"], audience), false);
    assert.equal(attributeAppliesToAudience(["یونی سکس"], audience), false);
    assert.equal(
      attributeAppliesToAudience(["مردانه", "زنانه", "بچگانه", "یونی سکس"], audience),
      false,
    );
    // ویژگیِ بدونِ محدودیت همچنان دیده می‌شود
    assert.equal(attributeAppliesToAudience([], audience), true);
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

test("مقدار قدیمی «همه» در هر دو سمت به یونی سکس نرمال می‌شود", () => {
  assert.equal(attributeAppliesToAudience(["همه"], "مردانه"), true);
  assert.equal(attributeAppliesToAudience(["یونی سکس"], "همه"), true);
  assert.equal(attributeAppliesToAudience(["همه"], "بچگانه"), false);
});

test("محدودیتِ ناخوانا یعنی بدونِ محدودیت، نه پنهان‌سازی", () => {
  // پیکربندیِ خرابِ دسته نباید ویژگی را از همه‌ی محصولات حذف کند
  assert.equal(attributeAppliesToAudience(["نامعتبر"], "بچگانه"), true);
  assert.equal(attributeAppliesToAudience(["نامعتبر"], "مردانه"), true);
  assert.equal(attributeAppliesToAudience(["نامعتبر"], null), true);
});

test("isKidsAudience فقط بچگانه را می‌شناسد و نامِ مستعار را هم", () => {
  assert.equal(isKidsAudience("بچگانه"), true);
  for (const value of ["مردانه", "زنانه", "یونی سکس", "همه", "یونیسکس", "", null, undefined, 42]) {
    assert.equal(isKidsAudience(value), false, String(value));
  }
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
  // محصولِ بدونِ مخاطب هدف فقط ویژگی‌های بدونِ محدودیت را می‌بیند
  assert.deepEqual(
    filterAttributesByAudience(attributes, null).map((a) => a.name),
    ["Head Size"],
  );
  assert.deepEqual(filterAttributesByAudience(null, "مردانه"), []);
});
