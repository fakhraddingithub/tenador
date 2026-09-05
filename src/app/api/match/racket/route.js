import { NextResponse } from "next/server";
import { getRacketCatalog } from "base/services/racketMatch.service";
import { buildTargetProfile, rankProducts } from "@/lib/racketMatch/engine";
import { PRIORITY_KEYS, CURRENT_FEEDBACK_KEYS } from "@/lib/racketMatch/questions";
import { runMatch, sanitizeAnswers } from "@/lib/racketMatch/matchApi";

/**
 * POST /api/match/racket
 *
 * پاسخ‌های بازیکنِ تنیس را می‌گیرد و سه راکتِ رتبه‌بندی‌شده را برمی‌گرداند.
 *
 * بدنهٔ کار — پاک‌سازی ورودی، پروفایل هدف، رتبه‌بندی، و خواندنِ دادهٔ نمایشیِ
 * کاملِ سه برنده — در matchApi.js است و با مسیرِ پدل مشترک؛ این‌جا فقط واژگان و
 * موتورِ تنیس تزریق می‌شود.
 */

/** ورودیِ عمومی است — فقط مقادیرِ شناخته‌شده پذیرفته می‌شوند */
const ALLOWED = {
  age: ["under10", "10to13", "14to17", "adult"],
  height: ["under120", "120to135", "135to150", "150to165", "over165"],
  level: ["new", "rally", "consistent", "fullswing", "competitive", "expert"],
  strength: ["below", "average", "athletic", "strong", "verystrong"],
  swingSpeed: ["slow", "moderate", "fast", "veryfast"],
  style: ["power", "spin", "control", "all-court"],
};

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const answers = sanitizeAnswers(body.answers || body, {
      allowed: ALLOWED,
      priorityKeys: PRIORITY_KEYS,
      feedbackKeys: CURRENT_FEEDBACK_KEYS,
    });

    const catalog = await getRacketCatalog();
    if (!catalog) {
      return NextResponse.json({ error: "دستهٔ راکت تنیس پیدا نشد" }, { status: 404 });
    }

    const payload = await runMatch({
      answers,
      catalog,
      buildTargetProfile,
      rankProducts,
      profileSummary: (target) => ({
        weightRange: target.weightRange,
        headSizeRange: target.headSizeRange,
      }),
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Racket match API error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
