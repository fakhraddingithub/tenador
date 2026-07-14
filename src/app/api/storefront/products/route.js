import { NextResponse } from "next/server";
import { getProductListingPage } from "base/services/productListing.service";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = {};
    for (const key of ["sport", "category", "brand", "athlete", "serie", "limitedEdition"]) {
      const value = searchParams.get(key);
      if (value) filter[key] = value;
    }

    const data = await getProductListingPage({
      filter,
      offset: searchParams.get("offset"),
      limit: searchParams.get("limit"),
    });

    const response = NextResponse.json(data);
    response.headers.set(
      "Vercel-CDN-Cache-Control",
      "public, s-maxage=10800, stale-while-revalidate=86400",
    );
    response.headers.set("Cache-Control", "public, max-age=60");
    return response;
  } catch (error) {
    console.error("Storefront product listing error:", error);
    return NextResponse.json(
      { error: "خطا در دریافت محصولات", products: [] },
      { status: error instanceof TypeError ? 400 : 500 },
    );
  }
}
