import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeRacketSpecs,
  parseBalance,
  parseLengthInches,
  parseStringPattern,
  parseRecommendedLevel,
  toNumber,
} from "../src/lib/racketMatch/normalize.js";
import {
  buildTargetProfile,
  scoreProduct,
  applyHardConstraints,
  rankProducts,
  explainRecommendation,
} from "../src/lib/racketMatch/engine.js";
import { assessConfidence } from "../src/lib/racketMatch/questions.js";

/* ───────────────────────── نرمال‌سازی دادهٔ واقعی ───────────────────────── */

test("طول راکت از سانتی‌متر و اینچ هر دو درست خوانده می‌شود", () => {
  assert.equal(parseLengthInches("68.5"), 26.97);
  assert.equal(parseLengthInches("27"), 27);
  assert.equal(parseLengthInches("نامشخص"), null);
  assert.equal(parseLengthInches(""), null);
});

test("ارقام فارسی و فاصلهٔ اضافه، عدد را خراب نمی‌کنند", () => {
  assert.equal(toNumber("۳۰۵"), 305);
  assert.equal(toNumber("100 "), 100);
  assert.equal(toNumber("نامشخص"), null);
});

test("بالانسِ فارسی به سه حالتِ استاندارد ترجمه می‌شود", () => {
  assert.equal(parseBalance("4 پوینت سرسبک", 27).balance, "head-light");
  assert.equal(parseBalance("2 پوینت سرسنگین", 27).balance, "head-heavy");
  assert.equal(parseBalance("0 پوینت تعادلی", 27).balance, "even");
  assert.equal(parseBalance("", 27).balance, null);
});

test("نقطهٔ بالانس بر حسب سانتی‌متر از روی فیزیک تفسیر می‌شود، نه حدس", () => {
  // وسطِ راکتِ ۲۷ اینچی = ۳۴۲.۹ میلی‌متر؛ ۳۲۰ میلی‌متر یعنی سرسبک
  assert.equal(parseBalance("32 cm", 27).balance, "head-light");
  assert.equal(parseBalance("36 cm", 27).balance, "head-heavy");
  // بدون طول راکت نمی‌شود جهت را فهمید → داده ناموجود می‌ماند
  assert.equal(parseBalance("32 cm", null).balance, null);
});

test("الگوهای زهکشیِ خارج از سه حالتِ کتابی هم طبقه‌بندی می‌شوند", () => {
  const open = parseStringPattern("16x19");
  const dense = parseStringPattern("18x20");
  const middle = parseStringPattern("16x20");
  assert.ok(open.patternOpenness > middle.patternOpenness);
  assert.ok(middle.patternOpenness > dense.patternOpenness);
  assert.equal(parseStringPattern("16x18").stringPattern, "16x18");
  assert.equal(parseStringPattern("چیز دیگری").patternOpenness, null);
});

test("«متوسط-پیشرفته» یعنی هر دو سطح", () => {
  assert.deepEqual(parseRecommendedLevel("متوسط-پیشرفته").sort(), ["advanced", "intermediate"]);
  assert.deepEqual(parseRecommendedLevel("مبتدی"), ["beginner"]);
  assert.equal(parseRecommendedLevel("نامشخص"), null);
});

test("دادهٔ ناموجود، null می‌ماند و هرگز حدس زده نمی‌شود (§32)", () => {
  const specs = normalizeRacketSpecs({
    attributes: { "Unstrung Weight": "300", Swingweight: "نامشخص", Balance: "" },
    technicalStats: {},
  });
  assert.equal(specs.unstrungWeight, 300);
  assert.equal(specs.swingweight, null, "وزن سویینگ نباید از وزن استاتیک استنتاج شود");
  assert.equal(specs.balance, null);
  assert.equal(specs.powerLevel, null);
});

test("گریپ‌ها از واریانت‌ها خوانده می‌شوند", () => {
  const specs = normalizeRacketSpecs({
    attributes: {},
    technicalStats: {},
    variants: [{ attributes: { Grip: "L2" } }, { attributes: { Grip: "L3" } }, { attributes: {} }],
  });
  assert.deepEqual(specs.gripSizes, ["L2", "L3"]);
});

/* ───────────────────────── پروفایل هدف (§24 خطاهای ممنوع) ───────────────────────── */

const BEGINNER = { level: "new", style: "all-court", swingSpeed: "moderate", strength: "average" };

test("§4 — بازیکنِ خنثی دقیقاً داخل بازه‌های وزنیِ سند مرجع می‌افتد", () => {
  const neutral = (level) =>
    buildTargetProfile({ level, style: "all-court", strength: "average", swingSpeed: "moderate" });

  const beginner = neutral("new").weightRange;
  const intermediate = neutral("consistent").weightRange;
  const advanced = neutral("expert").weightRange;

  assert.ok(beginner[0] >= 250 && beginner[1] <= 280, "مبتدی: ۲۵۰–۲۸۰ گرم");
  assert.ok(intermediate[0] >= 275 && intermediate[1] <= 300, "متوسط: ۲۷۵–۳۰۰ گرم");
  assert.ok(advanced[0] >= 295 && advanced[1] <= 330, "پیشرفته: ۲۹۵–۳۳۰ گرم");
});

test("خطای ۱ رد می‌شود: «مبتدی ⇐ سبک‌ترین راکت» یک قاعده نیست", () => {
  const weak = buildTargetProfile({ ...BEGINNER, strength: "below", swingSpeed: "slow" });
  const strong = buildTargetProfile({ ...BEGINNER, strength: "strong", swingSpeed: "fast" });
  assert.ok(
    strong.weightRange[0] > weak.weightRange[0] + 15,
    "مبتدیِ قوی با ضربهٔ سریع باید هدفِ وزنیِ سنگین‌تری بگیرد",
  );
  assert.equal(strong.level, "beginner", "سطح همچنان مبتدی است — فقط وزنِ هدف فرق می‌کند");
});

test("خطای ۲ رد می‌شود: پیشرفته‌بودن به‌تنهایی راکت سنگین تجویز نمی‌کند", () => {
  const frail = buildTargetProfile({
    level: "competitive",
    style: "control",
    strength: "below",
    swingSpeed: "slow",
  });
  const powerful = buildTargetProfile({
    level: "competitive",
    style: "control",
    strength: "verystrong",
    swingSpeed: "veryfast",
  });
  assert.ok(frail.weightRange[1] < 300, "بازیکنِ پیشرفته با توان کم نباید به ۳۰۰+ هدایت شود");
  assert.ok(powerful.weightRange[0] > frail.weightRange[1]);
});

test("§17 — «سنگین است» هدفِ وزن و وزنِ سویینگ را پایین می‌آورد", () => {
  const base = { ...BEGINNER, level: "consistent" };
  const plain = buildTargetProfile(base);
  const heavy = buildTargetProfile({ ...base, currentFeedback: ["too-heavy"] });
  assert.ok(heavy.weightRange[1] < plain.weightRange[1]);
  assert.ok(heavy.swingweightRange[1] < plain.swingweightRange[1]);
});

test("§17 — «بی‌ثبات است» هدف را به سمت پایداری می‌برد", () => {
  const base = { ...BEGINNER, level: "fullswing" };
  const unstable = buildTargetProfile({ ...base, currentFeedback: ["unstable"] });
  assert.ok(unstable.weightRange[0] > buildTargetProfile(base).weightRange[0]);
  assert.ok(unstable.character.stability >= 86);
});

test("راکت فعلی به‌عنوان لنگرِ واقعی وارد محاسبه می‌شود", () => {
  const answers = { ...BEGINNER, level: "consistent" };
  const withCurrent = buildTargetProfile(answers, { unstrungWeight: 320, headSize: 95 });
  const without = buildTargetProfile(answers);
  assert.ok(withCurrent.weightRange[0] > without.weightRange[0]);
  assert.ok(withCurrent.headSizeRange[0] < without.headSizeRange[0]);
});

test("§14 — جونیور طولِ کوتاه‌تر می‌گیرد و قد بر سن ارجحیت دارد", () => {
  const small = buildTargetProfile({ ...BEGINNER, age: "under10", height: "under120" });
  const tall = buildTargetProfile({ ...BEGINNER, age: "under10", height: "over165" });
  assert.equal(small.isJunior, true);
  assert.equal(small.lengthTarget, 21);
  assert.equal(tall.lengthTarget, 27, "کودکِ قدبلند نباید صرفاً به‌خاطر سن، راکت ۲۱ اینچی بگیرد");
  assert.equal(buildTargetProfile({ ...BEGINNER, age: "adult" }).lengthTarget, 27);
});

/* ───────────────────────── امتیازدهی (§21 و §32) ───────────────────────── */

function racket(overrides = {}) {
  return {
    _id: overrides._id || Math.random().toString(16).slice(2, 26).padEnd(24, "0"),
    name: overrides.name || "راکت آزمایشی",
    finalPriceToman: overrides.finalPriceToman ?? 10_000_000,
    specs: {
      unstrungWeight: 300,
      strungWeight: null,
      headSize: 100,
      headSizeCategory: "medium",
      gripSizes: ["L1", "L2", "L3"],
      balance: "head-light",
      balancePoint: null,
      balancePoints: 4,
      swingweight: 315,
      length: 27,
      stringPattern: "16x19",
      patternOpenness: 0.75,
      frameMaterial: "Graphite",
      frameStiffnessRA: 65,
      powerLevel: 72,
      controlLevel: 84,
      spinPotential: 82,
      maneuverability: 80,
      stability: 82,
      comfort: 82,
      forgiveness: 78,
      recommendedLevel: ["intermediate", "advanced"],
      recommendedPlayingStyles: null,
      recommendedPlayerTypes: null,
      ...(overrides.specs || {}),
    },
  };
}

const TARGET = buildTargetProfile({
  level: "fullswing",
  style: "all-court",
  strength: "athletic",
  swingSpeed: "fast",
  priorities: ["control", "spin"],
});

test("عاملِ بدون داده کنار گذاشته می‌شود، نه جریمه (§32)", () => {
  const complete = scoreProduct(racket(), TARGET);
  const noSwing = scoreProduct(racket({ specs: { swingweight: null } }), TARGET);
  const noBalance = scoreProduct(racket({ specs: { balance: null } }), TARGET);

  assert.equal(complete.factors.balance.used, true);
  assert.equal(noBalance.factors.balance.used, false);
  assert.equal(noBalance.factors.balance.score, null);
  assert.ok(noBalance.coverage < complete.coverage, "پوششِ داده کم می‌شود");
  // امتیازِ سایر عوامل نباید به‌خاطر نبودِ یک عامل سقوط کند
  assert.ok(Math.abs(noSwing.score - complete.score) < 12);
});

test("راکتِ کاملاً نامناسب امتیازِ کمتری از راکتِ مناسب می‌گیرد", () => {
  const good = scoreProduct(racket(), TARGET);
  const bad = scoreProduct(
    racket({
      specs: {
        unstrungWeight: 250,
        swingweight: 265,
        headSize: 112,
        headSizeCategory: "large",
        balance: "head-heavy",
        patternOpenness: 0.1,
        powerLevel: 95,
        controlLevel: 40,
        spinPotential: 45,
        maneuverability: 92,
        stability: 52,
        recommendedLevel: ["beginner"],
      },
    }),
    TARGET,
  );
  assert.ok(good.score > bad.score + 20);
});

test("وقتی وزنِ سویینگ موجود است، سهمِ بیشتری از وزنِ استاتیک می‌گیرد (§9)", () => {
  // وزنِ استاتیکِ یکسان، وزنِ سویینگِ متفاوت → امتیازِ عاملِ وزن باید فرق کند
  const inRange = scoreProduct(racket({ specs: { swingweight: TARGET.swingweightRange[0] } }), TARGET);
  const wayOff = scoreProduct(racket({ specs: { swingweight: 260 } }), TARGET);
  assert.ok(inRange.factors.weightSwing.score > wayOff.factors.weightSwing.score);
});

/* ───────────────────────── شرط‌های قطعی (§22) ───────────────────────── */

test("سایزِ دسته دیگر چیزی را حذف نمی‌کند — آن پرسش از پرسشنامه برداشته شده", () => {
  const pool = [
    racket({ _id: "a".repeat(24), specs: { gripSizes: ["L4", "L5"] } }),
    racket({ _id: "b".repeat(24), specs: { gripSizes: ["L2"] } }),
    racket({ _id: "c".repeat(24), specs: { gripSizes: null } }),
  ];
  const { products } = applyHardConstraints(pool, TARGET, null);
  assert.equal(products.length, 3, "هیچ راکتی به‌خاطر سایزِ دسته کنار نمی‌رود");
});

test("به‌جای فیلترکردن، سایزهای دستهٔ موجود در توضیح گفته می‌شود", () => {
  const { notes } = explainRecommendation(racket({ specs: { gripSizes: ["L2", "L3"] } }), TARGET);
  assert.ok(notes.some((note) => note.includes("L2") && note.includes("L3")));

  const { notes: none } = explainRecommendation(racket({ specs: { gripSizes: null } }), TARGET);
  assert.ok(!none.some((note) => note.includes("سایز دسته")));
});

test("بودجه شرطِ قطعی است اما در کمبودِ نتیجه نرم می‌شود و به کاربر گفته می‌شود", () => {
  const pool = [
    racket({ _id: "c".repeat(24), finalPriceToman: 30_000_000 }),
    racket({ _id: "d".repeat(24), finalPriceToman: 32_000_000 }),
    racket({ _id: "e".repeat(24), finalPriceToman: 34_000_000 }),
    racket({ _id: "f".repeat(24), finalPriceToman: 5_000_000 }),
  ];
  const inBudget = { ...TARGET, priceRange: { min: null, max: 6_000_000 } };

  // در بازهٔ انتخابی فقط یک راکت هست، پس بازه باز می‌شود — اما با اعلامِ صریح
  const relaxed = rankProducts({ products: pool, targetProfile: inBudget, answers: {} });
  assert.ok(relaxed.relaxations.length > 0, "به کاربر گفته می‌شود بودجه بازتر شده");
  assert.equal([relaxed.best, ...relaxed.alternatives].length, 3);

  // وقتی خودِ بازه به‌تنهایی سه گزینه دارد، هیچ چیزی نرم نمی‌شود
  const wide = { ...TARGET, priceRange: { min: 20_000_000, max: 40_000_000 } };
  const strict = rankProducts({ products: pool, targetProfile: wide, answers: {} });
  assert.deepEqual(strict.relaxations, []);
  assert.ok(
    ![strict.best, ...strict.alternatives].some((item) => item._id === "f".repeat(24)),
    "راکتِ بیرون از بازه وارد نتایج نمی‌شود",
  );
});

test("جونیور و بزرگسال با هم قاطی نمی‌شوند", () => {
  const pool = [racket({ specs: { length: 27 } }), racket({ specs: { length: 23 } })];
  const juniorTarget = buildTargetProfile({ ...BEGINNER, age: "under10", height: "120to135" });
  assert.equal(applyHardConstraints(pool, juniorTarget, null).products.length, 1);
  assert.equal(applyHardConstraints(pool, TARGET, null).products.length, 1);
});

/* ───────────────────────── خروجی نهایی (§28) ───────────────────────── */

test("دقیقاً سه نتیجه با بده‌بستان‌های متفاوت برمی‌گردد", () => {
  const pool = [
    racket({ _id: "1".repeat(24) }),
    racket({ _id: "2".repeat(24), specs: { unstrungWeight: 318, swingweight: 330, stability: 92, maneuverability: 66 } }),
    racket({ _id: "3".repeat(24), specs: { unstrungWeight: 275, swingweight: 292, forgiveness: 90, headSize: 104, headSizeCategory: "large" } }),
    racket({ _id: "4".repeat(24), specs: { spinPotential: 95, patternOpenness: 0.95 } }),
  ];
  const result = rankProducts({ products: pool, targetProfile: TARGET, answers: {} });

  assert.ok(result.best);
  assert.equal(result.alternatives.length, 2);
  assert.equal(result.best.rank, 0);
  assert.ok(result.best.match.score >= result.alternatives[0].match.score);

  const axes = result.alternatives.map((item) => item.tradeoff.axis).filter(Boolean);
  assert.equal(new Set(axes).size, axes.length, "دو جایگزین باید بده‌بستانِ متفاوتی داشته باشند");
  for (const alternative of result.alternatives) {
    assert.ok(alternative.tradeoff.text.length > 10);
  }
});

test("توضیحِ کاربر هرگز واژهٔ فنی نشان نمی‌دهد (§30)", () => {
  const { why } = explainRecommendation(racket(), TARGET);
  assert.ok(why.length > 0);
  const banned = ["swingweight", "RA", "وزن سویینگ", "بالانس پوینت", "پترن"];
  for (const line of why) {
    for (const word of banned) {
      assert.ok(!line.includes(word), "واژهٔ فنی «" + word + "» نباید به کاربر نشان داده شود");
    }
  }
});

/* ───────────────────────── سطح اطمینان (§29) ───────────────────────── */

test("با اطلاعاتِ کم، اطمینان پایین است و یک پرسشِ مشخص پیشنهاد می‌شود", () => {
  const empty = assessConfidence({});
  assert.equal(empty.level, "low");
  assert.ok(empty.prompt, "باید بگوید کدام پرسش را بپرسیم");

  const partial = assessConfidence({ level: "consistent", style: "spin" });
  assert.equal(partial.level, "medium");
  assert.ok(partial.prompt);

  const full = assessConfidence({
    level: "consistent",
    style: "spin",
    swingSpeed: "fast",
    strength: "athletic",
  });
  assert.equal(full.level, "high");
  assert.equal(full.prompt, null);
});
