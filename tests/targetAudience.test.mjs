import test from "node:test";
import assert from "node:assert/strict";

import {
  TARGET_AUDIENCE_VALUES,
  buildTargetAudienceMatch,
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
