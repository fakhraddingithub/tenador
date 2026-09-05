/**
 * src/lib/racketMatch/engine.js
 *
 * موتور تطبیق راکت تنیس — منطقِ خالص، بدون هیچ وابستگی به React/Next/Mongoose،
 * تا بتوان مستقیم تستش کرد.
 *
 * پیاده‌سازیِ سندِ مرجع «Tennis Racket Recommendation Engine»:
 *   §20 درخت تصمیم، §21 جدول وزن‌ها، §22 شرط‌های قطعی در برابر ترجیح‌ها،
 *   §23 قواعد بده‌بستان، §24 خطاهای ممنوع، §27 پروفایل هدف، §28 قالب خروجی،
 *   §29 سطح اطمینان، §30 ترجمه به زبان ساده، §32 قاعدهٔ دادهٔ ناموجود.
 *
 * اصلِ حاکم: هیچ میان‌بُری مثل «مبتدی ⇐ راکت سبک» وجود ندارد. سطح بازی فقط یکی
 * از هفت ورودیِ ساختِ پروفایل هدف است و توان بدنی، سرعت ضربه، سبک، اولویت‌ها و
 * بازخوردِ راکت فعلی می‌توانند آن را جابه‌جا کنند.
 */

import { PRIORITY_LABELS, LEVEL_LABELS, assessConfidence } from "./questions.js";
import {
  clamp,
  filterByPrice,
  makeTradeoffDescriber,
  mid,
  proximity,
  rangeScore,
  rankCatalog,
  weightedScore,
} from "./scoringKernel.js";

// §29 در questions.js زندگی می‌کند تا رابط کاربری بتواند بدونِ کشیدنِ کلِ موتور به
// باندلِ کلاینت، سطح اطمینان را بسنجد. این‌جا فقط دوباره export می‌شود.
export { assessConfidence, hasEnoughForPreview } from "./questions.js";

// ابزارهای عددی، جمعِ وزن‌دار، فیلترِ قیمت و روالِ رتبه‌بندی در scoringKernel.js
// زندگی می‌کنند؛ موتور پدل هم دقیقاً همان‌ها را استفاده می‌کند.

/* ═══════════════════════ §27 ساخت پروفایل هدف ═══════════════════════ */

/**
 * سطحِ پیوسته‌ی بازی از ۰ (تازه‌کار) تا ۱ (تکنیکِ کامل).
 * عمداً پیوسته است تا مرزهای «مبتدی/متوسط/پیشرفته» به قواعدِ سفت‌وسخت تبدیل نشوند (§4).
 */
const LEVEL_SCORE = {
  new: 0,
  rally: 0.2,
  consistent: 0.45,
  fullswing: 0.62,
  competitive: 0.82,
  expert: 1,
};

const STRENGTH_SHIFT = { below: -14, average: 0, athletic: 8, strong: 14, verystrong: 18 };
const SWING_SHIFT = { slow: -10, moderate: 0, fast: 8, veryfast: 14 };

/** طولِ راکت جونیور (اینچ) — سن فقط نقطهٔ شروع است؛ قد بر آن ارجحیت دارد (§14) */
const JUNIOR_LENGTH_BY_AGE = { under10: 23, "10to13": 25.5, "14to17": 26.5 };
const JUNIOR_LENGTH_BY_HEIGHT = {
  under120: 21,
  "120to135": 23,
  "135to150": 25,
  "150to165": 26,
  over165: 27,
};

/** نمایه‌های شخصیتیِ سبکِ بازی روی هفت شاخصِ فنیِ فروشگاه (§13) */
const STYLE_CHARACTER = {
  power: { power: 88, control: 62, spin: 66, maneuverability: 70, stability: 72, comfort: 72, forgiveness: 82 },
  spin: { power: 74, control: 76, spin: 90, maneuverability: 80, stability: 74, comfort: 72, forgiveness: 74 },
  control: { power: 63, control: 90, spin: 72, maneuverability: 73, stability: 86, comfort: 72, forgiveness: 66 },
  "all-court": { power: 76, control: 79, spin: 77, maneuverability: 78, stability: 77, comfort: 75, forgiveness: 75 },
};

/** هدفِ «بازبودنِ» الگوی زهکشی بر حسب سبک (§10 — نه به‌صورت قاعدهٔ مطلق) */
const STYLE_OPENNESS = { power: 0.68, spin: 0.85, control: 0.22, "all-court": 0.5 };

/** سطحِ گسسته از امتیازِ پیوسته (فقط برای تطبیق با فیلدِ Level محصول) */
function levelLabelOf(levelScore) {
  if (levelScore < 0.35) return "beginner";
  if (levelScore < 0.72) return "intermediate";
  return "advanced";
}

/**
 * ساختِ پروفایلِ هدفِ راکت از پاسخ‌های بازیکن (و در صورت وجود، راکت فعلی او).
 *
 * @param {Object} answers پاسخ‌ها با واژگانِ questions.js
 * @param {Object|null} currentRacket شناسنامهٔ فنیِ راکت فعلی (خروجی normalizeRacketSpecs)
 * @returns {Object} پروفایل هدف
 */
export function buildTargetProfile(answers = {}, currentRacket = null) {
  const feedback = new Set(answers.currentFeedback || []);
  const priorities = (answers.priorities || []).slice(0, 3);
  const priorityRank = new Map(priorities.map((key, index) => [key, index]));
  const hasPriority = (key, maxRank = 2) =>
    priorityRank.has(key) && priorityRank.get(key) <= maxRank;

  /* ── گام ۱ (§20): جونیور یا بزرگسال ───────────────────────────── */
  const isJunior = Boolean(answers.age) && answers.age !== "adult";
  let targetLength = 27;
  if (isJunior) {
    const byAge = JUNIOR_LENGTH_BY_AGE[answers.age] ?? 26.5;
    const byHeight = answers.height ? JUNIOR_LENGTH_BY_HEIGHT[answers.height] : null;
    // قد بر سن ارجحیت دارد؛ در نبودِ قد فقط سن مبنا می‌شود
    targetLength = byHeight ?? byAge;
  }

  /* ── گام ۲: سطحِ واقعیِ بازی ───────────────────────────────────── */
  const levelScore = LEVEL_SCORE[answers.level] ?? 0.45;
  const level = levelLabelOf(levelScore);

  /* ── گام ۳ و ۴: توان بدنی و سرعت ضربه ─────────────────────────── */
  const strengthShift = STRENGTH_SHIFT[answers.strength] ?? 0;
  const swingShift = SWING_SHIFT[answers.swingSpeed] ?? 0;

  /* ── گام ۵ و ۶: سبک و اولویت‌ها ────────────────────────────────── */
  const style = answers.style || "all-court";

  /* ── گام ۷: پروفایل فنیِ هدف ───────────────────────────────────── */

  // وزن: مرکزِ بازه از سطحِ پیوسته می‌آید، سپس با توان بدنی، سرعت ضربه،
  // اولویت‌ها و بازخوردِ راکت فعلی جابه‌جا می‌شود (§5 و §24 خطای ۱ و ۲)
  let weightShift = strengthShift + swingShift;
  if (hasPriority("comfort", 1)) weightShift -= 6;
  if (hasPriority("maneuverability", 1)) weightShift -= 8;
  if (hasPriority("stability", 1)) weightShift += 8;
  if (feedback.has("too-heavy")) weightShift -= 15;
  if (feedback.has("unstable")) weightShift += 10;
  weightShift = clamp(weightShift, -28, 28);

  // مرکزِ بازه‌های سندِ مرجع (§4): مبتدی ۲۵۰–۲۸۰ ⇒ ۲۶۵، متوسط ۲۷۵–۳۰۰ ⇒ ۲۸۷،
  // پیشرفته ۲۹۵–۳۳۰ ⇒ ۳۱۲. نگاشتِ پیوسته دقیقاً از همین سه مرکز عبور می‌کند و
  // بعد با توان بدنی و سرعت ضربه جابه‌جا می‌شود — نه برعکس.
  let weightCenter = 265 + levelScore * 47 + weightShift;
  if (currentRacket?.unstrungWeight) {
    // §17: راکت فعلی، لنگرِ واقعی است — نصفِ وزنِ تصمیم را می‌گیرد
    let anchored = currentRacket.unstrungWeight;
    if (feedback.has("too-heavy")) anchored -= 15;
    if (feedback.has("unstable")) anchored += 10;
    weightCenter = (weightCenter + anchored) / 2;
  }
  const weightRange = [
    clamp(Math.round(weightCenter - 11), 230, 340),
    clamp(Math.round(weightCenter + 11), 230, 340),
  ];

  // اندازهٔ صفحه (§6) — بزرگ‌تر یعنی بخشنده‌تر و قدرتِ آسان‌تر، کوچک‌تر یعنی دقیق‌تر
  let headCenter = 105 - levelScore * 8;
  if (style === "control") headCenter -= 3;
  if (style === "power") headCenter += 3;
  if (hasPriority("forgiveness", 1)) headCenter += 4;
  if (hasPriority("power", 1)) headCenter += 3;
  if (hasPriority("control", 1)) headCenter -= 3;
  if (feedback.has("not-enough-power")) headCenter += 4;
  if (feedback.has("too-powerful")) headCenter -= 4;
  if (currentRacket?.headSize) headCenter = (headCenter + currentRacket.headSize) / 2;
  headCenter = clamp(headCenter, 93, 115);
  const headSizeRange = [
    Math.round((headCenter - 4) * 10) / 10,
    Math.round((headCenter + 4) * 10) / 10,
  ];

  // بالانس (§8) — به‌تنهایی هرگز پیش‌بینی‌کنندهٔ قدرت نیست (§24 خطای ۴)
  let balancePreference = ["even", "head-light", "head-heavy"];
  if (hasPriority("maneuverability", 1) || style === "control" || levelScore >= 0.72) {
    balancePreference = ["head-light", "even", "head-heavy"];
  } else if (
    (hasPriority("power", 1) || style === "power") &&
    mid(weightRange) < 290
  ) {
    balancePreference = ["head-heavy", "even", "head-light"];
  }

  // وزن سویینگ (§9) — فقط وقتی محصول این عدد را داشته باشد استفاده می‌شود
  let swingCenter = 285 + levelScore * 35 + weightShift / 2;
  if (hasPriority("maneuverability", 1)) swingCenter -= 8;
  if (hasPriority("stability", 1)) swingCenter += 8;
  if (feedback.has("too-heavy")) swingCenter -= 12;
  if (feedback.has("unstable")) swingCenter += 10;
  if (currentRacket?.swingweight) {
    let anchored = currentRacket.swingweight;
    if (feedback.has("too-heavy")) anchored -= 12;
    if (feedback.has("unstable")) anchored += 10;
    swingCenter = (swingCenter + anchored) / 2;
  }
  const swingweightRange = [
    clamp(Math.round(swingCenter - 12), 260, 345),
    clamp(Math.round(swingCenter + 12), 260, 345),
  ];

  // الگوی زهکشی (§10) — به‌صورتِ «میزانِ بازبودنِ هدف»، نه یک enum سفت
  let targetOpenness = STYLE_OPENNESS[style] ?? 0.5;
  if (hasPriority("spin", 1)) targetOpenness += 0.12;
  if (hasPriority("control", 1)) targetOpenness -= 0.12;
  if (feedback.has("want-more-spin")) targetOpenness += 0.1;
  if (feedback.has("too-powerful")) targetOpenness -= 0.08;
  targetOpenness = clamp(targetOpenness, 0, 1);

  // نمایهٔ شخصیتیِ هدف روی هفت شاخص — پایه از سبک، سپس اولویت‌ها آن را بالا می‌برند
  const character = { ...(STYLE_CHARACTER[style] || STYLE_CHARACTER["all-court"]) };
  const PRIORITY_FLOOR = [92, 86, 80];
  priorities.forEach((key, index) => {
    if (character[key] !== undefined) {
      character[key] = Math.max(character[key], PRIORITY_FLOOR[index] ?? 80);
    }
  });
  if (feedback.has("uncomfortable")) character.comfort = Math.max(character.comfort, 88);
  if (feedback.has("not-enough-power")) character.power = Math.max(character.power, 84);
  if (feedback.has("too-powerful")) character.control = Math.max(character.control, 86);
  if (feedback.has("unstable")) character.stability = Math.max(character.stability, 86);
  if (feedback.has("want-more-spin")) character.spin = Math.max(character.spin, 88);

  // راحتی و سختیِ فریم (§12 و §18) — یک ترجیحِ ثانویه، نه فیلترِ اول
  const comfortPriority =
    hasPriority("comfort", 1) || feedback.has("uncomfortable") ? "high" : "normal";

  return {
    isJunior,
    level,
    levelScore,
    style,
    priorities,
    weightRange,
    headSizeRange,
    balancePreference,
    swingweightRange,
    targetOpenness,
    lengthTarget: targetLength,
    character,
    comfortPriority,
    maxStiffnessRA: comfortPriority === "high" ? 65 : null,
    priceRange: answers.priceRange || null,
    currentRacket: currentRacket || null,
    feedback: [...feedback],
  };
}

/* ═══════════════════════ §21 امتیازدهی ═══════════════════════ */

/** جدول وزنِ سند مرجع، بدون تغییر */
export const DEFAULT_WEIGHTS = {
  level: 0.2,
  style: 0.15,
  weightSwing: 0.15,
  headSize: 0.1,
  balance: 0.1,
  stringPattern: 0.1,
  powerControl: 0.1,
  maneuverStability: 0.05,
  comfortStiffness: 0.05,
};

const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

/** فاصلهٔ سطحِ محصول تا سطحِ بازیکن → امتیاز */
function scoreLevel(specs, target) {
  if (!specs.recommendedLevel?.length) return null;
  const playerIndex = LEVEL_ORDER[target.level];
  let best = 0;
  for (const productLevel of specs.recommendedLevel) {
    const distance = Math.abs((LEVEL_ORDER[productLevel] ?? 1) - playerIndex);
    const score = distance === 0 ? 1 : distance === 1 ? 0.55 : 0.1;
    if (score > best) best = score;
  }
  return best;
}

/**
 * سبک بازی. اگر ادمین سبکِ پیشنهادی را صریح ثبت کرده باشد از آن استفاده می‌شود،
 * وگرنه از شاخص‌های فنیِ اندازه‌گیری‌شدهٔ خودِ محصول (که دادهٔ واقعی است، نه حدس).
 */
function scoreStyle(specs, target) {
  if (specs.recommendedPlayingStyles?.length) {
    return specs.recommendedPlayingStyles.includes(target.style) ? 1 : 0.4;
  }
  const archetype = STYLE_CHARACTER[target.style] || STYLE_CHARACTER["all-court"];
  const axes = [
    ["power", specs.powerLevel],
    ["control", specs.controlLevel],
    ["spin", specs.spinPotential],
    ["maneuverability", specs.maneuverability],
    ["stability", specs.stability],
    ["forgiveness", specs.forgiveness],
  ].filter(([, value]) => Number.isFinite(value));
  if (!axes.length) return null;
  const total = axes.reduce((sum, [key, value]) => sum + proximity(value, archetype[key]), 0);
  return total / axes.length;
}

/**
 * وزن و وزنِ سویینگ (§9). وقتی وزن سویینگ موجود است سهمِ بیشتری می‌گیرد، چون
 * دو راکتِ ۳۰۰ گرمی می‌توانند در دست کاملاً متفاوت حس شوند (§24 خطای ۸).
 */
function scoreWeightSwing(specs, target) {
  const staticScore = rangeScore(specs.unstrungWeight, target.weightRange, 25);
  const swingScore = rangeScore(specs.swingweight, target.swingweightRange, 25);
  if (staticScore !== null && swingScore !== null) return staticScore * 0.4 + swingScore * 0.6;
  return swingScore ?? staticScore;
}

function scoreBalance(specs, target) {
  if (!specs.balance) return null;
  const index = target.balancePreference.indexOf(specs.balance);
  return [1, 0.6, 0.25][index] ?? 0.25;
}

function scoreStringPattern(specs, target) {
  if (!Number.isFinite(specs.patternOpenness)) return null;
  return clamp(1 - Math.abs(specs.patternOpenness - target.targetOpenness), 0, 1);
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

function scoreComfortStiffness(specs, target) {
  const parts = [];
  if (Number.isFinite(specs.comfort)) parts.push(proximity(specs.comfort, target.character.comfort));
  if (Number.isFinite(specs.frameStiffnessRA) && target.maxStiffnessRA) {
    const over = specs.frameStiffnessRA - target.maxStiffnessRA;
    parts.push(over <= 0 ? 1 : clamp(1 - over / 12, 0, 1));
  }
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/**
 * امتیاز سازگاریِ یک محصول با پروفایل هدف.
 * هر عاملی که دادهٔ محصول برای آن موجود نیست، به‌کلی کنار گذاشته می‌شود و وزن‌های
 * باقی‌مانده دوباره نرمال می‌شوند (§32) — نه جریمه، نه حدس.
 *
 * @returns {{score:number, factors:Object, coverage:number}} امتیاز ۰..۱۰۰
 */
export function scoreProduct(product, targetProfile, weights = DEFAULT_WEIGHTS) {
  const specs = product.specs || product;
  const raw = {
    level: scoreLevel(specs, targetProfile),
    style: scoreStyle(specs, targetProfile),
    weightSwing: scoreWeightSwing(specs, targetProfile),
    headSize: rangeScore(specs.headSize, targetProfile.headSizeRange, 8),
    balance: scoreBalance(specs, targetProfile),
    stringPattern: scoreStringPattern(specs, targetProfile),
    powerControl: scorePairedAxes(targetProfile, [
      ["power", specs.powerLevel],
      ["control", specs.controlLevel],
    ]),
    maneuverStability: scorePairedAxes(targetProfile, [
      ["maneuverability", specs.maneuverability],
      ["stability", specs.stability],
    ]),
    comfortStiffness: scoreComfortStiffness(specs, targetProfile),
  };

  return weightedScore(raw, weights);
}

/* ═══════════════════════ §22 شرط‌های قطعی ═══════════════════════ */

const JUNIOR_LENGTH_CUTOFF = 26.5;

/**
 * فیلترِ شرط‌های قطعی. دادهٔ ناموجود «نقض» به حساب نمی‌آید (§32) — فقط مقدارِ
 * موجودی که با شرط جور نیست حذف می‌شود.
 *
 * @returns {{products: Array, rejected: Object}}
 */
export function applyHardConstraints(products, targetProfile, priceRange = null) {
  let sizeRejected = 0;

  // اندازهٔ جونیور/بزرگسال — شرطِ قطعیِ مخصوصِ تنیس
  const sized = products.filter((product) => {
    const specs = product.specs || product;
    if (!Number.isFinite(specs.length)) return true;
    const juniorSized = specs.length < JUNIOR_LENGTH_CUTOFF;
    if (targetProfile.isJunior !== juniorSized) {
      sizeRejected += 1;
      return false;
    }
    return true;
  });

  // بودجه — همان فیلترِ مشترکِ هستهٔ امتیازدهی
  const { products: kept, rejected: priceRejected } = filterByPrice(sized, priceRange);

  return { products: kept, rejected: { price: priceRejected, size: sizeRejected } };
}

/* ═══════════════════════ §23 و §28 بده‌بستان و خروجی ═══════════════════════ */

/**
 * محورهای بده‌بستان. برای هر محور: چطور از روی شناسنامه استخراجش کنیم و جمله‌های
 * فارسیِ «بیشتر»/«کمتر» نسبت به بهترین گزینه.
 */
const TRADEOFF_AXES = [
  {
    key: "weight",
    get: (specs) => specs.unstrungWeight,
    threshold: 8,
    more: "کمی سنگین‌تر است و پشت توپ جان بیشتری می‌گذارد، اما چرخاندنش انرژی بیشتری می‌خواهد.",
    less: "سبک‌تر است و راحت‌تر می‌چرخد، اما مقابل ضربه‌های خیلی سنگین کمی کم می‌آورد.",
  },
  {
    key: "stability",
    get: (specs) => specs.stability,
    threshold: 6,
    more: "مقابل ضربه‌های سنگین ثابت‌تر می‌ایستد، اما به همان اندازه چابک نیست.",
    less: "چابک‌تر است، اما در برابر ضربه‌های سنگین کمی کمتر می‌ایستد.",
  },
  {
    key: "maneuverability",
    get: (specs) => specs.maneuverability,
    threshold: 6,
    more: "سریع‌تر در دست می‌چرخد و کنار تور دستتان را باز می‌گذارد، اما کمی از پایداری کم می‌کند.",
    less: "کمی سنگین‌تر در دست می‌چرخد، اما در عوض ثبات بیشتری دارد.",
  },
  {
    key: "forgiveness",
    get: (specs) => specs.forgiveness,
    threshold: 6,
    more: "ضربه‌های خارج از مرکز را بیشتر می‌بخشد، اما به اندازهٔ گزینهٔ اول دقیق نیست.",
    less: "دقیق‌تر است، اما ضربهٔ ناجور را کمتر می‌بخشد.",
  },
  {
    key: "control",
    get: (specs) => specs.controlLevel,
    threshold: 6,
    more: "توپ را دقیق‌تر سرِ جایش می‌گذارد، اما قدرتِ آماده‌اش کمتر است.",
    less: "قدرتِ آماده‌تری دارد، اما به همان اندازه دقیق نیست.",
  },
  {
    key: "power",
    get: (specs) => specs.powerLevel,
    threshold: 6,
    more: "بدون تلاش بیشتر، توپ را سنگین‌تر می‌فرستد، اما مهارِ آن دقت بیشتری می‌خواهد.",
    less: "آرام‌تر است و مهارش ساده‌تر، اما باید بیشتر خودتان قدرت بسازید.",
  },
  {
    key: "spin",
    get: (specs) => specs.spinPotential,
    threshold: 6,
    more: "چرخاندن توپ با آن ساده‌تر است، اما مسیرِ توپ کمی بلندتر می‌شود.",
    less: "مسیر توپ صاف‌تر و قابل‌پیش‌بینی‌تر است، اما اسپین کمتری می‌دهد.",
  },
  {
    key: "comfort",
    get: (specs) => specs.comfort,
    threshold: 6,
    more: "لرزش کمتری به دست می‌دهد و برای بازی طولانی راحت‌تر است.",
    less: "حسِ خشک‌تر و مستقیم‌تری دارد، اما لرزش بیشتری به دست می‌رسد.",
  },
];

/**
 * تفاوتِ اصلیِ یک گزینه نسبت به بهترین گزینه — همان چیزی که §28 می‌خواهد.
 * @param {Set<string>} usedAxes محورهایی که قبلاً برای گزینهٔ دیگری استفاده شده‌اند
 */
export const describeTradeoff = makeTradeoffDescriber(
  TRADEOFF_AXES,
  "بسیار نزدیک به گزینهٔ اول است، با حس ضربهٔ کمی متفاوت.",
);

/* ═══════════════════════ §30 توضیح به زبان ساده ═══════════════════════ */

const HEAD_SIZE_TEXT = {
  small: "صفحهٔ جمع‌وجورش به ضربه‌های دقیق‌تر کمک می‌کند.",
  medium: "اندازهٔ صفحه‌اش حد وسط است: هم می‌بخشد، هم دقیق می‌ماند.",
  large: "صفحهٔ بزرگش ضربه‌های خارج از مرکز را می‌بخشد.",
};

const BALANCE_TEXT = {
  "head-light": "وزنش به سمت دسته است، پس سریع در دست می‌چرخد.",
  even: "وزنش متعادل پخش شده و حسی میانه می‌دهد.",
  "head-heavy": "وزنش به سمت صفحه است و به ضربه جان بیشتری می‌دهد.",
};

/**
 * جمله‌های «چرا این به شما می‌خورد» — کاملاً غیرفنی (§30).
 * هیچ‌جا واژه‌هایی مثل «وزن سویینگ» یا «RA» به کاربر نشان داده نمی‌شود.
 *
 * @returns {{why: string[], notes: string[]}}
 */
export function explainRecommendation(product, targetProfile) {
  const specs = product.specs || product;
  const why = [];
  const notes = [];

  // وزن — همیشه مهم‌ترین جملهٔ کاربرپسند
  if (Number.isFinite(specs.unstrungWeight)) {
    const [low, high] = targetProfile.weightRange;
    if (specs.unstrungWeight <= high && specs.unstrungWeight >= low) {
      why.push("وزنش دقیقاً در همان محدوده‌ای است که با توان و سرعت ضربهٔ شما جور درمی‌آید.");
    } else if (specs.unstrungWeight < low) {
      why.push("کمی سبک‌تر از حد معمولِ این سطح است تا تا آخر بازی از دستتان درنیاید.");
    } else {
      why.push("کمی سنگین‌تر است تا پشت توپ بایستد و ضربه‌های سنگین حریف را پس بزند.");
    }
  }

  if (specs.headSizeCategory && HEAD_SIZE_TEXT[specs.headSizeCategory]) {
    why.push(HEAD_SIZE_TEXT[specs.headSizeCategory]);
  }

  // اولویت‌هایی که این راکت واقعاً در آن‌ها قوی است
  const strongPriorities = (targetProfile.priorities || []).filter((key) => {
    const value = {
      power: specs.powerLevel,
      control: specs.controlLevel,
      spin: specs.spinPotential,
      maneuverability: specs.maneuverability,
      stability: specs.stability,
      comfort: specs.comfort,
      forgiveness: specs.forgiveness,
    }[key];
    return Number.isFinite(value) && value >= 78;
  });
  if (strongPriorities.length) {
    const labels = strongPriorities.map((key) => PRIORITY_LABELS[key]).join(" و ");
    why.push("در " + labels + " — یعنی همان چیزی که برایتان مهم‌تر بود — نمرهٔ بالایی دارد.");
  }

  if (specs.balance && BALANCE_TEXT[specs.balance] && why.length < 4) {
    why.push(BALANCE_TEXT[specs.balance]);
  }

  if (targetProfile.comfortPriority === "high" && Number.isFinite(specs.comfort) && specs.comfort >= 80) {
    why.push("لرزش کمی به دست منتقل می‌کند و برای بازی طولانی راحت‌تر است.");
  }

  // یادداشت‌های کاربردی (نه فنی)
  // پرسشنامه دیگر شمارهٔ گریپ را نمی‌پرسد، پس به‌جای فیلترکردن، سایزهای موجود
  // را نشان می‌دهیم تا کاربر خودش روی صفحهٔ محصول انتخاب کند.
  if (specs.gripSizes?.length) {
    notes.push("سایز دسته: " + specs.gripSizes.join("، "));
  }

  return { why: why.slice(0, 4), notes };
}

/* ═══════════════════════ §20 گام ۹: رتبه‌بندی ═══════════════════════ */

/**
 * جونیور شرطِ قطعیِ اندازه است و هرگز نرم نمی‌شود؛ اگر فروشگاه راکتِ رده‌سنی
 * نداشته باشد باید همین را صریح گفت، نه اینکه راکتِ بزرگسال جایش گذاشته شود.
 */
function juniorEmptyNotice(targetProfile) {
  if (!targetProfile.isJunior) return null;
  return "در حال حاضر راکتِ مخصوصِ این رده سنی در فروشگاه موجود نیست. راکتِ بزرگسال برای این قد و سن مناسب نیست، پس چیزی جایگزینش نکردیم.";
}

/**
 * خروجی نهایی طبق §28: بهترین گزینه + دو جایگزین با بده‌بستان‌های متفاوت.
 *
 * کلِ روال (نرم‌کردنِ پله‌ایِ بودجه، مرتب‌سازی، انتخابِ جایگزینِ با محورِ متفاوت)
 * در scoringKernel.js است و بین تنیس و پدل مشترک؛ این‌جا فقط دانشِ تنیس تزریق
 * می‌شود.
 *
 * @param {Object} input
 * @param {Array}  input.products محصولات با فیلد specs و قیمتِ تومانی
 * @param {Object} input.targetProfile خروجی buildTargetProfile
 * @param {Object} input.answers پاسخ‌های خام (برای سطح اطمینان)
 * @param {Object} [input.weights]
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
    emptyNotice: juniorEmptyNotice,
  });
}

/** برچسبِ فارسیِ سطح — برای نمایش خلاصهٔ پروفایل */
export function levelLabel(level) {
  return LEVEL_LABELS[level] || level;
}
