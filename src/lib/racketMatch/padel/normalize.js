/**
 * src/lib/racketMatch/padel/normalize.js
 *
 * تبدیل دادهٔ واقعیِ راکتِ پدل (product.attributes + product.technicalStats) به
 * «شناسنامهٔ فنی» با شکل یکسان و قابل امتیازدهی — هم‌ارزِ normalize.js تنیس و با
 * همان قاعدهٔ طلایی:
 *
 *   هیچ مقداری حدس زده نمی‌شود. هر چیزی که در دیتابیس نباشد یا قابل تفسیر نباشد
 *   null می‌ماند و موتور آن محور را کاملاً کنار می‌گذارد (نه اینکه جریمه‌اش کند).
 *
 * تفاوتِ دامنه با تنیس: راکتِ پدل زه ندارد، پس اندازهٔ صفحه، الگوی زهکشی و وزنِ
 * سویینگ اصلاً موضوعیت ندارند. به‌جایشان شکلِ فریم، بالانس، جنسِ رویه، هسته و
 * نقطهٔ شیرین می‌نشینند.
 *
 * ── دربارهٔ وزن، صریح ──────────────────────────────────────────────────────
 * دستهٔ راکتِ پدل در این فروشگاه فیلدِ وزن ندارد. تنها ردِ وزن، فیلدِ
 * «پیشنهاد برای» است که خودِ پرامپتِ ثبتِ محصول از روی وزن تولیدش می‌کند
 * (کمتر از ۳۵۰ گرم ⇒ خانم‌ها، ۳۵۰ تا ۳۷۰ ⇒ هر دو، بیشتر از ۳۷۰ ⇒ آقایان).
 * پس این‌جا فقط همان نگاشت برعکس می‌شود و نتیجه یک *ردهٔ* وزنی است، نه یک عدد.
 * اگر روزی ادمین فیلدِ عددیِ Weight را اضافه کند، عدد بر رده اولویت می‌گیرد و
 * این تابع خودبه‌خود دقیق‌تر می‌شود. هیچ‌جا وزن از قیمت، برند یا شکل استنتاج
 * نمی‌شود.
 */

import { cleanRaw, toNumber } from "../normalize.js";

/** «نامشخص»/«-»/خالی یعنی داده نداریم */
const UNKNOWN = /^(نامشخص|نا مشخص|ندارد|-{1,2}|—|null|undefined)$/i;

const isBlank = (raw) => !raw || UNKNOWN.test(raw);

/* ═══════════════════════ شکلِ فریم ═══════════════════════ */

/**
 * محورِ «تهاجمی‌بودنِ شکل»: ۰ = گردِ کاملاً کنترلی … ۱ = الماسیِ کاملاً قدرتی.
 *
 * عمداً پیوسته است تا شکلِ چهارمِ دادهٔ واقعی — هیبرید — جایی بین قطره‌اشکی و
 * الماسی بنشیند، به‌جای اینکه از جدولِ سه‌حالتی بیرون بیفتد و امتیاز نگیرد.
 */
export const SHAPE_OFFENSIVENESS = {
  round: 0,
  teardrop: 0.45,
  hybrid: 0.7,
  diamond: 1,
};

export const SHAPE_LABELS = {
  round: "گرد",
  teardrop: "قطره‌اشکی",
  hybrid: "هیبرید",
  diamond: "الماسی",
};

// ترتیب مهم است: «قطره اشکی» پیش از «گرد» بررسی می‌شود چون هر دو ممکن است در
// یک رشتهٔ توصیفی بیایند و شکلِ اصلی همان تخصصی‌تر است.
const SHAPE_TOKENS = [
  { re: /قطره|اشکی|اشک|teardrop|tear[- ]?drop/i, shape: "teardrop" },
  { re: /الماس|diamond/i, shape: "diamond" },
  { re: /هیبرید|هایبرید|ترکیبی|hybrid/i, shape: "hybrid" },
  { re: /گرد|round/i, shape: "round" },
];

/**
 * شکلِ فریم از فیلدِ Shape.
 * @returns {{shape: string|null, shapeOffensiveness: number|null}}
 */
export function parseShape(value) {
  const raw = cleanRaw(value);
  if (isBlank(raw)) return { shape: null, shapeOffensiveness: null };

  for (const token of SHAPE_TOKENS) {
    if (token.re.test(raw)) {
      return { shape: token.shape, shapeOffensiveness: SHAPE_OFFENSIVENESS[token.shape] };
    }
  }
  return { shape: null, shapeOffensiveness: null };
}

/* ═══════════════════════ بالانس ═══════════════════════ */

/**
 * حدهای رده‌بندیِ بالانس بر حسب سانتی‌متر — همان آستانه‌هایی که پرامپتِ ثبتِ
 * محصول استفاده می‌کند: کمتر از ۲۶.۵ دسته، ۲۶.۵ تا ۲۷.۵ میانه، بیشتر سرِ راکت.
 */
const BALANCE_LOW_CM = 26.5;
const BALANCE_HIGH_CM = 27.5;

/** بازهٔ فیزیکیِ ممکنِ نقطهٔ بالانسِ یک راکتِ پدل (طولِ قانونی ۴۵.۵ سانتی‌متر) */
const BALANCE_MIN_CM = 23;
const BALANCE_MAX_CM = 31;

/**
 * محورِ بالانس: ۰ = تمام‌وزن روی دسته … ۰.۵ = میانه … ۱ = تمام‌وزن روی سرِ راکت.
 * با این نگاشت، ۲۶.۵ روی ۰.۳۳ و ۲۷.۵ روی ۰.۶۷ می‌افتد؛ یعنی مرزهای بالا دقیقاً
 * سه‌تکه‌کنندهٔ محورند و رده و عدد هرگز با هم تناقض پیدا نمی‌کنند.
 */
const cmToBias = (cm) => Math.min(1, Math.max(0, (cm - 25.5) / 3));

/** واژه‌های بالانس در دادهٔ واقعی — ترتیب از دقیق به کلی */
const BALANCE_WORDS = [
  { re: /خنثی\s*(رو به|متمایل به|مایل به)\s*پایین|متوسط\s*(رو به|متمایل به)\s*پایین/, bias: 0.38 },
  { re: /خنثی\s*(رو به|متمایل به|مایل به)\s*بالا|متوسط\s*(رو به|متمایل به)\s*بالا/, bias: 0.62 },
  { re: /سر\s*سنگین|سرسنگین|head[- ]?heavy/i, bias: 0.85 },
  { re: /سر\s*سبک|سرسبک|head[- ]?light/i, bias: 0.15 },
  { re: /خنثی|میانه|متعادل|متوسط|even|neutral|medium/i, bias: 0.5 },
  { re: /سر\s*راکت|بالا|high/i, bias: 0.85 },
  { re: /دسته|پایین|low/i, bias: 0.15 },
];

/**
 * بالانس از فیلدِ Balance. دادهٔ واقعی سه شکل دارد و هر سه پشتیبانی می‌شود:
 *   «بالا، ۲۷.۵ سانتی‌متر»  → عدد + واژه
 *   «۲۵.۵»                  → فقط عدد
 *   «خنثی رو به پایین»       → فقط واژه
 *
 * عدد همیشه بر واژه اولویت دارد (دادهٔ دقیق‌تر بر دستهٔ کلی مقدم است). عددِ
 * بیرون از بازهٔ فیزیکیِ ممکن نادیده گرفته می‌شود تا مثلاً «۳۸ میلی‌متر» که
 * اشتباهاً در این فیلد افتاده باشد به بالانسِ خیالی تبدیل نشود.
 *
 * @returns {{balance: string|null, balancePointCm: number|null, balanceBias: number|null}}
 */
export function parseBalance(value) {
  const raw = cleanRaw(value);
  if (isBlank(raw)) return { balance: null, balancePointCm: null, balanceBias: null };

  const number = toNumber(raw);
  const cm = number !== null && number >= BALANCE_MIN_CM && number <= BALANCE_MAX_CM ? number : null;

  let bias = null;
  if (cm !== null) {
    bias = cmToBias(cm);
  } else {
    for (const word of BALANCE_WORDS) {
      if (word.re.test(raw)) {
        bias = word.bias;
        break;
      }
    }
  }

  if (bias === null) return { balance: null, balancePointCm: null, balanceBias: null };

  const balance =
    cm !== null
      ? cm < BALANCE_LOW_CM
        ? "low"
        : cm > BALANCE_HIGH_CM
          ? "high"
          : "even"
      : bias < 0.4
        ? "low"
        : bias > 0.6
          ? "high"
          : "even";

  return {
    balance,
    balancePointCm: cm,
    balanceBias: Math.round(bias * 100) / 100,
  };
}

/* ═══════════════════════ ردهٔ وزن ═══════════════════════ */

/** محورِ جرم: ۰ = سبک‌ترین … ۱ = سنگین‌ترین */
export const WEIGHT_CLASS_MASS = { light: 0.15, medium: 0.5, heavy: 0.85 };

export const WEIGHT_CLASS_LABELS = { light: "سبک", medium: "متوسط", heavy: "سنگین" };

/** مرزهای گرمیِ همان پرامپتی که «پیشنهاد برای» را می‌سازد */
const WEIGHT_LIGHT_MAX = 350;
const WEIGHT_HEAVY_MIN = 370;

const MENTIONS_WOMEN = /خانم|بانو|زنان|women|female/i;
// «اقایان» بدون کلاهِ آ هم در دادهٔ واقعی هست
const MENTIONS_MEN = /[آا]قایان|مردان|men|male/i;

/**
 * ردهٔ وزنی.
 *
 * @param {*} suitableFor مقدارِ خامِ «پیشنهاد برای»
 * @param {*} weightValue مقدارِ خامِ فیلدِ عددیِ وزن، اگر روزی اضافه شود
 * @returns {{weightGrams:number|null, weightClass:string|null, weightMass:number|null,
 *            weightFromProxy:boolean}}
 */
export function parseWeightClass(suitableFor, weightValue = null) {
  // ۱) عددِ واقعی، اگر باشد، همیشه برنده است
  const grams = toNumber(weightValue);
  if (grams !== null && grams >= 300 && grams <= 420) {
    const weightClass =
      grams < WEIGHT_LIGHT_MAX ? "light" : grams > WEIGHT_HEAVY_MIN ? "heavy" : "medium";
    return {
      weightGrams: grams,
      weightClass,
      // نگاشتِ پیوسته از گرم به محورِ جرم، تا ۳۵۲ و ۳۶۸ یکی حساب نشوند
      weightMass: Math.round(Math.min(1, Math.max(0, (grams - 335) / 50)) * 100) / 100,
      weightFromProxy: false,
    };
  }

  // ۲) وگرنه ردهٔ وزنی از «پیشنهاد برای» — برعکسِ همان نگاشتی که ساخته شده
  const raw = cleanRaw(suitableFor);
  if (isBlank(raw)) {
    return { weightGrams: null, weightClass: null, weightMass: null, weightFromProxy: false };
  }

  const women = MENTIONS_WOMEN.test(raw);
  const men = MENTIONS_MEN.test(raw);

  let weightClass = null;
  if (women && men) weightClass = "medium";
  else if (women) weightClass = "light";
  else if (men) weightClass = "heavy";

  if (!weightClass) {
    return { weightGrams: null, weightClass: null, weightMass: null, weightFromProxy: false };
  }

  return {
    weightGrams: null,
    weightClass,
    weightMass: WEIGHT_CLASS_MASS[weightClass],
    weightFromProxy: true,
  };
}

/* ═══════════════════════ جنسِ رویه ═══════════════════════ */

/** محورِ سفتیِ رویه: ۰ = نرم‌ترین (فایبرگلاس) … ۱ = مستقیم‌ترین (کربنِ کامل) */
export const SURFACE_STIFFNESS = { fiberglass: 0.2, hybrid: 0.55, carbon: 0.85 };

export const SURFACE_LABELS = {
  fiberglass: "فایبرگلاس",
  hybrid: "ترکیبی (کربن و فایبرگلاس)",
  carbon: "کربن",
};

const CARBON_RE = /کربن|carbon|گرافیت|graphite|textreme|tricarbon/i;
const FIBERGLASS_RE = /فایبرگلاس|فایبر\s*گلاس|fiber\s*glass|fiberglass|polyglass|الیاف\s*شیشه/i;
const HYBRID_RE = /هیبرید|هایبرید|ترکیبی|hybrid|fibrix/i;

/**
 * جنسِ رویه از «جنس رویه» و در نبودِ آن از «ترکیب ساخت».
 *
 * نکتهٔ عمدی: وقتی هر دو مادّه در متن آمده باشد نتیجه «ترکیبی» است، نه کربن.
 * فریمِ کربنی با سطحِ فایبرگلاس در حسِ ضربه یک راکتِ تمام‌کربن نیست و اگر
 * کربن را برنده اعلام کنیم، دقیقاً همان خطای «کربن یعنی بهتر» رخ می‌دهد.
 *
 * @returns {{surface:string|null, surfaceStiffness:number|null}}
 */
export function parseSurface(coating, composition) {
  const raw = [cleanRaw(coating), cleanRaw(composition)].filter((part) => !isBlank(part)).join(" ");
  if (!raw) return { surface: null, surfaceStiffness: null };

  const carbon = CARBON_RE.test(raw);
  const fiberglass = FIBERGLASS_RE.test(raw);
  const hybrid = HYBRID_RE.test(raw) || (carbon && fiberglass);

  let surface = null;
  if (hybrid) surface = "hybrid";
  else if (carbon) surface = "carbon";
  else if (fiberglass) surface = "fiberglass";

  if (!surface) return { surface: null, surfaceStiffness: null };
  return { surface, surfaceStiffness: SURFACE_STIFFNESS[surface] };
}

/* ═══════════════════════ هسته / فوم ═══════════════════════ */

/** محورِ سفتیِ هسته: ۰ = نرم‌ترین … ۱ = سفت‌ترین */
export const CORE_FIRMNESS = { soft: 0.2, medium: 0.5, firm: 0.85 };

export const CORE_LABELS = { soft: "نرم", medium: "متوسط", firm: "سفت" };

// ترتیب مهم است: «متوسط رو به سخت» باید پیش از «متوسط» و پیش از «سخت» بیفتد.
const CORE_TOKENS = [
  { re: /(متوسط|medium)\s*(رو به|متمایل به|مایل به)\s*(سخت|سفت)/i, firmness: 0.68 },
  { re: /(متوسط|medium)\s*(رو به|متمایل به|مایل به)\s*نرم/i, firmness: 0.35 },
  { re: /نرم|soft|cloud\s*eva|softeva|low\s*density|کم\s*چگالی/i, firmness: CORE_FIRMNESS.soft },
  {
    re: /سخت|سفت|hard|firm|متراکم|dense|high\s*density|چگالی\s*بالا/i,
    firmness: CORE_FIRMNESS.firm,
  },
  {
    re: /متوسط|medium|multi\s*-?\s*eva|multieva|چندچگالی|چند\s*چگالی|چندلایه|چند\s*لایه|دو\s*تراکمی|multilayer/i,
    firmness: CORE_FIRMNESS.medium,
  },
];

/**
 * هسته از «ترکیب ساخت».
 *
 * فقط بخشی از رشته خوانده می‌شود که واقعاً دربارهٔ هسته است («هسته …» یا
 * «فوم …»). بدونِ این برش، واژهٔ «نرم» در «سطح فایبرگلاس نرم» به‌اشتباه
 * هستهٔ نرم گزارش می‌شد.
 *
 * @returns {{core:string|null, coreFirmness:number|null}}
 */
export function parseCore(composition) {
  const raw = cleanRaw(composition);
  if (isBlank(raw)) return { core: null, coreFirmness: null };

  // از اولین اشارهٔ «هسته/فوم/core/foam/eva» تا انتهای رشته
  const match = raw.match(/(هسته|فوم|core|foam|eva)[\s\S]*/i);
  const segment = match ? match[0] : null;
  if (!segment) return { core: null, coreFirmness: null };

  for (const token of CORE_TOKENS) {
    if (token.re.test(segment)) {
      const firmness = token.firmness;
      const core = firmness < 0.4 ? "soft" : firmness > 0.6 ? "firm" : "medium";
      return { core, coreFirmness: firmness };
    }
  }

  // «EVA» بدون هیچ صفتی یعنی نوعِ فوم را می‌دانیم ولی سفتی‌اش را نه — حدس نمی‌زنیم
  return { core: null, coreFirmness: null };
}

/* ═══════════════════════ سطحِ بازی ═══════════════════════ */

/**
 * هفت پلهٔ سطحِ دادهٔ واقعی روی همان محورِ پیوستهٔ ۰..۱ که پروفایلِ بازیکن هم
 * رویش زندگی می‌کند. تنیس فقط سه پله داشت؛ پدل دقیق‌تر است و حیف است که
 * «متوسط-پیشرفته» و «حرفه‌ای» به یک سطل ریخته شوند.
 *
 * ترتیب مهم است: ترکیب‌ها پیش از تک‌واژه‌ها می‌آیند، وگرنه «مبتدی-متوسط» با
 * الگوی «مبتدی» زودتر گیر می‌افتد.
 */
const LEVEL_TOKENS = [
  { re: /پیشرفته\s*[-–]\s*حرفه/, score: 0.9 },
  { re: /متوسط\s*[-–]\s*پیشرفته/, score: 0.62 },
  { re: /مبتدی\s*[-–]\s*متوسط/, score: 0.25 },
  { re: /حرفه/, score: 1 },
  { re: /پیشرفته/, score: 0.78 },
  { re: /متوسط/, score: 0.45 },
  { re: /مبتدی|تازه/, score: 0.05 },
];

/**
 * سطحِ پیشنهادیِ محصول روی محورِ پیوسته.
 * @returns {{levelScore:number|null, recommendedLevel:string[]|null}}
 */
export function parseLevel(value) {
  const raw = cleanRaw(value);
  if (isBlank(raw)) return { levelScore: null, recommendedLevel: null };

  for (const token of LEVEL_TOKENS) {
    if (token.re.test(raw)) {
      return { levelScore: token.score, recommendedLevel: [raw] };
    }
  }
  return { levelScore: null, recommendedLevel: null };
}

/* ═══════════════════════ شاخص‌های اندازه‌گیری‌شده ═══════════════════════ */

/** امتیاز ۰..۱۰۰ از technicalStats — کلیدها در دیتابیس یکدست نیستند (power/Power) */
function stat(technicalStats, key) {
  if (!technicalStats) return null;
  const wanted = key.toLowerCase();
  const candidates = [technicalStats[key]];
  for (const [k, v] of Object.entries(technicalStats)) {
    if (k.toLowerCase().trim() === wanted) candidates.push(v);
  }
  for (const candidate of candidates) {
    if (candidate === "" || candidate === null || candidate === undefined) continue;
    const n = Number(candidate);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  }
  return null;
}

/**
 * دستهٔ نقطهٔ شیرین.
 *
 * فروشگاه فیلدِ جداگانه‌ای برای نقطهٔ شیرین ندارد و ساختنش از روی شکلِ فریم
 * یعنی حدس‌زدن. اما شاخصِ «بخشندگی» دقیقاً همان چیزی را می‌سنجد که نقطهٔ شیرینِ
 * بزرگ به بازیکن می‌دهد و برای همهٔ محصولات پر شده است. پس این‌جا فقط همان
 * عددِ واقعی برچسب می‌خورد — نه یک مشخصهٔ تازه از هوا.
 */
export function sweetSpotCategoryOf(forgiveness) {
  if (!Number.isFinite(forgiveness)) return null;
  if (forgiveness >= 78) return "large";
  if (forgiveness >= 62) return "medium";
  return "small";
}

export const SWEET_SPOT_SIZE = { small: 0.15, medium: 0.5, large: 0.9 };

export const SWEET_SPOT_LABELS = { small: "کوچک", medium: "متوسط", large: "بزرگ" };

/**
 * شناسنامهٔ فنیِ کاملِ یک راکتِ پدل. هر فیلدِ ناموجود = null.
 * @param {Object} product محصولِ lean با attributes/technicalStats
 */
export function normalizePadelSpecs(product) {
  const attributes = product?.attributes || {};
  const stats = product?.technicalStats || {};

  const { shape, shapeOffensiveness } = parseShape(attributes["Shape"]);
  const { balance, balancePointCm, balanceBias } = parseBalance(attributes["Balance"]);
  const { weightGrams, weightClass, weightMass, weightFromProxy } = parseWeightClass(
    attributes["Suitable for"],
    attributes["Weight"] ?? attributes["Unstrung Weight"],
  );
  const { surface, surfaceStiffness } = parseSurface(
    attributes["Coating"],
    attributes["Composition"],
  );
  const { core, coreFirmness } = parseCore(attributes["Composition"]);
  const { levelScore, recommendedLevel } = parseLevel(attributes["Level"]);

  const forgiveness = stat(stats, "forgiveness");
  const sweetSpot = sweetSpotCategoryOf(forgiveness);

  return {
    shape,
    shapeOffensiveness,
    balance,
    balancePointCm,
    balanceBias,
    weightGrams,
    weightClass,
    weightMass,
    weightFromProxy,
    surface,
    surfaceStiffness,
    core,
    coreFirmness,
    // ضخامت خوانده می‌شود چون دادهٔ واقعی است، اما امتیاز نمی‌گیرد: در این
    // کاتالوگ همهٔ راکت‌ها ۳۸ میلی‌متر (سقفِ قانونی) هستند و عاملی که برای همه
    // یکسان است هیچ محصولی را از دیگری جدا نمی‌کند.
    thicknessMm: toNumber(attributes["Thickness"]),
    frameMaterial: cleanRaw(attributes["Composition"]) || null,
    technologies: cleanRaw(attributes["Technologies"]) || null,
    levelScore,
    recommendedLevel,
    sweetSpot,
    sweetSpotSize: sweetSpot ? SWEET_SPOT_SIZE[sweetSpot] : null,
    powerLevel: stat(stats, "power"),
    controlLevel: stat(stats, "control"),
    spinPotential: stat(stats, "spin"),
    maneuverability: stat(stats, "maneuverability"),
    comfort: stat(stats, "comfort"),
    forgiveness,
    // «خروج توپ» مخصوصِ پدل است: چقدر توپ در ضربهٔ آرام راحت از صفحه جدا می‌شود
    ballOutput: stat(stats, "ball output"),
    hasCover: /دارد/.test(cleanRaw(attributes["Cover"])) && !/ندارد/.test(cleanRaw(attributes["Cover"])),
  };
}
