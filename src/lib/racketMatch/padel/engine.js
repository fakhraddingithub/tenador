/**
 * src/lib/racketMatch/padel/engine.js
 *
 * موتور تطبیق راکت پدل — منطقِ خالص، بدون هیچ وابستگی به React/Next/Mongoose.
 *
 * این فایل **همان معماریِ موتور تنیس** است با دانشِ دامنهٔ پدل:
 *   • همان روالِ «پروفایل بازیکن ← پروفایل هدف ← فیلترِ قطعی ← امتیازِ وزن‌دار
 *     ← رتبه‌بندی ← بهترین + دو جایگزین با بده‌بستانِ متفاوت ← توضیحِ ساده».
 *   • همان هستهٔ مشترکِ scoringKernel.js برای امتیاز، بودجه، جایگزین‌ها و خروجی.
 *   • همان قاعدهٔ دادهٔ ناموجود: عاملِ بی‌داده حذف می‌شود، نه جریمه.
 *
 * چیزی که عوض شده فقط دامنه است: راکتِ پدل زه ندارد، پس اندازهٔ صفحه، الگوی
 * زهکشی و وزنِ سویینگ جایشان را به شکلِ فریم، بالانس، جنسِ رویه، هسته و نقطهٔ
 * شیرین داده‌اند.
 *
 * اصلِ حاکم، دست‌نخورده از موتور تنیس: هیچ میان‌بُری مثل «پیشرفته ⇐ الماسی» یا
 * «کربن ⇐ بهتر» وجود ندارد. سطح بازی فقط یکی از ورودی‌های ساختِ پروفایل هدف
 * است و توان بدنی، سرعت ضربه، سبک، اولویت‌ها و بازخوردِ راکت فعلی می‌توانند
 * آن را جابه‌جا کنند.
 */

import {
  PRIORITY_LABELS,
  LEVEL_LABELS,
  assessConfidence,
} from "./questions.js";
import {
  CORE_LABELS,
  SHAPE_LABELS,
  SURFACE_LABELS,
  SWEET_SPOT_LABELS,
  WEIGHT_CLASS_LABELS,
} from "./normalize.js";
import {
  clamp,
  filterByPrice,
  makeTradeoffDescriber,
  proximity,
  rangeScore,
  rankCatalog,
  weightedScore,
} from "../scoringKernel.js";

export { assessConfidence, hasEnoughForPreview } from "./questions.js";

/* ═══════════════════════ ساخت پروفایل هدف ═══════════════════════ */

/**
 * سطحِ پیوسته‌ی بازی از ۰ (تازه‌کار) تا ۱ (تکنیکِ کامل).
 * عمداً پیوسته است تا مرزهای «مبتدی/متوسط/پیشرفته» به قواعدِ سفت‌وسخت تبدیل
 * نشوند؛ دقیقاً همان کاری که موتور تنیس می‌کند.
 */
const LEVEL_SCORE = {
  new: 0,
  rally: 0.2,
  consistent: 0.45,
  tactical: 0.62,
  competitive: 0.82,
  expert: 1,
};

/**
 * جابه‌جاییِ توان بدنی و سرعت ضربه روی محورِ جرم (۰..۱).
 * اعداد کوچک‌اند چون کلِ محور یک واحد است، نه ۱۰۰ گرم.
 */
const STRENGTH_SHIFT = { below: -0.14, average: 0, athletic: 0.06, strong: 0.12, verystrong: 0.16 };
const SWING_SHIFT = { slow: -0.1, moderate: 0, fast: 0.07, veryfast: 0.12 };

/**
 * اثرِ سن. برای بازیکنِ کم‌سن راکتِ سبک‌تر و بخشنده‌تر، و برای بازیکنِ بالای
 * پنجاه راحتیِ بیشتر — هر دو از سندِ مرجع (§84 و §36) می‌آیند و هیچ‌کدام
 * ادعای پزشکی نیستند.
 */
const AGE_MASS_SHIFT = { under14: -0.15, "14to17": -0.06, adult: 0, over50: -0.06 };
const AGE_COMFORT_BOOST = { under14: 6, "14to17": 0, adult: 0, over50: 8 };

/**
 * نمایه‌های شخصیتیِ سبکِ بازی روی هفت شاخصِ فنیِ فروشگاه.
 * «خروج توپ» مخصوصِ پدل است: چقدر توپ در ضربهٔ آرام راحت از صفحه جدا می‌شود.
 */
const STYLE_CHARACTER = {
  control: {
    power: 60,
    control: 90,
    spin: 70,
    maneuverability: 86,
    comfort: 80,
    forgiveness: 86,
    ballOutput: 82,
  },
  "all-round": {
    power: 74,
    control: 80,
    spin: 76,
    maneuverability: 80,
    comfort: 76,
    forgiveness: 78,
    ballOutput: 76,
  },
  aggressive: {
    power: 85,
    control: 74,
    spin: 82,
    maneuverability: 72,
    comfort: 68,
    forgiveness: 68,
    ballOutput: 66,
  },
  power: {
    power: 92,
    control: 66,
    spin: 78,
    maneuverability: 64,
    comfort: 64,
    forgiveness: 62,
    ballOutput: 60,
  },
};

/** «هنوز نمی‌دانم» یعنی همه‌کاره فرض کن، ولی اطمینان را بالا نبر */
const DEFAULT_STYLE = "all-round";
const styleOf = (value) => (value && value !== "unknown" && STYLE_CHARACTER[value] ? value : DEFAULT_STYLE);

/** جابه‌جاییِ شکلِ فریم بر حسب سبک — نه یک نگاشتِ یک‌به‌یک */
const STYLE_SHAPE_SHIFT = { control: -0.15, "all-round": 0, aggressive: 0.22, power: 0.25 };
/** جابه‌جاییِ بالانس بر حسب سبک */
const STYLE_BALANCE_SHIFT = { control: -0.12, "all-round": 0, aggressive: 0.15, power: 0.18 };

/** سطحِ گسسته از امتیازِ پیوسته (فقط برای برچسبِ نمایشی) */
function levelLabelOf(levelScore) {
  if (levelScore < 0.35) return "beginner";
  if (levelScore < 0.72) return "intermediate";
  return "advanced";
}

/**
 * ساختِ پروفایلِ هدفِ راکت از پاسخ‌های بازیکن (و در صورت وجود، راکت فعلی او).
 *
 * @param {Object} answers پاسخ‌ها با واژگانِ padel/questions.js
 * @param {Object|null} currentRacket شناسنامهٔ فنیِ راکت فعلی (خروجی normalizePadelSpecs)
 * @returns {Object} پروفایل هدف
 */
export function buildTargetProfile(answers = {}, currentRacket = null) {
  const feedback = new Set(answers.currentFeedback || []);
  const priorities = (answers.priorities || []).slice(0, 3);
  const priorityRank = new Map(priorities.map((key, index) => [key, index]));
  const hasPriority = (key, maxRank = 2) =>
    priorityRank.has(key) && priorityRank.get(key) <= maxRank;

  /* ── گام ۱: سن ────────────────────────────────────────────────── */
  const age = answers.age || "adult";
  const isJunior = age === "under14" || age === "14to17";

  /* ── گام ۲: سطحِ واقعیِ بازی ───────────────────────────────────── */
  const levelScore = LEVEL_SCORE[answers.level] ?? 0.45;
  const level = levelLabelOf(levelScore);

  /* ── گام ۳ و ۴: توان بدنی و سرعت ضربه ─────────────────────────── */
  const strengthShift = STRENGTH_SHIFT[answers.strength] ?? 0;
  const swingShift = SWING_SHIFT[answers.swingSpeed] ?? 0;

  /* ── گام ۵ و ۶: سبک و اولویت‌ها ────────────────────────────────── */
  const style = styleOf(answers.style);

  /* ── گام ۷: پروفایل فنیِ هدف ───────────────────────────────────── */

  // وزن — هرگز از سطح به‌تنهایی نتیجه نمی‌شود (§14 و §93). مرکزِ محورِ جرم از
  // سطحِ پیوسته می‌آید و بعد با توان بدنی، سرعت ضربه، سن، اولویت‌ها و بازخوردِ
  // راکت فعلی جابه‌جا می‌شود.
  let massShift = strengthShift + swingShift + (AGE_MASS_SHIFT[age] ?? 0);
  if (hasPriority("maneuverability", 1)) massShift -= 0.08;
  if (hasPriority("comfort", 1)) massShift -= 0.05;
  if (hasPriority("stability", 1)) massShift += 0.1;
  if (hasPriority("power", 1)) massShift += 0.05;
  if (feedback.has("too-heavy")) massShift -= 0.15;
  if (feedback.has("hard-to-control")) massShift -= 0.08;
  if (feedback.has("unstable")) massShift += 0.12;
  if (feedback.has("not-enough-power")) massShift += 0.06;
  massShift = clamp(massShift, -0.32, 0.32);

  let massCenter = 0.3 + levelScore * 0.3 + massShift;
  if (Number.isFinite(currentRacket?.weightMass)) {
    // راکت فعلی، لنگرِ واقعی است — نصفِ وزنِ تصمیم را می‌گیرد
    let anchored = currentRacket.weightMass;
    if (feedback.has("too-heavy")) anchored -= 0.18;
    if (feedback.has("unstable")) anchored += 0.14;
    massCenter = (massCenter + anchored) / 2;
  }
  massCenter = clamp(massCenter, 0.08, 0.95);
  const massRange = [
    Math.round(Math.max(0, massCenter - 0.13) * 100) / 100,
    Math.round(Math.min(1, massCenter + 0.13) * 100) / 100,
  ];

  // بالانس — سقفِ سطح روی آن گذاشته می‌شود: بالانسِ بالا تکنیک می‌خواهد و
  // نباید فقط چون کاربر «قدرت» گفته به یک تازه‌کار تجویز شود.
  let balanceCenter =
    0.3 +
    levelScore * 0.22 +
    (STYLE_BALANCE_SHIFT[style] ?? 0) +
    (strengthShift + swingShift) * 0.5;
  if (hasPriority("maneuverability", 1)) balanceCenter -= 0.1;
  if (hasPriority("control", 1)) balanceCenter -= 0.07;
  if (hasPriority("comfort", 1)) balanceCenter -= 0.05;
  if (hasPriority("stability", 1)) balanceCenter += 0.06;
  if (hasPriority("power", 1)) balanceCenter += 0.1;
  if (feedback.has("hard-to-control")) balanceCenter -= 0.12;
  if (feedback.has("too-heavy")) balanceCenter -= 0.08;
  if (feedback.has("not-enough-power")) balanceCenter += 0.12;
  if (feedback.has("unstable")) balanceCenter += 0.06;
  if (Number.isFinite(currentRacket?.balanceBias)) {
    let anchored = currentRacket.balanceBias;
    if (feedback.has("hard-to-control")) anchored -= 0.12;
    if (feedback.has("not-enough-power")) anchored += 0.12;
    balanceCenter = (balanceCenter + anchored) / 2;
  }
  balanceCenter = clamp(balanceCenter, 0.05, 0.35 + levelScore * 0.6);
  const balanceRange = [
    Math.round(Math.max(0, balanceCenter - 0.14) * 100) / 100,
    Math.round(Math.min(1, balanceCenter + 0.14) * 100) / 100,
  ];

  // شکلِ فریم — روی همان محورِ پیوستهٔ گرد↔الماسی، با یک سقفِ وابسته به سطح.
  // این سقف همان چیزی است که «مبتدی + قدرت ⇒ الماسی» را ممکن نمی‌کند (§8).
  let shapeTarget = 0.15 + levelScore * 0.5 + (STYLE_SHAPE_SHIFT[style] ?? 0);
  if (hasPriority("power", 1)) shapeTarget += 0.12;
  if (hasPriority("control", 1)) shapeTarget -= 0.12;
  if (hasPriority("forgiveness", 1)) shapeTarget -= 0.1;
  if (hasPriority("maneuverability", 1)) shapeTarget -= 0.08;
  if (hasPriority("stability", 1)) shapeTarget += 0.05;
  if (feedback.has("not-enough-power")) shapeTarget += 0.12;
  if (feedback.has("hard-to-control")) shapeTarget -= 0.15;
  if (feedback.has("too-heavy")) shapeTarget -= 0.1;
  const shapeCeiling = 0.18 + levelScore * 0.85;
  shapeTarget = clamp(Math.min(shapeTarget, shapeCeiling), 0, 1);

  // هسته — نه «EVA بهتر است» و نه «فومِ نرم بدتر». فقط تطبیق با نیاز (§27).
  let coreTarget = 0.3 + levelScore * 0.35;
  if (hasPriority("comfort", 1)) coreTarget -= 0.18;
  if (hasPriority("control", 1)) coreTarget += 0.12;
  if (hasPriority("power", 1)) coreTarget -= 0.05;
  if (hasPriority("forgiveness", 1)) coreTarget -= 0.08;
  if (feedback.has("too-stiff")) coreTarget -= 0.2;
  if (feedback.has("not-enough-power")) coreTarget -= 0.1;
  if (isJunior || age === "over50") coreTarget -= 0.08;
  coreTarget = clamp(coreTarget, 0.15, 0.9);

  // جنسِ رویه — کربن هرگز «بهتر» نیست، فقط برای بعضی پروفایل‌ها مناسب‌تر (§23)
  let surfaceTarget = 0.25 + levelScore * 0.45;
  if (hasPriority("comfort", 1)) surfaceTarget -= 0.15;
  if (hasPriority("control", 1)) surfaceTarget += 0.05;
  if (hasPriority("power", 1)) surfaceTarget += 0.05;
  if (feedback.has("too-stiff")) surfaceTarget -= 0.15;
  if (isJunior || age === "over50") surfaceTarget -= 0.05;
  surfaceTarget = clamp(surfaceTarget, 0.15, 0.9);

  // نقطهٔ شیرین — هرچه تکنیک بالاتر، تحملِ نقطهٔ شیرینِ کوچک‌تر بیشتر (§31)
  let sweetSpotTarget = 0.85 - levelScore * 0.35;
  if (hasPriority("forgiveness", 1)) sweetSpotTarget += 0.1;
  if (hasPriority("control", 1)) sweetSpotTarget -= 0.08;
  if (isJunior) sweetSpotTarget += 0.08;
  sweetSpotTarget = clamp(sweetSpotTarget, 0.35, 0.95);

  // نمایهٔ شخصیتیِ هدف — پایه از سبک، سپس اولویت‌ها آن را بالا می‌برند
  const character = { ...(STYLE_CHARACTER[style] || STYLE_CHARACTER[DEFAULT_STYLE]) };
  const PRIORITY_FLOOR = [92, 86, 80];
  priorities.forEach((key, index) => {
    if (character[key] !== undefined) {
      character[key] = Math.max(character[key], PRIORITY_FLOOR[index] ?? 80);
    }
  });
  // «پایداری» شاخصِ اندازه‌گیری‌شده‌ای در فروشگاه ندارد، پس به‌جای ساختنِ عددِ
  // خیالی، خودش را در هدفِ وزن و بالانس نشان می‌دهد (بالاتر) و این‌جا فقط
  // چابکی را پایین نمی‌آورد.
  if (feedback.has("too-stiff")) character.comfort = Math.max(character.comfort, 88);
  if (feedback.has("not-enough-power")) character.power = Math.max(character.power, 84);
  if (feedback.has("hard-to-control")) character.control = Math.max(character.control, 86);
  if (feedback.has("unstable")) character.forgiveness = Math.max(character.forgiveness, 84);
  if (feedback.has("want-more-spin")) character.spin = Math.max(character.spin, 88);
  if (feedback.has("too-heavy")) character.maneuverability = Math.max(character.maneuverability, 86);
  const ageComfort = AGE_COMFORT_BOOST[age] ?? 0;
  if (ageComfort) character.comfort = Math.min(100, character.comfort + ageComfort);
  // ضربهٔ آرام یعنی توپ باید خودش از صفحه جدا شود؛ «خروج توپ» دقیقاً همین است
  if (answers.swingSpeed === "slow") character.ballOutput = Math.max(character.ballOutput, 84);

  const comfortPriority =
    hasPriority("comfort", 1) || feedback.has("too-stiff") || age === "over50" ? "high" : "normal";

  return {
    age,
    isJunior,
    level,
    levelScore,
    style,
    priorities,
    massRange,
    balanceRange,
    shapeTarget,
    coreTarget,
    surfaceTarget,
    sweetSpotTarget,
    character,
    comfortPriority,
    priceRange: answers.priceRange || null,
    currentRacket: currentRacket || null,
    feedback: [...feedback],
  };
}

/* ═══════════════════════ امتیازدهی ═══════════════════════ */

/**
 * جدول وزنِ سندِ مرجع پدل، بدون تغییر.
 *
 * جمعشان دقیقاً ۱ است، اما هستهٔ امتیازدهی وزن‌ها را دوباره نرمال می‌کند، پس
 * محصولی که مثلاً هسته‌اش ثبت نشده جریمه نمی‌شود.
 */
export const DEFAULT_WEIGHTS = {
  level: 0.2,
  style: 0.15,
  weight: 0.15,
  balance: 0.15,
  shape: 0.1,
  powerControl: 0.1,
  maneuverStability: 0.05,
  core: 0.05,
  surface: 0.03,
  sweetSpot: 0.02,
};

/**
 * تطبیقِ سطح.
 *
 * نامتقارن است و عمداً: راکتی که برای سطحِ بالاتر از بازیکن ساخته شده سخت‌تر
 * جریمه می‌شود تا راکتی که ساده‌تر از اوست. یک راکتِ حرفه‌ای در دستِ تازه‌کار
 * بازی را خراب می‌کند؛ یک راکتِ متوسط در دستِ حرفه‌ای فقط کمی کم می‌آورد (§64).
 */
function scoreLevel(specs, target) {
  if (!Number.isFinite(specs.levelScore)) return null;
  const delta = specs.levelScore - target.levelScore;
  return delta > 0 ? clamp(1 - delta * 1.4, 0, 1) : clamp(1 + delta, 0, 1);
}

/**
 * سبک بازی. فروشگاه برای پدل فیلدِ «سبکِ پیشنهادی» ندارد، پس از شاخص‌های فنیِ
 * اندازه‌گیری‌شدهٔ خودِ محصول استفاده می‌شود — که دادهٔ واقعی است، نه حدس.
 */
function scoreStyle(specs, target) {
  const archetype = STYLE_CHARACTER[target.style] || STYLE_CHARACTER[DEFAULT_STYLE];
  const axes = [
    ["power", specs.powerLevel],
    ["control", specs.controlLevel],
    ["spin", specs.spinPotential],
    ["maneuverability", specs.maneuverability],
    ["comfort", specs.comfort],
    ["forgiveness", specs.forgiveness],
    ["ballOutput", specs.ballOutput],
  ].filter(([, value]) => Number.isFinite(value));
  if (!axes.length) return null;
  const total = axes.reduce((sum, [key, value]) => sum + proximity(value, archetype[key]), 0);
  return total / axes.length;
}

/** امتیازِ نزدیکیِ یک محورِ ۰..۱ به هدف؛ افتِ خطی با شیبِ داده‌شده */
function axisScore(value, targetValue, slope = 1) {
  if (!Number.isFinite(value)) return null;
  return clamp(1 - Math.abs(value - targetValue) * slope, 0, 1);
}

/** جفتِ قدرت/کنترل — دو رویِ یک سکه، پس با هم سنجیده می‌شوند */
function scorePairedAxes(target, pairs) {
  const usable = pairs.filter(([, value]) => Number.isFinite(value));
  if (!usable.length) return null;
  const total = usable.reduce(
    (sum, [key, value]) => sum + proximity(value, target.character[key]),
    0,
  );
  return total / usable.length;
}

/**
 * امتیاز سازگاریِ یک محصول با پروفایل هدف.
 * هر عاملی که دادهٔ محصول برای آن موجود نیست، به‌کلی کنار گذاشته می‌شود و
 * وزن‌های باقی‌مانده دوباره نرمال می‌شوند — نه جریمه، نه حدس.
 *
 * @returns {{score:number, factors:Object, coverage:number}} امتیاز ۰..۱۰۰
 */
export function scoreProduct(product, targetProfile, weights = DEFAULT_WEIGHTS) {
  const specs = product.specs || product;
  const raw = {
    level: scoreLevel(specs, targetProfile),
    style: scoreStyle(specs, targetProfile),
    weight: rangeScore(specs.weightMass, targetProfile.massRange, 0.25),
    balance: rangeScore(specs.balanceBias, targetProfile.balanceRange, 0.3),
    // شیبِ ۰.۷۵ یعنی حتی دورترین شکل هم صفرِ مطلق نمی‌گیرد؛ شکل یک ترجیح است،
    // نه یک شرطِ قطعی، و مشخصاتِ واقعیِ محصول می‌توانند جبرانش کنند (§91)
    shape: axisScore(specs.shapeOffensiveness, targetProfile.shapeTarget, 0.75),
    powerControl: scorePairedAxes(targetProfile, [
      ["power", specs.powerLevel],
      ["control", specs.controlLevel],
      ["ballOutput", specs.ballOutput],
    ]),
    maneuverStability: scorePairedAxes(targetProfile, [
      ["maneuverability", specs.maneuverability],
      ["forgiveness", specs.forgiveness],
    ]),
    core: axisScore(specs.coreFirmness, targetProfile.coreTarget),
    surface: axisScore(specs.surfaceStiffness, targetProfile.surfaceTarget),
    sweetSpot: axisScore(specs.sweetSpotSize, targetProfile.sweetSpotTarget),
  };

  return weightedScore(raw, weights);
}

/* ═══════════════════════ شرط‌های قطعی ═══════════════════════ */

/**
 * فیلترِ شرط‌های قطعی.
 *
 * برخلافِ تنیس، پدل شرطِ اندازهٔ جونیور/بزرگسال ندارد: راکتِ پدل طولِ ثابتِ
 * قانونی دارد و فروشگاه هم فیلدِ طول برایش ثبت نمی‌کند. ساختنِ یک شرطِ قطعی از
 * روی دادهٔ ناموجود دقیقاً همان حدس‌زدنی است که ممنوع است؛ به‌جایش سن روی
 * پروفایلِ هدف (وزنِ سبک‌تر، هستهٔ نرم‌تر، بخشندگیِ بیشتر) اثر می‌گذارد.
 *
 * پس تنها شرطِ قطعیِ پدل بودجه است — همان فیلترِ مشترکِ هستهٔ امتیازدهی.
 *
 * @returns {{products: Array, rejected: Object}}
 */
export function applyHardConstraints(products, targetProfile, priceRange = null) {
  const { products: kept, rejected } = filterByPrice(products, priceRange);
  return { products: kept, rejected: { price: rejected } };
}

/* ═══════════════════════ بده‌بستان ═══════════════════════ */

/**
 * محورهای بده‌بستان. برای هر محور: چطور از روی شناسنامه استخراجش کنیم و
 * جمله‌های فارسیِ «بیشتر»/«کمتر» نسبت به بهترین گزینه.
 */
const TRADEOFF_AXES = [
  {
    key: "weight",
    get: (specs) => specs.weightMass,
    threshold: 0.2,
    more: "کمی سنگین‌تر است و پشت توپ جان بیشتری می‌گذارد، اما چرخاندنش انرژی بیشتری می‌خواهد.",
    less: "سبک‌تر است و راحت‌تر می‌چرخد، اما مقابل ضربه‌های خیلی سنگین کمی کم می‌آورد.",
  },
  {
    key: "balance",
    get: (specs) => specs.balanceBias,
    threshold: 0.18,
    more: "وزنش بیشتر به سمت سرِ راکت است، پس ضربهٔ تمام‌کننده سنگین‌تر می‌شود، اما دستتان کمتر باز است.",
    less: "وزنش به سمت دسته است، پس سریع‌تر در دست می‌چرخد، اما ضربهٔ تمام‌کننده کمی سبک‌تر می‌شود.",
  },
  {
    key: "shape",
    get: (specs) => specs.shapeOffensiveness,
    threshold: 0.3,
    more: "شکلش تهاجمی‌تر است و برای حمله ساخته شده، اما نقطهٔ شیرینش کوچک‌تر و سخت‌گیرتر است.",
    less: "شکلش بخشنده‌تر است و راحت‌تر بازی می‌شود، اما در حمله به اندازهٔ گزینهٔ اول انفجاری نیست.",
  },
  {
    key: "power",
    get: (specs) => specs.powerLevel,
    threshold: 6,
    more: "بدون تلاش بیشتر، توپ را سنگین‌تر می‌فرستد، اما مهارِ آن دقت بیشتری می‌خواهد.",
    less: "آرام‌تر است و مهارش ساده‌تر، اما باید بیشتر خودتان قدرت بسازید.",
  },
  {
    key: "control",
    get: (specs) => specs.controlLevel,
    threshold: 6,
    more: "توپ را دقیق‌تر سرِ جایش می‌گذارد، اما قدرتِ آماده‌اش کمتر است.",
    less: "قدرتِ آماده‌تری دارد، اما به همان اندازه دقیق نیست.",
  },
  {
    key: "maneuverability",
    get: (specs) => specs.maneuverability,
    threshold: 6,
    more: "سریع‌تر در دست می‌چرخد و کنار تور دستتان را باز می‌گذارد، اما کمی از پایداری کم می‌کند.",
    less: "کمی کندتر در دست می‌چرخد، اما در عوض ثباتِ بیشتری دارد.",
  },
  {
    key: "forgiveness",
    get: (specs) => specs.forgiveness,
    threshold: 6,
    more: "ضربه‌های خارج از مرکز را بیشتر می‌بخشد، اما به اندازهٔ گزینهٔ اول دقیق نیست.",
    less: "دقیق‌تر است، اما ضربهٔ ناجور را کمتر می‌بخشد.",
  },
  {
    key: "comfort",
    get: (specs) => specs.comfort,
    threshold: 6,
    more: "لرزش کمتری به دست می‌دهد و برای بازی طولانی راحت‌تر است.",
    less: "حسِ خشک‌تر و مستقیم‌تری دارد، اما لرزش بیشتری به دست می‌رسد.",
  },
  {
    key: "spin",
    get: (specs) => specs.spinPotential,
    threshold: 6,
    more: "چرخاندن توپ با آن ساده‌تر است، اما مسیرِ توپ کمی بلندتر می‌شود.",
    less: "مسیر توپ صاف‌تر و قابل‌پیش‌بینی‌تر است، اما اسپین کمتری می‌دهد.",
  },
  {
    key: "ballOutput",
    get: (specs) => specs.ballOutput,
    threshold: 6,
    more: "در ضربه‌های آرام و دفاعی، توپ راحت‌تر از صفحه جدا می‌شود.",
    less: "در ضربه‌های آرام باید خودتان بیشتر کار کنید، اما در عوض کمتر از کنترل خارج می‌شود.",
  },
  {
    key: "core",
    get: (specs) => specs.coreFirmness,
    threshold: 0.25,
    more: "هستهٔ سفت‌ترش پاسخِ مستقیم‌تری می‌دهد، اما ضربه را خشک‌تر به دست می‌رساند.",
    less: "هستهٔ نرم‌ترش ضربه را نرم‌تر می‌کند، اما حسِ پاسخ کمی غیرمستقیم‌تر است.",
  },
];

export const describeTradeoff = makeTradeoffDescriber(
  TRADEOFF_AXES,
  "بسیار نزدیک به گزینهٔ اول است، با حس ضربهٔ کمی متفاوت.",
);

/* ═══════════════════════ توضیح به زبان ساده ═══════════════════════ */

const SHAPE_TEXT = {
  round: "شکلِ گردش نقطهٔ شیرینِ بزرگ‌تری دارد و ضربه‌های خارج از مرکز را می‌بخشد.",
  teardrop: "شکلِ قطره‌اشکی‌اش حدِ وسطِ قدرت و کنترل است و در بیشتر موقعیت‌ها جواب می‌دهد.",
  hybrid: "شکلِ هیبریدش بینِ قطره‌اشکی و الماسی است: کمی تهاجمی‌تر، بدون اینکه سخت‌گیر شود.",
  diamond: "شکلِ الماسی‌اش برای حمله ساخته شده و ضربهٔ تمام‌کننده را سنگین‌تر می‌کند.",
};

const BALANCE_TEXT = {
  low: "وزنش به سمت دسته است، پس سریع در دست می‌چرخد.",
  even: "وزنش متعادل پخش شده و حسی میانه می‌دهد.",
  high: "وزنش به سمت سرِ راکت است و به ضربه جان بیشتری می‌دهد.",
};

const CORE_TEXT = {
  soft: "هستهٔ نرمش ضربه را نرم‌تر می‌کند و بیرون آوردن توپ را ساده‌تر.",
  medium: "هستهٔ میانه‌اش هم راحت است هم پاسخِ روشنی می‌دهد.",
  firm: "هستهٔ سفتش پاسخِ مستقیم و دقیقی می‌دهد.",
};

const SURFACE_TEXT = {
  fiberglass: "رویهٔ فایبرگلاسش انعطاف بیشتری دارد و ضربه را نرم‌تر منتقل می‌کند.",
  hybrid: "رویهٔ ترکیبی‌اش بینِ نرمیِ فایبرگلاس و پاسخِ مستقیمِ کربن می‌ایستد.",
  carbon: "رویهٔ کربنش پاسخِ مستقیم‌تر و دقیق‌تری می‌دهد.",
};

/**
 * جمله‌های «چرا این به شما می‌خورد» — کاملاً غیرفنی.
 * هیچ‌جا واژه‌هایی مثل «بایاسِ بالانس» یا «سفتیِ هسته» به کاربر نشان داده
 * نمی‌شود و هیچ ادعای پزشکی («جلوی آسیب را می‌گیرد») ساخته نمی‌شود.
 *
 * @returns {{why: string[], notes: string[]}}
 */
export function explainRecommendation(product, targetProfile) {
  const specs = product.specs || product;
  const why = [];
  const notes = [];

  // شکل — مهم‌ترین تصمیمِ یک راکتِ پدل
  if (specs.shape && SHAPE_TEXT[specs.shape]) why.push(SHAPE_TEXT[specs.shape]);

  // وزن
  if (Number.isFinite(specs.weightMass)) {
    const [low, high] = targetProfile.massRange;
    if (specs.weightMass >= low && specs.weightMass <= high) {
      why.push("وزنش در همان محدوده‌ای است که با توان و سرعت ضربهٔ شما جور درمی‌آید.");
    } else if (specs.weightMass < low) {
      why.push("کمی سبک‌تر از حد معمولِ این سطح است تا تا آخر بازی از دستتان درنیاید.");
    } else {
      why.push("کمی سنگین‌تر است تا پشت توپ بایستد و ضربه‌های سنگین حریف را پس بزند.");
    }
  }

  // اولویت‌هایی که این راکت واقعاً در آن‌ها قوی است
  const strongPriorities = (targetProfile.priorities || []).filter((key) => {
    const value = {
      power: specs.powerLevel,
      control: specs.controlLevel,
      spin: specs.spinPotential,
      maneuverability: specs.maneuverability,
      comfort: specs.comfort,
      forgiveness: specs.forgiveness,
      // «پایداری» شاخصِ مستقیم ندارد؛ نزدیک‌ترین دادهٔ واقعی، بخشندگی است
      stability: specs.forgiveness,
    }[key];
    return Number.isFinite(value) && value >= 78;
  });
  if (strongPriorities.length) {
    const labels = strongPriorities.map((key) => PRIORITY_LABELS[key]).join(" و ");
    why.push("در " + labels + " — یعنی همان چیزی که برایتان مهم‌تر بود — نمرهٔ بالایی دارد.");
  }

  if (specs.balance && BALANCE_TEXT[specs.balance] && why.length < 5) {
    why.push(BALANCE_TEXT[specs.balance]);
  }

  if (
    targetProfile.comfortPriority === "high" &&
    Number.isFinite(specs.comfort) &&
    specs.comfort >= 80
  ) {
    why.push("لرزش کمی به دست منتقل می‌کند و برای بازی طولانی راحت‌تر است.");
  }

  // یادداشت‌های کاربردی — پایین‌ترِ کارت، بدونِ واژهٔ فنی
  if (specs.core && CORE_TEXT[specs.core]) notes.push(CORE_TEXT[specs.core]);
  if (specs.surface && SURFACE_TEXT[specs.surface]) notes.push(SURFACE_TEXT[specs.surface]);
  if (specs.sweetSpot) {
    notes.push("نقطهٔ شیرین: " + SWEET_SPOT_LABELS[specs.sweetSpot]);
  }
  if (specs.recommendedLevel?.length) {
    notes.push("سطحِ پیشنهادیِ سازنده: " + specs.recommendedLevel.join("، "));
  }

  return { why: why.slice(0, 5), notes };
}

/* ═══════════════════════ رتبه‌بندی ═══════════════════════ */

/**
 * خروجی نهایی: بهترین گزینه + دو جایگزین با بده‌بستان‌های متفاوت.
 *
 * کلِ روال (نرم‌کردنِ پله‌ایِ بودجه، مرتب‌سازی، انتخابِ جایگزینِ با محورِ
 * متفاوت) در scoringKernel.js است و با تنیس مشترک؛ این‌جا فقط دانشِ پدل تزریق
 * می‌شود.
 */
export function rankProducts({ products, targetProfile, answers = {}, weights = DEFAULT_WEIGHTS }) {
  return rankCatalog({
    products,
    targetProfile,
    answers,
    weights,
    hardFilter: applyHardConstraints,
    scoreOne: scoreProduct,
    explain: explainRecommendation,
    describeTradeoff,
    assess: assessConfidence,
  });
}

/** برچسبِ فارسیِ سطح — برای نمایش خلاصهٔ پروفایل */
export function levelLabel(level) {
  return LEVEL_LABELS[level] || level;
}

/** برچسب‌های نمایشی، برای اسکریپت‌های گزارش‌گیری */
export const LABELS = {
  shape: SHAPE_LABELS,
  core: CORE_LABELS,
  surface: SURFACE_LABELS,
  weight: WEIGHT_CLASS_LABELS,
  sweetSpot: SWEET_SPOT_LABELS,
};
