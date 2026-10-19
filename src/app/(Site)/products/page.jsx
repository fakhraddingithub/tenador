import { listingPage, listingCanonical } from "@/lib/seo/listingPagination";
import { getProductListingPage } from "base/services/productListing.service";
import { notFound } from "next/navigation";
import ProductListClient from "@/components/templates/products/ProductListClient";
import SportHero from "@/components/templates/sports/SportHero";
import ActiveFiltersLine from "@/components/templates/products/ActiveFiltersLine";
import { getProducts, getFilterableAttributes } from "base/services/product.service";
import { getFirstSport } from "@/lib/sportService";
import { getCachedRate } from "@/lib/Exchangerate";

// داده‌ها با تگِ "products" کش و بعد از تغییرِ ادمین (revalidateContent) باطل می‌شوند؛
// TTL زمان‌محور از ۶۰ث به ۱ساعت افزایش یافت تا ISR Writes کاهش یابد.
export const revalidate = 3600;

const metadata = {
  title: "خرید تجهیزات تنیس و پدل",
  description:
    "مشاهده و خرید تجهیزات تخصصی تنیس و پدل از برندهای معتبر؛ شامل راکت، کفش، پوشاک و لوازم جانبی با ضمانت اصالت.",
  alternates: { canonical: "/products" },
};

export async function generateMetadata({ searchParams }) {
  return { ...metadata, alternates: { canonical: listingCanonical("/products", (await searchParams)?.page) } };
}

export default async function ProductsPage({ searchParams }) {
  const page = listingPage((await searchParams)?.page);

  const [listing, rate, filterableAttributes, firstSport] = await Promise.all([
    page === 1 ? getProducts() : getProductListingPage({ offset: (page - 1) * 20 }),
    getCachedRate(),
    getFilterableAttributes(),
    getFirstSport(),
  ]);

  if (page > 1 && (page - 1) * 20 >= listing.totalResults) notFound();

  return (
    <>
      {/* هدر تمام‌عرض — همان کامپوننت هدرِ صفحه‌ی ورزش، با تصویرِ اولین ورزش.
          خطِ فیلترهای فعال زیرِ خط‌جداکننده‌ی عنوان (اسلاتِ headerExtra) رندر می‌شود. */}
      <SportHero
        image={firstSport?.image}
        title="لیست محصولات"
        headerExtra={<ActiveFiltersLine filterableAttributes={filterableAttributes} />}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-6 text-[#1a1a1a]">
          لیست محصولات
        </h1>

        <ProductListClient
          key={page}
          initialOffset={(page - 1) * 20}
          products={listing.products}
          totalResults={listing.totalResults}
          rate={rate}
          filterableAttributes={filterableAttributes}
        />
      </div>
    </>
  );
}
