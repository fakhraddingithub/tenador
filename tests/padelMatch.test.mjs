import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  normalizePadelSpecs,
  parseBalance,
  parseCore,
  parseLevel,
  parseShape,
  parseSurface,
  parseWeightClass,
  sweetSpotCategoryOf,
} from "../src/lib/racketMatch/padel/normalize.js";
import {
  buildTargetProfile,
  scoreProduct,
  applyHardConstraints,
  rankProducts,
  explainRecommendation,
  DEFAULT_WEIGHTS,
} from "../src/lib/racketMatch/padel/engine.js";
import { STEPS, visibleSteps, assessConfidence } from "../src/lib/racketMatch/padel/questions.js";

/* ═════════════════════ نرمال‌سازی دادهٔ واقعی ═════════════════════ */

test("چهار شکلِ واقعیِ کاتالوگ روی محورِ پیوسته درست مرتب می‌شوند", () => {
  const round = parseShape("گرد");
  const teardrop = parseShape("قطره اشکی");
  const hybrid = parseShape("هیبرید");
  const diamond = parseShape("الماسی");

  assert.equal(round.shape, "round");
  assert.equal(teardrop.shape, "teardrop");
  assert.equal(hybrid.shape, "hybrid");
  assert.equal(diamond.shape, "diamond");

  // هیبرید شکلِ چهارمِ دادهٔ واقعی است و باید بینِ قطره‌اشکی و الماسی بنشیند،
  // نه اینکه از جدولِ سه‌حالتی بیرون بیفتد
  assert.ok(round.shapeOffensiveness < teardrop.shapeOffensiveness);
  assert.ok(teardrop.shapeOffensiveness < hybrid.shapeOffensiveness);
  assert.ok(hybrid.shapeOffensiveness < diamond.shapeOffensiveness);

  assert.equal(parseShape("چیز دیگری").shape, null);
  assert.equal(parseShape("").shapeOffensiveness, null);
});

test("بالانس: عدد بر واژه اولویت دارد و ارقام فارسی هم خوانده می‌شوند", () => {
  // همان آستانه‌هایی که پرامپتِ ثبتِ محصول استفاده می‌کند
  assert.equal(parseBalance("پایین، 26 سانتی‌متر").balance, "low");
  assert.equal(parseBalance("خنثی، ۲۶.۵ سانتی‌متر").balance, "even");
  assert.equal(parseBalance("بالا، ۲۷.۸ سانتی‌متر").balance, "high");

  // «بالا، ۲۷ سانتی‌متر» تناقضِ واقعیِ دیتابیس است: واژه می‌گوید سرسنگین، عدد
  // می‌گوید وسط. دادهٔ دقیق‌تر (عدد) برنده است.
  assert.equal(parseBalance("بالا، 27 سانتی‌متر").balance, "even");

  const low = parseBalance("پایین، 25.5 سانتی‌متر");
  const high = parseBalance("بالا، 28.5 سانتی‌متر");
  assert.ok(low.balanceBias < high.balanceBias);
  assert.equal(low.balancePointCm, 25.5);
});

test("بالانسِ بدونِ عدد از روی واژه خوانده می‌شود، و بی‌داده null می‌ماند", () => {
  assert.equal(parseBalance("خنثی رو به پایین").balance, "low");
  assert.equal(parseBalance("خنثی").balance, "even");
  assert.equal(parseBalance("سرسنگین").balance, "high");
  assert.equal(parseBalance("").balance, null);
  assert.equal(parseBalance("نامشخص").balanceBias, null);
  // عددِ بیرون از بازهٔ فیزیکیِ ممکن نباید به بالانسِ خیالی تبدیل شود
  assert.equal(parseBalance("38 میلی‌متر").balance, null);
});

test("ردهٔ وزن از «پیشنهاد برای» می‌آید و صریح به‌عنوان جانشین علامت می‌خورد", () => {
  assert.equal(parseWeightClass("خانم ها").weightClass, "light");
  assert.equal(parseWeightClass("آقایان").weightClass, "heavy");
  assert.equal(parseWeightClass("آقایان و خانم ها").weightClass, "medium");
  // املای بدونِ کلاهِ آ هم در دادهٔ واقعی هست
  assert.equal(parseWeightClass("خانم ها و اقایان").weightClass, "medium");
  assert.equal(parseWeightClass("خانم ها").weightFromProxy, true);
  assert.equal(parseWeightClass("").weightClass, null);
});

test("اگر روزی وزنِ عددی ثبت شود، بر ردهٔ جانشین اولویت می‌گیرد", () => {
  const numeric = parseWeightClass("خانم ها", "372 گرم");
  assert.equal(numeric.weightGrams, 372);
  assert.equal(numeric.weightClass, "heavy");
  assert.equal(numeric.weightFromProxy, false);

  // و عددی بودن یعنی دو راکتِ ۳۵۲ و ۳۶۸ گرمی دیگر یکی حساب نمی‌شوند
  const light = parseWeightClass(null, "352");
  const heavier = parseWeightClass(null, "368");
  assert.ok(light.weightMass < heavier.weightMass);
});

test("رویه: وقتی هر دو مادّه در متن باشد نتیجه ترکیبی است، نه کربن", () => {
  assert.equal(parseSurface("فایبرگلاس با سطح صاف", "").surface, "fiberglass");
  assert.equal(parseSurface("کربن 3K با بافت سه‌بعدی", "").surface, "carbon");
  // فریمِ کربنی با سطحِ فایبرگلاس یک راکتِ تمام‌کربن نیست
  assert.equal(
    parseSurface("", "فریم کربنی، سطح فایبرگلاس و فوم EVA Soft").surface,
    "hybrid",
  );
  assert.equal(parseSurface("", "رویه هیبریدی Fibrix با هسته MultiEva").surface, "hybrid");
  // گرافن تقویتِ فریم است، نه جنسِ رویه — پس دادهٔ رویه نداریم
  assert.equal(parseSurface("", "فریم تقویت‌شده با گرافن و هسته Power Foam").surface, null);
});

test("هسته فقط با صفتِ صریح خوانده می‌شود؛ نامِ تجاریِ فوم حدس زده نمی‌شود", () => {
  assert.equal(parseCore("کربن 3K و فوم Firm EVA").core, "firm");
  assert.equal(parseCore("فایبرگلاس و فوم EVA Soft Performance").core, "soft");
  assert.equal(parseCore("کربن 16K و هسته Pro EVA متوسط").core, "medium");
  assert.equal(parseCore("کربن کامل 12K و هسته EVA متوسط رو به سخت").core, "firm");
  assert.equal(parseCore("فریم کربنی با هسته MultiEva دو تراکمی").core, "medium");

  // «Power Foam» یک نامِ تجاری است، نه مشخصهٔ سفتی — حدس زدنش ممنوع است
  assert.equal(parseCore("صفحه کربن 24K و هسته Power Foam").core, null);
  assert.equal(parseCore("کربن آلومینایز 16K و فوم High Memory EVA").coreFirmness, null);

  // و «سطح فایبرگلاس نرم» دربارهٔ رویه است، نه هسته
  assert.equal(parseCore("سطح فایبرگلاس نرم با فریم تقویت‌شده").core, null);
});

test("هفت پلهٔ سطحِ دادهٔ واقعی به‌درستی مرتب می‌شوند", () => {
  const order = [
    "مبتدی",
    "مبتدی-متوسط",
    "متوسط",
    "متوسط-پیشرفته",
    "پیشرفته",
    "پیشرفته-حرفه‌ای",
    "حرفه‌ای",
  ].map((label) => parseLevel(label).levelScore);

  for (let i = 1; i < order.length; i += 1) {
    assert.ok(order[i] > order[i - 1], "پلهٔ " + i + " باید بالاتر از قبلی باشد");
  }
  assert.equal(parseLevel("").levelScore, null);
});

test("نقطهٔ شیرین برچسبِ همان بخشندگیِ اندازه‌گیری‌شده است، نه مشخصه‌ای تازه", () => {
  assert.equal(sweetSpotCategoryOf(85), "large");
  assert.equal(sweetSpotCategoryOf(70), "medium");
  assert.equal(sweetSpotCategoryOf(50), "small");
  assert.equal(sweetSpotCategoryOf(null), null);
});

test("دادهٔ ناموجود null می‌ماند و هرگز حدس زده نمی‌شود", () => {
  const specs = normalizePadelSpecs({ attributes: {}, technicalStats: {} });
  for (const key of [
    "shape",
    "balance",
    "balanceBias",
    "weightClass",
    "surface",
    "core",
    "levelScore",
    "sweetSpot",
    "powerLevel",
    "ballOutput",
  ]) {
    assert.equal(specs[key], null, key + " باید null بماند");
  }
});

/* ═════════════════════ پروفایل هدف ═════════════════════ */

const ADULT = { age: "adult", strength: "average", swingSpeed: "moderate" };

test("جدولِ شکلِ §۹ بازتولید می‌شود — بدونِ نوشتنِ خودِ جدول", () => {
  const shapeOf = (answers) => buildTargetProfile({ ...ADULT, ...answers }).shapeTarget;

  // مبتدی + کنترل ⇒ کاملاً سمتِ گرد
  assert.ok(shapeOf({ level: "new", style: "control" }) < 0.15);
  // متوسط + همه‌کاره ⇒ قطره‌اشکی (۰.۴۵)
  const intermediate = shapeOf({ level: "consistent", style: "all-round" });
  assert.ok(intermediate > 0.3 && intermediate < 0.55, "متوسطِ همه‌کاره باید قطره‌اشکی بخواهد");
  // پیشرفته + تهاجمی ⇒ سمتِ الماسی
  assert.ok(shapeOf({ level: "expert", style: "aggressive" }) > 0.8);
  // پیشرفته + دفاعی ⇒ نه الماسی، نه گرد — همان وسط
  const advancedDefensive = shapeOf({ level: "expert", style: "control" });
  assert.ok(advancedDefensive > 0.4 && advancedDefensive < 0.8);
});

test("خطای ممنوع: مبتدیِ قدرت‌خواه راکتِ الماسی نمی‌گیرد", () => {
  const beginnerPower = buildTargetProfile({
    ...ADULT,
    level: "new",
    style: "power",
    priorities: ["power"],
  });
  // سقفِ وابسته به سطح، شکل را از الماسی دور نگه می‌دارد
  assert.ok(
    beginnerPower.shapeTarget < 0.3,
    "سقفِ سطح باید جلوی الماسیِ تجویزی برای تازه‌کار را بگیرد",
  );
  // و همین‌طور بالانسِ بالا و وزنِ سنگین
  assert.ok(beginnerPower.balanceRange[1] < 0.55);
  assert.ok(beginnerPower.massRange[1] < 0.65);
});

test("خطای ممنوع: پیشرفته‌بودن به‌تنهایی راکتِ سنگین تجویز نمی‌کند", () => {
  const weakAdvanced = buildTargetProfile({
    age: "adult",
    level: "expert",
    strength: "below",
    swingSpeed: "slow",
    style: "control",
    priorities: ["maneuverability", "comfort"],
  });
  const strongAdvanced = buildTargetProfile({
    age: "adult",
    level: "expert",
    strength: "verystrong",
    swingSpeed: "veryfast",
    style: "aggressive",
    priorities: ["power", "stability"],
  });
  assert.ok(
    weakAdvanced.massRange[1] < strongAdvanced.massRange[0],
    "توان بدنی و سرعت ضربه باید بر سطح غلبه کنند",
  );
});

test("سن روی وزن، هسته و رویه اثر می‌گذارد، نه با فیلترِ سخت", () => {
  const junior = buildTargetProfile({ ...ADULT, age: "under14", level: "rally" });
  const adult = buildTargetProfile({ ...ADULT, age: "adult", level: "rally" });
  const senior = buildTargetProfile({ ...ADULT, age: "over50", level: "rally" });

  assert.ok(junior.massRange[1] < adult.massRange[1], "بازیکن کم‌سن راکتِ سبک‌تر می‌خواهد");
  assert.ok(junior.coreTarget < adult.coreTarget, "هستهٔ نرم‌تر برای بازیکن کم‌سن");
  assert.ok(junior.sweetSpotTarget > adult.sweetSpotTarget);
  assert.equal(junior.isJunior, true);

  assert.equal(senior.comfortPriority, "high");
  assert.ok(senior.character.comfort > adult.character.comfort);
});

test("بازخوردِ راکت فعلی هدف را جابه‌جا می‌کند (§۵۰)", () => {
  const base = buildTargetProfile({ ...ADULT, level: "consistent", style: "all-round" });

  const heavy = buildTargetProfile({
    ...ADULT,
    level: "consistent",
    style: "all-round",
    currentFeedback: ["too-heavy"],
  });
  assert.ok(heavy.massRange[1] < base.massRange[1], "«سنگین است» باید وزنِ هدف را پایین بیاورد");

  const uncontrollable = buildTargetProfile({
    ...ADULT,
    level: "consistent",
    style: "all-round",
    currentFeedback: ["hard-to-control"],
  });
  assert.ok(uncontrollable.balanceRange[1] < base.balanceRange[1]);
  assert.ok(uncontrollable.shapeTarget < base.shapeTarget, "شکلِ بخشنده‌تر برای کنترلِ آسان‌تر");

  const weak = buildTargetProfile({
    ...ADULT,
    level: "consistent",
    style: "all-round",
    currentFeedback: ["not-enough-power"],
  });
  assert.ok(weak.balanceRange[0] > base.balanceRange[0]);
  assert.ok(weak.shapeTarget > base.shapeTarget);

  const stiff = buildTargetProfile({
    ...ADULT,
    level: "consistent",
    style: "all-round",
    currentFeedback: ["too-stiff"],
  });
  assert.ok(stiff.coreTarget < base.coreTarget, "هستهٔ نرم‌تر برای حسِ خشک");
  assert.ok(stiff.surfaceTarget < base.surfaceTarget);
});

test("راکت فعلی به‌عنوان لنگرِ واقعی وارد محاسبه می‌شود", () => {
  const answers = { ...ADULT, level: "consistent", style: "all-round" };
  const free = buildTargetProfile(answers);
  const anchored = buildTargetProfile(answers, { weightMass: 0.95, balanceBias: 0.95 });
  assert.ok(anchored.massRange[0] > free.massRange[0]);
  assert.ok(anchored.balanceRange[0] > free.balanceRange[0]);
});

test("«هنوز نمی‌دانم» نتیجه را نمی‌شکند ولی اطمینان را هم بالا نمی‌برد", () => {
  const profile = buildTargetProfile({ ...ADULT, level: "consistent", style: "unknown" });
  assert.equal(profile.style, "all-round", "باید همه‌کاره فرض شود تا نتیجه بدهد");

  const confidence = assessConfidence({ ...ADULT, level: "consistent", style: "unknown" });
  assert.notEqual(confidence.level, "high");
  assert.ok(confidence.missing.includes("style"));
  assert.ok(confidence.prompt, "باید همان یک پرسش را دوباره پیش بکشد");
});

/* ═════════════════════ امتیازدهی ═════════════════════ */

const FULL_SPECS = {
  shape: "teardrop",
  shapeOffensiveness: 0.45,
  balance: "even",
  balanceBias: 0.5,
  weightClass: "medium",
  weightMass: 0.5,
  surface: "hybrid",
  surfaceStiffness: 0.55,
  core: "medium",
  coreFirmness: 0.5,
  levelScore: 0.45,
  sweetSpot: "medium",
  sweetSpotSize: 0.5,
  powerLevel: 74,
  controlLevel: 80,
  spinPotential: 76,
  maneuverability: 80,
  comfort: 76,
  forgiveness: 78,
  ballOutput: 76,
};

test("جدول وزن‌ها دقیقاً روی ۱ جمع می‌شود", () => {
  const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, "جمعِ وزن‌ها " + total + " شد");
});

test("عاملِ بدون داده کنار گذاشته می‌شود، نه جریمه", () => {
  const target = buildTargetProfile({ ...ADULT, level: "consistent", style: "all-round" });

  const complete = scoreProduct({ specs: FULL_SPECS }, target);
  const missingCore = scoreProduct(
    { specs: { ...FULL_SPECS, core: null, coreFirmness: null } },
    target,
  );

  assert.equal(complete.factors.core.used, true);
  assert.equal(missingCore.factors.core.used, false);
  assert.ok(missingCore.coverage < complete.coverage, "پوشش باید کمتر شود");
  // ولی امتیاز نباید بابتِ نبودِ داده سقوط کند
  assert.ok(Math.abs(missingCore.score - complete.score) < 6);
});

test("راکتِ متناسب امتیازِ بیشتری از راکتِ نامتناسب می‌گیرد", () => {
  const beginner = buildTargetProfile({
    age: "adult",
    level: "new",
    strength: "below",
    swingSpeed: "slow",
    style: "control",
    priorities: ["control", "comfort", "forgiveness"],
  });

  const friendly = {
    ...FULL_SPECS,
    shape: "round",
    shapeOffensiveness: 0,
    balanceBias: 0.15,
    weightMass: 0.15,
    surfaceStiffness: 0.2,
    coreFirmness: 0.2,
    levelScore: 0.05,
    sweetSpotSize: 0.9,
    powerLevel: 55,
    controlLevel: 90,
    maneuverability: 90,
    comfort: 90,
    forgiveness: 90,
    ballOutput: 85,
  };
  const brutal = {
    ...FULL_SPECS,
    shape: "diamond",
    shapeOffensiveness: 1,
    balanceBias: 0.95,
    weightMass: 0.9,
    surfaceStiffness: 0.85,
    coreFirmness: 0.85,
    levelScore: 1,
    sweetSpotSize: 0.15,
    powerLevel: 95,
    controlLevel: 60,
    maneuverability: 50,
    comfort: 55,
    forgiveness: 50,
    ballOutput: 55,
  };

  assert.ok(
    scoreProduct({ specs: friendly }, beginner).score >
      scoreProduct({ specs: brutal }, beginner).score + 25,
  );
});

test("سطح نامتقارن است: راکتِ خیلی پیشرفته سخت‌تر از راکتِ خیلی ساده جریمه می‌شود", () => {
  const intermediate = buildTargetProfile({ ...ADULT, level: "consistent", style: "all-round" });

  const tooAdvanced = scoreProduct({ specs: { ...FULL_SPECS, levelScore: 1 } }, intermediate)
    .factors.level.score;
  const tooBasic = scoreProduct({ specs: { ...FULL_SPECS, levelScore: 0 } }, intermediate)
    .factors.level.score;

  assert.ok(tooAdvanced < tooBasic, "فاصلهٔ رو به بالا باید گران‌تر باشد");
});

test("کربن به‌خودیِ‌خود بهتر نیست — برای تازه‌کارِ راحتی‌خواه بدتر است", () => {
  const beginner = buildTargetProfile({
    age: "adult",
    level: "new",
    strength: "average",
    swingSpeed: "slow",
    style: "control",
    priorities: ["comfort"],
  });
  const carbon = scoreProduct({ specs: { ...FULL_SPECS, surfaceStiffness: 0.85 } }, beginner)
    .factors.surface.score;
  const glass = scoreProduct({ specs: { ...FULL_SPECS, surfaceStiffness: 0.2 } }, beginner)
    .factors.surface.score;
  assert.ok(glass > carbon, "برای این پروفایل فایبرگلاس باید بهتر امتیاز بگیرد");
});

/* ═════════════════════ شرط‌های قطعی و رتبه‌بندی ═════════════════════ */

const catalogOf = (rows) =>
  rows.map((row, index) => ({
    _id: "p" + index,
    name: "راکت " + index,
    finalPriceToman: row.price ?? 10_000_000,
    specs: { ...FULL_SPECS, ...row.specs },
  }));

test("بودجه شرطِ قطعی است اما در کمبودِ نتیجه نرم می‌شود و به کاربر گفته می‌شود", () => {
  const products = catalogOf([
    { price: 5_000_000 },
    { price: 6_000_000, specs: { powerLevel: 70 } },
    { price: 7_000_000, specs: { controlLevel: 70 } },
    { price: 8_000_000, specs: { comfort: 70 } },
  ]);
  const answers = { ...ADULT, level: "consistent", style: "all-round" };

  const inRange = applyHardConstraints(products, {}, { min: 5_000_000, max: 6_500_000 });
  assert.equal(inRange.products.length, 2);
  assert.equal(inRange.rejected.price, 2);

  // بازهٔ خیلی تنگ ⇒ باید نرم شود و کاربر خبردار شود
  const tight = rankProducts({
    products,
    targetProfile: buildTargetProfile({ ...answers, priceRange: { min: 5_000_000, max: 5_100_000 } }),
    answers,
  });
  assert.ok(tight.best);
  assert.ok(tight.relaxations.length > 0, "نرم‌شدنِ بودجه باید صریح گفته شود");

  // بازهٔ باز ⇒ هیچ نرم‌شدنی لازم نیست
  const wide = rankProducts({
    products,
    targetProfile: buildTargetProfile({ ...answers, priceRange: { min: 1_000_000, max: 99_000_000 } }),
    answers,
  });
  assert.deepEqual(wide.relaxations, []);
});

test("محصولِ بی‌قیمت با فیلترِ بودجه حذف نمی‌شود", () => {
  const products = [{ _id: "x", specs: FULL_SPECS, finalPriceToman: null, basePriceToman: null }];
  const { products: kept } = applyHardConstraints(products, {}, { min: 1, max: 2 });
  assert.equal(kept.length, 1);
});

test("دقیقاً سه نتیجه با بده‌بستان‌های متفاوت برمی‌گردد", () => {
  const products = catalogOf([
    { specs: { powerLevel: 90, controlLevel: 60 } },
    { specs: { powerLevel: 60, controlLevel: 92 } },
    { specs: { comfort: 95, powerLevel: 70 } },
    { specs: { maneuverability: 95, forgiveness: 60 } },
    { specs: { spinPotential: 95 } },
    { specs: {} },
  ]);
  const answers = { ...ADULT, level: "consistent", style: "all-round" };
  const result = rankProducts({ products, targetProfile: buildTargetProfile(answers), answers });

  assert.ok(result.best);
  assert.equal(result.alternatives.length, 2);
  assert.equal(result.best.rank, 0);

  const axes = result.alternatives.map((item) => item.tradeoff.axis).filter(Boolean);
  assert.equal(new Set(axes).size, axes.length, "دو جایگزین نباید محورِ یکسان داشته باشند");
  for (const item of result.alternatives) {
    assert.ok(item.tradeoff.text.length > 10);
  }
});

test("موتور قطعی است: یک ورودی همیشه همان خروجی را می‌دهد", () => {
  const products = catalogOf([
    { specs: { powerLevel: 90 } },
    { specs: { controlLevel: 90 } },
    { specs: { comfort: 90 } },
    { specs: { maneuverability: 90 } },
  ]);
  const answers = { ...ADULT, level: "consistent", style: "aggressive", priorities: ["power"] };
  const run = () =>
    rankProducts({ products, targetProfile: buildTargetProfile(answers), answers })
      .best._id;
  assert.equal(run(), run());
  assert.equal(run(), run());
});

test("موتور به تغییرِ معنادارِ پاسخ حساس است (§۷۲)", () => {
  const products = catalogOf([
    { specs: { shape: "round", shapeOffensiveness: 0, balanceBias: 0.15, weightMass: 0.15, levelScore: 0.05, controlLevel: 92, maneuverability: 92, forgiveness: 92, comfort: 92, powerLevel: 55 } },
    { specs: { shape: "teardrop", shapeOffensiveness: 0.45, balanceBias: 0.5, weightMass: 0.5, levelScore: 0.45 } },
    { specs: { shape: "diamond", shapeOffensiveness: 1, balanceBias: 0.9, weightMass: 0.9, levelScore: 0.95, powerLevel: 94, controlLevel: 62, maneuverability: 55, forgiveness: 55, comfort: 58, ballOutput: 55 } },
  ]);

  const defensive = { age: "adult", level: "new", strength: "below", swingSpeed: "slow", style: "control", priorities: ["control", "comfort"] };
  const attacking = { age: "adult", level: "expert", strength: "verystrong", swingSpeed: "veryfast", style: "power", priorities: ["power", "stability"] };

  const a = rankProducts({ products, targetProfile: buildTargetProfile(defensive), answers: defensive });
  const b = rankProducts({ products, targetProfile: buildTargetProfile(attacking), answers: attacking });

  assert.notEqual(a.best._id, b.best._id, "دو پروفایلِ کاملاً متفاوت نباید به یک راکت برسند");
  assert.equal(a.best.specs.shape, "round");
  assert.equal(b.best.specs.shape, "diamond");
});

/* ═════════════════════ توضیح ═════════════════════ */

test("توضیحِ کاربر هرگز واژهٔ فنی یا ادعای پزشکی نشان نمی‌دهد", () => {
  const target = buildTargetProfile({
    ...ADULT,
    level: "consistent",
    style: "all-round",
    priorities: ["control", "comfort"],
  });
  const { why, notes } = explainRecommendation({ specs: FULL_SPECS }, target);

  assert.ok(why.length > 0);
  assert.ok(why.length <= 5);
  const text = [...why, ...notes].join(" ");
  const forbidden = ["balanceBias", "coreFirmness", "shapeOffensiveness", "EVA", "0.", "آسیب", "درمان"];
  for (const word of forbidden) {
    assert.ok(!text.includes(word), "نباید «" + word + "» را نشان دهد");
  }
});

test("توضیح، شکل و هسته و رویه و نقطهٔ شیرین را پوشش می‌دهد (§۷۹)", () => {
  const target = buildTargetProfile({ ...ADULT, level: "consistent", style: "all-round" });
  const { why, notes } = explainRecommendation({ specs: FULL_SPECS }, target);
  const all = [...why, ...notes].join(" ");

  assert.ok(/شکل/.test(all), "دلیلِ شکل باید گفته شود");
  assert.ok(/وزن/.test(all), "دلیلِ وزن باید گفته شود");
  assert.ok(/هسته/.test(all), "دلیلِ هسته باید گفته شود");
  assert.ok(/رویه/.test(all), "دلیلِ رویه باید گفته شود");
  assert.ok(/نقطهٔ شیرین/.test(all), "نقطهٔ شیرین باید گفته شود");
});

/* ═════════════════════ پرسشنامه ═════════════════════ */

test("گام‌های پرسشنامهٔ پدل همان‌هایی است که سند می‌خواهد", () => {
  const ids = visibleSteps({}).map((step) => step.id);
  assert.deepEqual(ids, [
    "age",
    "level",
    "strength",
    "swingSpeed",
    "style",
    "priorities",
    "currentRacket",
    "priceRange",
  ]);

  // گامِ بازخورد فقط با انتخابِ راکت فعلی ظاهر می‌شود — همان پرسشِ تطبیقیِ §۴۷
  const withRacket = visibleSteps({ currentRacket: { _id: "x" } }).map((step) => step.id);
  assert.ok(withRacket.includes("currentFeedback"));
  assert.ok(!ids.includes("currentFeedback"));
});

test("پرسشنامه هیچ واژهٔ فنی‌ای به کاربر نشان نمی‌دهد (§۸۵)", () => {
  const text = STEPS.flatMap((step) => [
    step.title,
    step.hint || "",
    ...(step.options || []).map((option) => option.label),
  ]).join(" ");

  for (const word of ["بالانس", "EVA", "کربن", "فایبرگلاس", "قطره اشکی", "الماسی"]) {
    assert.ok(!text.includes(word), "پرسشنامه نباید «" + word + "» را به کاربر نشان دهد");
  }
});

test("اولویت‌ها سقفِ سه‌تایی دارد تا مثل بقیهٔ گام‌ها خودکار جلو برود", () => {
  const priorities = STEPS.find((step) => step.id === "priorities");
  assert.equal(priorities.multi, true);
  assert.equal(priorities.max, 3);
});

test("با اطلاعاتِ کم، اطمینان پایین است و یک پرسشِ مشخص پیشنهاد می‌شود", () => {
  const empty = assessConfidence({});
  assert.equal(empty.level, "low");
  assert.ok(empty.prompt);

  const partial = assessConfidence({ level: "consistent", style: "all-round" });
  assert.equal(partial.level, "medium");

  const full = assessConfidence({
    level: "consistent",
    style: "all-round",
    strength: "athletic",
    swingSpeed: "fast",
  });
  assert.equal(full.level, "high");
  assert.equal(full.prompt, null);
});

/* ═════════════════════ معماریِ مشترک ═════════════════════ */

test("موتور پدل هستهٔ مشترک را استفاده می‌کند، نه یک نسخهٔ موازی", async () => {
  const source = await readFile(
    new URL("../src/lib/racketMatch/padel/engine.js", import.meta.url),
    "utf8",
  );
  assert.ok(source.includes('from "../scoringKernel.js"'));
  assert.ok(source.includes("rankCatalog"), "روالِ رتبه‌بندی باید مشترک باشد");
  assert.ok(source.includes("weightedScore"), "جمعِ وزن‌دار باید مشترک باشد");
  assert.ok(source.includes("makeTradeoffDescriber"), "بده‌بستان باید مشترک باشد");
  assert.ok(source.includes("filterByPrice"), "فیلترِ بودجه باید مشترک باشد");
});

test("موتور تنیس هم روی همان هسته نشسته است", async () => {
  const source = await readFile(
    new URL("../src/lib/racketMatch/engine.js", import.meta.url),
    "utf8",
  );
  assert.ok(source.includes('from "./scoringKernel.js"'));
  assert.ok(source.includes("rankCatalog"));
  assert.ok(source.includes("weightedScore"));
});
