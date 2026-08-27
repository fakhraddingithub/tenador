import { NextResponse } from "next/server";
import { getRacketCatalog, loadDisplayProducts } from "base/services/racketMatch.service";
import { buildTargetProfile, rankProducts } from "@/lib/racketMatch/engine";
import { PRIORITY_KEYS, CURRENT_FEEDBACK_KEYS } from "@/lib/racketMatch/questions";
import { mergeRankedWithDisplay } from "@/lib/racketMatch/resultPayload";

/**
 * POST /api/match/racket
 *
 * پاسخ‌های بازیکن را می‌گیرد و سه راکتِ رتبه‌بندی‌شده را برمی‌گرداند.
 * کلِ امتیازدهی سمتِ سرور انجام می‌شود تا کاتالوگ و منطقِ تطبیق هرگز به کلاینت
 * فرستاده نشود. کاتالوگ خودش کش‌شده است، پس این مسیر معمولاً هیچ کوئریِ
 * دیتابیسی نمی‌زند و فقط چند صد مقایسهٔ عددی انجام می‌دهد.
 */

const ALLOWED = {
  age: ["under10", "10to13", "14to17", "adult"],
  height: ["under120", "120to135", "135to150", "150to165", "over165"],
  level: ["new", "rally", "consistent", "fullswing", "competitive", "expert"],
  strength: ["below", "average", "athletic", "strong", "verystrong"],
  swingSpeed: ["slow", "moderate", "fast", "veryfast"],
  style: ["power", "spin", "control", "all-court"],
  grip: ["L0", "L1", "L2", "L3", "L4", "L5", "unknown"],
};

/** ورودیِ عمومی است — فقط مقادیرِ شناخته‌شده پذیرفته می‌شوند */
function sanitizeAnswers(raw = {}) {
  const answers = {};

  for (const [key, values] of Object.entries(ALLOWED)) {
    if (values.includes(raw[key])) answers[key] = raw[key];
  }

  if (Array.isArray(raw.priorities)) {
    answers.priorities = raw.priorities.filter((k) => PRIORITY_KEYS.includes(k)).slice(0, 3);
  }
  if (Array.isArray(raw.currentFeedback)) {
    answers.currentFeedback = raw.currentFeedback
      .filter((k) => CURRENT_FEEDBACK_KEYS.includes(k))
      .slice(0, CURRENT_FEEDBACK_KEYS.length);
  }

  const min = Number(raw.priceRange?.min);
  const max = Number(raw.priceRange?.max);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    answers.priceRange = {
      min: Number.isFinite(min) && min > 0 ? min : null,
      max: Number.isFinite(max) && max > 0 ? max : null,
    };
  }

  if (typeof raw.currentRacketId === "string" && /^[a-f\d]{24}$/i.test(raw.currentRacketId)) {
    answers.currentRacketId = raw.currentRacketId;
  }

  return answers;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const answers = sanitizeAnswers(body.answers || body);

    const catalog = await getRacketCatalog();
    if (!catalog) {
      return NextResponse.json({ error: "دستهٔ راکت تنیس پیدا نشد" }, { status: 404 });
    }

    const currentRacket = answers.currentRacketId
      ? catalog.products.find((product) => product._id === answers.currentRacketId)
      : null;

    // §2 صورت مسئله: راکت فعلی هم پروفایل هدف را می‌سازد، هم از نتایج حذف می‌شود
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
    const withDisplay = (item) =>
      mergeRankedWithDisplay(item, display, catalog.variantAttributes);

    return NextResponse.json({
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
        weightRange: targetProfile.weightRange,
        headSizeRange: targetProfile.headSizeRange,
      },
    });
  } catch (error) {
    console.error("Racket match API error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
