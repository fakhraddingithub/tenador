/**
 * src/lib/racketMatch/scoringKernel.js
 *
 * هستهٔ مشترکِ امتیازدهی و رتبه‌بندی — بدونِ هیچ دانشِ ورزشی.
 *
 * این فایل از موتور تنیس بیرون کشیده شده تا موتور پدل دقیقاً همان معماری،
 * همان قاعدهٔ نرمال‌سازیِ وزن‌ها، همان روالِ نرم‌کردنِ بودجه، همان انتخابِ
 * جایگزین‌ها و همان قالبِ خروجی را داشته باشد — نه یک پیاده‌سازیِ موازی.
 * دانشِ هر ورزش (پروفایل هدف، عامل‌های امتیاز، محورهای بده‌بستان، جمله‌های
 * توضیح) از بیرون تزریق می‌شود.
 *
 * قواعدی که این‌جا نگه داشته می‌شوند و برای هر دو ورزش یکسان‌اند:
 *   • عاملِ بدونِ داده حذف می‌شود و وزن‌های باقی‌مانده دوباره نرمال می‌شوند —
 *     نه جریمه، نه حدس.
 *   • بودجه شرطِ قطعی است، ولی در کمبودِ نتیجه پله‌پله نرم می‌شود و همیشه به
 *     کاربر گفته می‌شود.
 *   • دو جایگزین باید محورِ بده‌بستانِ متفاوتی داشته باشند، وگرنه سه کارتِ
 *     تقریباً یکسان نشان داده می‌شود.
 */

/* ═══════════════════════ ابزارهای عددی ═══════════════════════ */

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** امتیازِ عضویت در یک بازه: داخلِ بازه ۱، بیرون از آن افتِ خطی تا صفر */
export function rangeScore(value, [low, high], falloff) {
  if (!Number.isFinite(value)) return null;
  if (value >= low && value <= high) return 1;
  const distance = value < low ? low - value : value - high;
  return clamp(1 - distance / falloff, 0, 1);
}

/** فاصلهٔ دو مقدارِ ۰..۱۰۰ به‌صورت امتیازِ ۰..۱ */
export const proximity = (a, b) => clamp(1 - Math.abs(a - b) / 100, 0, 1);

export const mid = ([low, high]) => (low + high) / 2;

/* ═══════════════════════ امتیازِ وزن‌دار ═══════════════════════ */

/**
 * جمعِ وزن‌دارِ عامل‌ها با نرمال‌سازیِ مجددِ وزن‌ها.
 *
 * عاملی که مقدارش null باشد یعنی «محصول این داده را ندارد»؛ کاملاً از جمع و
 * از مخرج بیرون می‌رود. پس یک محصولِ کم‌داده نه جریمه می‌شود و نه پاداش
 * می‌گیرد — فقط coverage اش پایین می‌آید که خودش در مرتب‌سازی تساوی‌شکن است.
 *
 * @param {Object} raw نگاشتِ نامِ عامل به امتیازِ ۰..۱ یا null
 * @param {Object} weights نگاشتِ نامِ عامل به وزن
 * @returns {{score:number, factors:Object, coverage:number}} score روی ۰..۱۰۰
 */
export function weightedScore(raw, weights) {
  let weighted = 0;
  let usedWeight = 0;
  const factors = {};

  for (const [key, weight] of Object.entries(weights)) {
    const value = raw[key];
    if (value === null || value === undefined) {
      factors[key] = { score: null, weight, used: false };
      continue;
    }
    weighted += value * weight;
    usedWeight += weight;
    factors[key] = { score: Math.round(value * 100) / 100, weight, used: true };
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return {
    score: usedWeight > 0 ? Math.round((weighted / usedWeight) * 1000) / 10 : 0,
    factors,
    coverage: Math.round((usedWeight / totalWeight) * 100) / 100,
  };
}

/* ═══════════════════════ بده‌بستان ═══════════════════════ */

/**
 * ساختِ توصیف‌گرِ بده‌بستان از روی جدولِ محورهای یک ورزش.
 *
 * هر محور یک شیء با کلیدهای key/get/threshold/more/less است. بزرگ‌ترین اختلافِ
 * معنادار (بالاتر از آستانه) انتخاب می‌شود و محورهایی که قبلاً برای جایگزینِ
 * دیگری استفاده شده‌اند کنار گذاشته می‌شوند.
 */
export function makeTradeoffDescriber(axes, fallbackText) {
  return function describeTradeoff(candidate, best, usedAxes = new Set()) {
    const candidateSpecs = candidate.specs || candidate;
    const bestSpecs = best.specs || best;

    let chosen = null;
    let chosenDelta = 0;
    for (const axis of axes) {
      if (usedAxes.has(axis.key)) continue;
      const a = axis.get(candidateSpecs);
      const b = axis.get(bestSpecs);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const delta = a - b;
      if (Math.abs(delta) < axis.threshold) continue;
      if (Math.abs(delta) > Math.abs(chosenDelta)) {
        chosen = axis;
        chosenDelta = delta;
      }
    }

    if (!chosen) return { axis: null, text: fallbackText };
    return { axis: chosen.key, text: chosenDelta > 0 ? chosen.more : chosen.less };
  };
}

/* ═══════════════════════ شرطِ قطعیِ بودجه ═══════════════════════ */

/**
 * فیلترِ قیمت. محصولِ بی‌قیمت نقضِ شرط به حساب نمی‌آید و حذف نمی‌شود.
 * @returns {{products: Array, rejected: number}}
 */
export function filterByPrice(products, priceRange) {
  if (!priceRange) return { products, rejected: 0 };

  let rejected = 0;
  const kept = products.filter((product) => {
    const price = product.finalPriceToman ?? product.basePriceToman;
    if (!Number.isFinite(price) || price <= 0) return true;
    if (Number.isFinite(priceRange.min) && price < priceRange.min) {
      rejected += 1;
      return false;
    }
    if (Number.isFinite(priceRange.max) && price > priceRange.max) {
      rejected += 1;
      return false;
    }
    return true;
  });

  return { products: kept, rejected };
}

/* ═══════════════════════ رتبه‌بندی ═══════════════════════ */

const MIN_RESULTS = 3;
/** فقط از میان گزینه‌های واقعاً رقابتی جایگزین انتخاب می‌شود، نه از کلِ فهرست */
const ALTERNATIVE_POOL = 15;

const RELAX_WIDENED = "برای اینکه دستتان خالی نماند، بازهٔ قیمتی را کمی بازتر گرفتیم.";
const RELAX_DROPPED =
  "در بازهٔ قیمتی انتخابی، گزینهٔ کافی نبود؛ نزدیک‌ترین‌ها را بیرون از آن بازه آورده‌ایم.";

/** انتخابِ گزینهٔ بعدی با محورِ بده‌بستانِ متفاوت */
function pickAlternative(pool, best, usedAxes, describeTradeoff) {
  let fallback = null;
  for (const candidate of pool) {
    const tradeoff = describeTradeoff(candidate, best, usedAxes);
    if (tradeoff.axis) return { candidate, tradeoff };
    if (!fallback) fallback = { candidate, tradeoff };
  }
  return fallback;
}

/**
 * روالِ کاملِ فیلتر ← امتیاز ← مرتب‌سازی ← بهترین + دو جایگزین + توضیح.
 *
 * @param {Object}   input
 * @param {Array}    input.products
 * @param {Object}   input.targetProfile باید priceRange داشته باشد (یا null)
 * @param {Object}   input.answers فقط برای سنجشِ اطمینان
 * @param {Object}   input.weights
 * @param {Function} input.hardFilter سه ورودیِ products/targetProfile/priceRange
 * @param {Function} input.scoreOne سه ورودیِ product/targetProfile/weights
 * @param {Function} input.explain دو ورودیِ product/targetProfile
 * @param {Function} input.describeTradeoff سه ورودیِ candidate/best/usedAxes
 * @param {Function} input.assess یک ورودیِ answers
 * @param {Function} [input.emptyNotice] وقتی هیچ گزینه‌ای نماند، جملهٔ توضیح
 */
export function rankCatalog({
  products,
  targetProfile,
  answers = {},
  weights,
  hardFilter,
  scoreOne,
  explain,
  describeTradeoff,
  assess,
  emptyNotice = null,
}) {
  const relaxations = [];
  const priceRange = targetProfile.priceRange || null;

  let { products: eligible } = hardFilter(products, targetProfile, priceRange);

  // پلهٔ اول: بازهٔ قیمتی کمی بازتر
  if (eligible.length < MIN_RESULTS && priceRange) {
    const widened = {
      min: Number.isFinite(priceRange.min) ? Math.round(priceRange.min * 0.7) : null,
      max: Number.isFinite(priceRange.max) ? Math.round(priceRange.max * 1.3) : null,
    };
    const retry = hardFilter(products, targetProfile, widened);
    if (retry.products.length > eligible.length) {
      eligible = retry.products;
      relaxations.push(RELAX_WIDENED);
    }
  }
  // پلهٔ دوم: بودجه کنار می‌رود — ولی صریح گفته می‌شود
  if (eligible.length < MIN_RESULTS) {
    const retry = hardFilter(products, targetProfile, null);
    if (retry.products.length > eligible.length) {
      eligible = retry.products;
      relaxations.length = 0;
      relaxations.push(RELAX_DROPPED);
    }
  }

  // شرط‌های قطعیِ غیرِ قیمتی هرگز نرم نمی‌شوند؛ اگر چیزی نماند باید صریح گفته شود
  if (!eligible.length && emptyNotice) {
    const notice = emptyNotice(targetProfile);
    if (notice) relaxations.push(notice);
  }

  const scored = eligible
    .map((product) => ({ ...product, match: scoreOne(product, targetProfile, weights) }))
    .sort((a, b) => b.match.score - a.match.score || b.match.coverage - a.match.coverage);

  const confidence = assess(answers);

  if (!scored.length) {
    return { best: null, alternatives: [], confidence, relaxations, totalCandidates: 0 };
  }

  const best = scored[0];
  const pool = scored.slice(1, ALTERNATIVE_POOL);
  const usedAxes = new Set();
  const alternatives = [];

  for (let i = 0; i < 2 && pool.length; i += 1) {
    const picked = pickAlternative(pool, best, usedAxes, describeTradeoff);
    if (!picked) break;
    if (picked.tradeoff.axis) usedAxes.add(picked.tradeoff.axis);
    alternatives.push({ ...picked.candidate, tradeoff: picked.tradeoff });
    pool.splice(pool.indexOf(picked.candidate), 1);
  }

  const decorate = (item, rank) => ({ ...item, rank, explanation: explain(item, targetProfile) });

  return {
    best: decorate(best, 0),
    alternatives: alternatives.map((item, index) => decorate(item, index + 1)),
    confidence,
    relaxations,
    totalCandidates: scored.length,
  };
}
