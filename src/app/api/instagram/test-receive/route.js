/**
 * /api/instagram/test-receive  (موقت — ابزارِ تشخیص)
 *
 * یک پیلودِ دقیقاً هم‌شکلِ آنچه متا برای یک «پیامِ ورودیِ اینستاگرام» می‌فرستد
 * می‌سازد و آن را از همان مسیرِ پردازشِ وبهوکِ واقعی (processWebhookPayload)
 * عبور می‌دهد، در دیتابیس ذخیره می‌کند، و نتیجه را برمی‌گرداند.
 *
 * هدف: تفکیکِ اینکه مشکل از «عدمِ تحویلِ متا»ست یا از «شکستِ خاموشِ هندلر».
 *   - اگر اینجا stored=1 شد → کد و دیتابیس سالم‌اند؛ مشکل صرفاً تحویلِ متاست.
 *   - اگر اینجا هم ذخیره نشد → باگ در پردازش/دیتابیس است (پیام خطا را می‌بینید).
 *
 * همچنین هویتِ حسابِ متصل (پشتِ توکن) را از Graph می‌خواند و با
 * INSTAGRAM_BUSINESS_ACCOUNT_ID مقایسه می‌کند (تأییدِ پس از تبدیل به Business).
 *
 * استفاده:
 *   GET /api/instagram/test-receive
 *   GET /api/instagram/test-receive?igsid=1234567890&text=سلام
 *
 * پس از حلِ مشکل این مسیر را حذف کنید.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { processWebhookPayload } from "base/services/instagramService";
import { fetchOwnAccount } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    // IGSID تستی (با اعداد، شبیهِ IGSID واقعی)؛ قابلِ override برای تکرار
    const igsid = searchParams.get("igsid") || "9999999999999999";
    const text = searchParams.get("text") || "پیامِ تستی از test-receive";
    // mid یکتا تا dedupe مانعِ ذخیره‌ی تکراری در آزمون‌های متوالی نشود
    const mid = `test-mid-${Date.now()}`;

    const recipientId =
      process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "RECIPIENT_IG_ID";

    // ── پیلودِ دقیقاً هم‌شکلِ وبهوکِ پیامِ ورودیِ Instagram-Login messaging ──
    const simulatedPayload = {
      object: "instagram",
      entry: [
        {
          id: recipientId,
          time: Date.now(),
          messaging: [
            {
              sender: { id: igsid },
              recipient: { id: recipientId },
              timestamp: Date.now(),
              message: {
                mid,
                text,
              },
            },
          ],
        },
      ],
    };

    // از همان منطقِ وبهوکِ واقعی عبور بده (و در دیتابیس ذخیره کن)
    const result = await processWebhookPayload(simulatedPayload);

    // ── Step 3: هویتِ حسابِ متصل و مقایسه با env ──
    const account = await fetchOwnAccount();
    const envBusinessId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "";
    const accountIdentity = {
      ...account,
      env_INSTAGRAM_BUSINESS_ACCOUNT_ID: envBusinessId,
      matches:
        !!account?.user_id &&
        !!envBusinessId &&
        account.user_id === envBusinessId,
      isBusiness:
        (account?.account_type || "").toUpperCase() === "BUSINESS",
    };

    return NextResponse.json(
      {
        ok: true,
        explanation:
          result.stored > 0
            ? "✅ پردازشگر سالم است: پیامِ شبیه‌سازی‌شده ذخیره شد. اگر پیامِ واقعی نمی‌رسد، مشکل صرفاً «تحویلِ متا»ست (حالت/مجوز/نوعِ حساب)."
            : "⚠️ حتی پیامِ شبیه‌سازی‌شده هم ذخیره نشد — باگ در پردازش/دیتابیس است (به events نگاه کنید).",
        simulatedPayloadSent: simulatedPayload,
        processingResult: result, // { object, entryCount, processed, skipped, stored, events:[...] }
        accountIdentity,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[instagram/test-receive]", error);
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
