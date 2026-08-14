import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getProductListingPage } from "base/services/productListing.service";

export const dynamic = "force-dynamic";

const getCachedStorefrontProductPage = unstable_cache(
  async (filterJson, offset, limit) =>
    getProductListingPage({
      filter: JSON.parse(filterJson),
      offset,
      limit,
    }),
  ["storefront-product-pages-v2"],
  {
    revalidate: 10800,
    tags: ["products", "categories", "exchange-rate"],
  },
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = {};
    for (const key of ["sport", "category", "brand", "athlete", "serie", "limitedEdition", "targetAudience"]) {
      const value = searchParams.get(key);
      if (value) filter[key] = value;
    }

    const data = await getCachedStorefrontProductPage(
      JSON.stringify(filter),
      searchParams.get("offset"),
      searchParams.get("limit"),
    );

    const response = NextResponse.json(data);
    // Do not put this dynamic response behind a separate long-lived CDN cache:
    // revalidateTag/revalidatePath cannot purge arbitrary manual CDN entries.
    // The expensive DB result above is still cached in Next's tagged Data Cache.
    response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    return response;
  } catch (error) {
    console.error("Storefront product listing error:", error);
    return NextResponse.json(
      { error: "خطا در دریافت محصولات", products: [] },
      { status: error instanceof TypeError ? 400 : 500 },
    );
  }
}
