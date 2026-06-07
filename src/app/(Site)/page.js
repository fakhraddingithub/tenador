import Hero from "@/components/features/hero/Hero";
import BannerSection from "@/components/banners/BannerSection";
import SportsGrid from "@/components/features/sportsGrid/SportsGrid";
import BestSellers from "@/components/features/bestSellers/BestSellers";
import BrandsTicker from "@/components/features/brandsTicker/BrandsTicker";
import AmazingOffers from "@/components/features/amazingOffers/AmazingOffers";
import RolandGarros from "@/components/features/rolandGarros/RolandGarros";
import ComparisonBanner from "@/components/features/comparisonBanner/ComparisonBanner";
import ShowcaseAthletes from "@/components/features/ShowcaseAthletes/ShowcaseAthletes";

// سرویس‌ها را وارد کنید (فرض بر این است که این سرویس‌ها را دارید یا باید بسازید)
import { getHomeProducts } from "base/services/product.service";
import connectToDB from "base/configs/db";
import SlideModel from "base/models/Slide";
import SportModel from "base/models/Sport";
import { getCachedRate } from "@/lib/Exchangerate";
import { getShowcaseAthletes } from "@/lib/athleteService";

// ISR: صفحه اصلی هر ۶۰ ثانیه در پس‌زمینه بازتولید می‌شود
export const revalidate = 60;

export default async function Home() {
  // ۱. اتصال به دیتابیس
  await connectToDB();

  // ۲. دریافت موازی همه داده‌ها برای افزایش سرعت (Parallel Fetching)
  //    فقط ۱۰ محصول برای هر اسلایدر — نه کل کاتالوگ
  const [homeProducts, slides, sports, athletes, rate] = await Promise.all([
    getHomeProducts(),
    SlideModel.find({ isActive: true }).sort({ priority: 1 }).lean(),
    SportModel.find({}).sort({ order: 1 }).lean(),
    getShowcaseAthletes(),
    getCachedRate(),
  ]);
  const { bestSellers, offers } = homeProducts;

  return (
    <>
      <Hero slides={JSON.parse(JSON.stringify(slides))} />
      <BannerSection />
      <SportsGrid categories={JSON.parse(JSON.stringify(sports))} />
      <ComparisonBanner />
      <BestSellers products={bestSellers} rate={rate} />
      <AmazingOffers products={offers} rate={rate} />
      <RolandGarros />
      <BrandsTicker />
      <ShowcaseAthletes data={athletes} />
      {/* <Articles /> */}
    </>
  );
}
