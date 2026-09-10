import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { fetchMarketRates, getMarketRatesStatus } from "base/services/marketRates";

export const runtime = "nodejs";

// Cache validated data across admins; failed refreshes retain the last good value.
const readMarketRates = unstable_cache(
  () => fetchMarketRates(),
  ["admin-market-rates-tgju-v1"],
  { revalidate: 300 },
);

export async function GET() {
  const { denied } = await requireAdminPermission(null);
  if (denied) return denied;

  try {
    // Check expiry outside the cache as well, including after upstream outages.
    const rates = getMarketRatesStatus(await readMarketRates());
    return NextResponse.json(rates, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Market rates unavailable:", error.message);
    return NextResponse.json(
      { message: "دریافت نرخ بازار ارز موقتاً ممکن نیست" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
