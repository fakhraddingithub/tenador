/**
 * src/lib/racketMatch/matchApi.js
 *
 * بدنهٔ مشترکِ مسیرهای API تطبیق (تنیس و پدل).
 *
 * چرا مشترک؟ چون تفاوتِ دو مسیر فقط در «واژگانِ مجاز» و «کدام موتور» است؛ باقیِ
 * کار — پاک‌سازیِ ورودیِ عمومی، پیدا کردنِ راکت فعلی، ساختِ پروفایل هدف،
 * رتبه‌بندی، و مهم‌تر از همه خواندنِ دادهٔ نمایشیِ کامل برای همان سه برنده — در
 * هر دو یکی است. دوباره‌نویسیِ آن یعنی روزی یکی از دو مسیر از قلم می‌افتد؛
 * دقیقاً همان باگِ «نمایش سریعِ ناقص» که resultPayload.js برای رفعش ساخته شد.
 *
 * این ماژول فقط سمتِ سرور اجرا می‌شود.
 */

import { loadDisplayProducts } from "base/services/racketMatch.service";
import { mergeRankedWithDisplay } from "./resultPayload.js";

/** شناسهٔ مونگو — تنها شکلی که به‌عنوان «راکت فعلی» پذیرفته می‌شود */
const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * پاک‌سازیِ پاسخ‌ها. ورودی عمومی است، پس فقط مقادیرِ شناخته‌شده پذیرفته می‌شوند
 * و هر چیزِ دیگری بی‌سروصدا کنار گذاشته می‌شود (نه خطا، تا یک گزینهٔ ناشناخته
 * کلِ پرسشنامه را نشکند).
 *
 * @param {Object} raw بدنهٔ درخواست
 * @param {Object} config
 * @param {Object} config.allowed نگاشتِ نامِ گام به فهرستِ مقادیرِ مجاز
 * @param {string[]} config.priorityKeys
 * @param {string[]} config.feedbackKeys
 */
export function sanitizeAnswers(raw = {}, { allowed, priorityKeys, feedbackKeys }) {
  const answers = {};

  for (const [key, values] of Object.entries(allowed)) {
    if (values.includes(raw[key])) answers[key] = raw[key];
  }

  if (Array.isArray(raw.priorities)) {
    answers.priorities = raw.priorities.filter((k) => priorityKeys.includes(k)).slice(0, 3);
  }
  if (Array.isArray(raw.currentFeedback)) {
    answers.currentFeedback = raw.currentFeedback
      .filter((k) => feedbackKeys.includes(k))
      .slice(0, feedbackKeys.length);
  }

  const min = Number(raw.priceRange?.min);
  const max = Number(raw.priceRange?.max);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    answers.priceRange = {
      min: Number.isFinite(min) && min > 0 ? min : null,
      max: Number.isFinite(max) && max > 0 ? max : null,
    };
  }

  if (typeof raw.currentRacketId === "string" && OBJECT_ID.test(raw.currentRacketId)) {
    answers.currentRacketId = raw.currentRacketId;
  }

  return answers;
}

/**
 * اجرای کاملِ یک درخواستِ تطبیق.
 *
 * کلِ امتیازدهی سمتِ سرور انجام می‌شود تا کاتالوگ و منطقِ تطبیق هرگز به کلاینت
 * فرستاده نشود. کاتالوگ خودش کش‌شده است، پس این مسیر معمولاً هیچ کوئریِ
 * دیتابیسی به‌جز خواندنِ سه محصولِ برنده نمی‌زند.
 *
 * @param {Object} config
 * @param {Object} config.answers خروجی sanitizeAnswers
 * @param {Object|null} config.catalog خروجی کاتالوگِ کش‌شده
 * @param {Function} config.buildTargetProfile
 * @param {Function} config.rankProducts
 * @param {Function} [config.profileSummary] خلاصهٔ پروفایلِ هدف در پاسخ؛ هر ورزش
 *        فیلدهای خودش را برمی‌گرداند (تنیس اندازهٔ صفحه دارد، پدل شکلِ فریم)
 * @returns {Promise<Object>} بدنهٔ پاسخِ JSON
 */
export async function runMatch({
  answers,
  catalog,
  buildTargetProfile,
  rankProducts,
  profileSummary = null,
}) {
  const currentRacket = answers.currentRacketId
    ? catalog.products.find((product) => product._id === answers.currentRacketId)
    : null;

  // راکت فعلی هم پروفایل هدف را می‌سازد، هم از نتایج حذف می‌شود
  const targetProfile = buildTargetProfile(answers, currentRacket?.specs || null);
  const pool = currentRacket
    ? catalog.products.filter((product) => product._id !== currentRacket._id)
    : catalog.products;

  const result = rankProducts({ products: pool, targetProfile, answers });

  // فقط برای همان سه برنده، دادهٔ نمایشیِ کامل خوانده می‌شود — همان projectionِ
  // کارت محصول و «نمایش سریع» در بقیهٔ سایت. فهرستِ کش‌شده سبک می‌ماند و مودالِ
  // نمایش سریع دیگر نسخهٔ خلاصه‌شده نمی‌بیند.
  const ranked = [result.best, ...result.alternatives].filter(Boolean);
  const display = await loadDisplayProducts(ranked.map((item) => item._id));
  const withDisplay = (item) => mergeRankedWithDisplay(item, display, catalog.variantAttributes);

  return {
    best: withDisplay(result.best),
    alternatives: result.alternatives.map(withDisplay),
    confidence: result.confidence,
    relaxations: result.relaxations,
    totalCandidates: result.totalCandidates,
    rate: catalog.rate,
    currentRacket: currentRacket
      ? { _id: currentRacket._id, name: currentRacket.name, mainImage: currentRacket.mainImage }
      : null,
    profile: {
      level: targetProfile.level,
      isJunior: targetProfile.isJunior,
      ...(profileSummary ? profileSummary(targetProfile) : {}),
    },
  };
}
