import Hero from '@/components/features/hero/Hero';
import SportsGrid from '@/components/features/sportsGrid/SportsGrid';
import BestSellers from '@/components/features/bestSellers/BestSellers';
import BrandsTicker from '@/components/features/brandsTicker/BrandsTicker';
import AmazingOffers from '@/components/features/amazingOffers/AmazingOffers';
import RolandGarros from '@/components/features/rolandGarros/RolandGarros';
import Articles from '@/components/features/articles/Articles';
import { getProducts } from "base/services/product.service";
import { HERO_SLIDES } from "@/lib/mockData";
import { SPORTS_CATEGORIES } from '@/lib/constants';
import ComparisonBanner from '@/components/features/comparisonBanner/ComparisonBanner';
export default async function Home() {
  const products = await getProducts();
  return (
    <>
      <Hero slides={HERO_SLIDES} />
      <SportsGrid categories={SPORTS_CATEGORIES}/>
      <ComparisonBanner/>
      <BestSellers products={products}/>
      <BrandsTicker />
      <AmazingOffers products={products}/>
      <RolandGarros />
      {/* <Articles /> */}
    </>
  );
}
