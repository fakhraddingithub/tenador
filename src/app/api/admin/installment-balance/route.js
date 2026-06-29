import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import requireAdmin from "@/lib/requireAdmin";
import Installment from "base/models/Installment";
import SiteSetting from "base/models/SiteSetting";
import {
  INSTALLMENT_RATE_KEY,
  DEFAULT_MONTHLY_RATE,
  computeRemainingDue,
} from "@/lib/installmentFinance";

/**
 * GET /api/admin/installment-balance?id=<installmentId>
 *
 * منطق بک‌اند Part 1.4: برای هر سفارش اقساطی، مانده‌ی قابل پرداخت را بر اساس
 * نرخ سود ماهانه‌ی ذخیره‌شده در تنظیمات سایت محاسبه می‌کند.
 */
export async function GET(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "شناسه‌ی قسط الزامی است" }, { status: 400 });
    }

    await connectToDB();

    const [installment, rateSetting] = await Promise.all([
      Installment.findById(id)
        .select("totalAmount numberOfChecks checks")
        .lean(),
      SiteSetting.findOne({ key: INSTALLMENT_RATE_KEY }).lean(),
    ]);

    if (!installment) {
      return NextResponse.json({ error: "طرح اقساطی یافت نشد" }, { status: 404 });
    }

    const monthlyRatePct =
      Number(rateSetting?.value) > 0 ? Number(rateSetting.value) : DEFAULT_MONTHLY_RATE;

    const result = computeRemainingDue(installment, monthlyRatePct);

    return NextResponse.json({ monthlyRatePct, ...result });
  } catch (err) {
    console.error("installment-balance error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
