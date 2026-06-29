import { NextResponse } from "next/server";
import { getMonthlyInstallmentRate } from "@/lib/installmentRateService";

/**
 * GET /api/installment-rate  →  { rate }
 *
 * نقطه‌ی پایانیِ عمومی و فقط‌خواندنی برای واکشی نرخ سود ماهانه‌ی سراسری اقساط
 * در صفحه‌ی پرداختِ فروشگاه. هیچ داده‌ی حساسی افشا نمی‌کند (فقط درصد سود).
 */
export async function GET() {
  const rate = await getMonthlyInstallmentRate();
  return NextResponse.json({ rate });
}
