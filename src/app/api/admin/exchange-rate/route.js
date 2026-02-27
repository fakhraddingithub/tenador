import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import connectToDB from "base/configs/db";
import { ExchangeRate, RateHistory } from "base/models/ExchangeRate";
import User from "base/models/User";

// GET /api/admin/exchange-rate
export async function GET() {
  try {
    await connectToDB();

    const [current, history] = await Promise.all([
      ExchangeRate.findOne({ currency: "EUR" })
        .populate("updatedBy", "userName")
        .lean(),
      RateHistory.find({ currency: "EUR" })
        .populate("updatedBy", "userName")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    return NextResponse.json({ current, history });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// POST /api/admin/exchange-rate
export async function POST(req) {
  try {
    await connectToDB();
    const { rateToToman, note } = await req.json();

    if (!rateToToman || Number(rateToToman) < 1) {
      return NextResponse.json({ error: "نرخ معتبر وارد کنید" }, { status: 400 });
    }

    const rate = Math.round(Number(rateToToman));

    // upsert — همیشه یک سند فعال
    const updated = await ExchangeRate.findOneAndUpdate(
      { currency: "EUR" },
      { rateToToman: rate, note: note || "" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // ذخیره در تاریخچه
    await RateHistory.create({
      currency:    "EUR",
      rateToToman: rate,
      note:        note || "",
    });

    // invalidate cache
    revalidateTag("exchange-rate");

    return NextResponse.json({ rate: updated }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}