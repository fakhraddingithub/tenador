import { NextResponse } from "next/server";
import { getPadelCatalog } from "base/services/racketMatch.service";
import { buildTargetProfile, rankProducts } from "@/lib/racketMatch/padel/engine";
import { PRIORITY_KEYS, CURRENT_FEEDBACK_KEYS } from "@/lib/racketMatch/padel/questions";
import { runMatch, sanitizeAnswers } from "@/lib/racketMatch/matchApi";

/**
 * POST /api/match/padel
 *
 * پاسخ‌های بازیکنِ پدل را می‌گیرد و سه راکتِ رتبه‌بندی‌شده را برمی‌گرداند.
 *
 * ساختار عیناً همان مسیرِ تنیس است: بدنهٔ کار در matchApi.js مشترک است و
 * این‌جا فقط واژگان و موتورِ پدل تزریق می‌شود. آدرسِ جدا (به‌جای یک مسیرِ
 * پویا) عمدی است — آدرسِ تنیس از قبل منتشر شده و نباید عوض شود.
 */

/** ورودیِ عمومی است — فقط مقادیرِ شناخته‌شده پذیرفته می‌شوند */
const ALLOWED = {
  age: ["under14", "14to17", "adult", "over50"],
  level: ["new", "rally", "consistent", "tactical", "competitive", "expert"],
  strength: ["below", "average", "athletic", "strong", "verystrong"],
  swingSpeed: ["slow", "moderate", "fast", "veryfast"],
  style: ["control", "all-round", "aggressive", "power", "unknown"],
};

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const answers = sanitizeAnswers(body.answers || body, {
      allowed: ALLOWED,
      priorityKeys: PRIORITY_KEYS,
      feedbackKeys: CURRENT_FEEDBACK_KEYS,
    });

    const catalog = await getPadelCatalog();
    if (!catalog) {
      return NextResponse.json({ error: "دستهٔ راکت پدل پیدا نشد" }, { status: 404 });
    }

    const payload = await runMatch({
      answers,
      catalog,
      buildTargetProfile,
      rankProducts,
      profileSummary: (target) => ({
        style: target.style,
        shapeTarget: target.shapeTarget,
        massRange: target.massRange,
        balanceRange: target.balanceRange,
      }),
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Padel match API error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
