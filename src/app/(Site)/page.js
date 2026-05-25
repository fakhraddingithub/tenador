import Hero from "@/components/features/hero/Hero";
import BannerSection from "@/components/banners/BannerSection";
import SportsGrid from "@/components/features/sportsGrid/SportsGrid";
import BestSellers from "@/components/features/bestSellers/BestSellers";
import BrandsTicker from "@/components/features/brandsTicker/BrandsTicker";
import AmazingOffers from "@/components/features/amazingOffers/AmazingOffers";
import RolandGarros from "@/components/features/rolandGarros/RolandGarros";
import ComparisonBanner from "@/components/features/comparisonBanner/ComparisonBanner";
import ShowcaseAthletes from "@/components/features/comparisonBanner/ComparisonBanner";

// سرویس‌ها را وارد کنید (فرض بر این است که این سرویس‌ها را دارید یا باید بسازید)
import { getProducts } from "base/services/product.service";
import connectToDB from "base/configs/db";
import SlideModel from "base/models/Slide";
import SportModel from "base/models/Sport";
import { getCachedRate } from "@/lib/Exchangerate";

export default async function Home() {
  // ۱. اتصال به دیتابیس
  await connectToDB();

  // ۲. دریافت موازی داده‌ها برای افزایش سرعت (Parallel Fetching)
  const [products, slides, sports] = await Promise.all([
    getProducts(),
    SlideModel.find({ isActive: true }).sort({ priority: 1 }).lean(),
    SportModel.find({})
    .sort({ order: 1 })
    .lean(),
  ]);

  const rate = await getCachedRate();

  return (
    <>
      <Hero slides={JSON.parse(JSON.stringify(slides))} />
      <BannerSection />
      <SportsGrid categories={JSON.parse(JSON.stringify(sports))} />
      <ComparisonBanner />
      <BestSellers products={products} rate={rate} />
      <AmazingOffers products={products} rate={rate} />
      <RolandGarros />
      <BrandsTicker />
      <ShowcaseAthletes />
      {/* <Articles /> */}
    </>
  );
}
