/**
 * /api/instagram/subscription  (موقت — ابزارِ تشخیص)
 *
 * وضعیتِ اشتراکِ وبهوک روی حسابِ اینستاگرام را از مرورگر نشان می‌دهد و در صورت
 * نیاز دوباره سابسکرایب می‌کند. پس از تبدیلِ نوعِ حساب (Personal→Business) بایندینگِ
 * اشتراک می‌تواند بیفتد؛ این endpoint اجازه می‌دهد بدونِ پنلِ متا آن را ببینید/ترمیم کنید.
 *
 * استفاده:
 *   GET /api/instagram/subscription            → فقط نمایشِ وضعیت
 *   GET /api/instagram/subscription?subscribe=1 → دوباره سابسکرایب روی فیلدِ messages
 *
 * پس از حلِ مشکل این مسیر را حذف کنید.
 */

import { NextResponse } from "next/server";
import {
  getSubscribedApps,
  subscribeMessagesField,
} from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const doSubscribe = searchParams.get("subscribe") === "1";

    // اگر خواسته شد، اول دوباره سابسکرایب کن
    let subscribeResult = null;
    if (doSubscribe) {
      subscribeResult = await subscribeMessagesField();
    }

    // وضعیتِ فعلی را بخوان
    const current = await getSubscribedApps();

    // آیا فیلدِ messages در اشتراک هست؟
    const apps = Array.isArray(current?.data) ? current.data : [];
    const messagesSubscribed = apps.some((a) =>
      Array.isArray(a?.subscribed_fields)
        ? a.subscribed_fields.includes("messages")
        : false
    );

    return NextResponse.json(
      {
        ok: !current?.error,
        messagesSubscribed,
        explanation: current?.error
          ? "⚠️ خواندنِ اشتراک ناموفق بود — به error نگاه کنید (احتمالاً توکن/مجوز)."
          : messagesSubscribed
          ? "✅ فیلدِ messages سابسکرایب است. اگر هنوز پیام نمی‌رسد، گیتِ Development mode / نقشِ تستر باقی‌ست."
          : "⚠️ فیلدِ messages سابسکرایب نیست — با ?subscribe=1 دوباره سابسکرایب کنید.",
        didSubscribeNow: doSubscribe,
        subscribeResult,
        currentSubscription: current,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[instagram/subscription]", error);
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
