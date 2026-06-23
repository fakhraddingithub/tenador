import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import PushSubscription from "base/models/PushSubscription";
import { verifyToken } from "base/utils/auth";

// web-push به crypto نیتیو نیاز دارد → حتماً روی Node اجرا شود (نه Edge)
export const runtime = "nodejs";

/**
 * POST /api/push/subscribe
 * ذخیرهٔ یک اشتراکِ Web Push. بدون نیاز به احراز هویت (اشتراک ناشناس).
 * اگر کاربر واردشده باشد، اشتراک به حساب او لینک می‌شود.
 * Body: { subscription: PushSubscriptionJSON }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const subscription = body?.subscription || body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: "اطلاعات اشتراک نامعتبر است" },
        { status: 400 }
      );
    }

    await connectToDB();

    // شناسایی کاربرِ احتمالاً واردشده (اختیاری — خطا نمی‌دهیم اگر نبود)
    let userId = null;
    try {
      const token = (await cookies()).get("accessToken")?.value;
      if (token) {
        const decoded = verifyToken(token);
        if (decoded?.userId) userId = decoded.userId;
      }
    } catch {
      // ناشناس می‌ماند
    }

    const userAgent = req.headers.get("user-agent") || "";

    // upsert بر اساس endpoint یکتا — اگر کاربر دوباره subscribe کرد، کلیدها به‌روز می‌شوند
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
          userId,
          userAgent,
          subscribedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[push/subscribe]", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
