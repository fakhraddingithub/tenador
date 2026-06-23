import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import PushSubscription from "base/models/PushSubscription";

export const runtime = "nodejs";

/**
 * DELETE /api/push/unsubscribe
 * حذف یک اشتراک بر اساس endpoint. بدون نیاز به احراز هویت.
 * Body: { endpoint: string }
 */
export async function DELETE(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const endpoint = body?.endpoint;

    if (!endpoint) {
      return NextResponse.json({ error: "endpoint الزامی است" }, { status: 400 });
    }

    await connectToDB();
    await PushSubscription.deleteOne({ endpoint });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/unsubscribe]", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
