import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { ExchangeRate } from "base/models/ExchangeRate";

// GET /api/exchange-rate — عمومی برای client components
export async function GET() {
  try {
    await connectToDB();
    const doc = await ExchangeRate.findOne({ currency: "EUR" })
      .select("rateToToman currency updatedAt")
      .lean();

    if (!doc) {
      return NextResponse.json({ error: "نرخ تبدیل تنظیم نشده" }, { status: 404 });
    }

    return NextResponse.json({
      currency:    doc.currency,
      rateToToman: doc.rateToToman,
      updatedAt:   doc.updatedAt,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}