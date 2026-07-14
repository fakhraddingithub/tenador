import ProductListClient from "@/components/templates/products/ProductListClient";
import SportHero from "@/components/templates/sports/SportHero";
import ActiveFiltersLine from "@/components/templates/products/ActiveFiltersLine";
import { getProducts, getFilterableAttributes } from "base/services/product.service";
import { getFirstSport } from "@/lib/sportService";
import { getCachedRate } from "@/lib/Exchangerate";

// داده‌ها با تگِ "products" کش و بعد از تغییرِ ادمین (revalidateContent) باطل می‌شوند؛
// TTL زمان‌محور از ۶۰ث به ۱ساعت افزایش یافت تا ISR Writes کاهش یابد.
export const revalidate = 3600;

export default async function ProductsPage() {

  const [listing, rate, filterableAttributes, firstSport] = await Promise.all([
    getProducts(),
    getCachedRate(),
    getFilterableAttributes(),
    getFirstSport(),
  ]);

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
          products={listing.products}
          totalResults={listing.totalResults}
          rate={rate}
          filterableAttributes={filterableAttributes}
        />
      </div>
    </>
  );
}
