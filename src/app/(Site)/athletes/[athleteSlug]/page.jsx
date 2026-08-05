import { notFound } from "next/navigation";
import { FaRegUser, FaShoppingBag } from "react-icons/fa";
import { getAthleteBySlug } from "@/lib/athleteService";
import {
  generateAthleteMetadata,
  generateAthleteSchema,
  generateAthleteBreadcrumbSchema,
} from "@/lib/seo/athleteSeo";
import { getProductListingPage } from "base/services/productListing.service";
import { getCachedRate } from "@/lib/Exchangerate";
import ProductSlider from "@/components/features/bestSellers/BestSellers";
import AthleteHero from "@/components/templates/athletes/AthleteHero";
import AthleteSection from "@/components/templates/athletes/AthleteSection";
import AthleteInfo from "@/components/templates/athletes/AthleteInfo";
import AthleteAchievements from "@/components/templates/athletes/AthleteAchievements";
import AthleteSponsors from "@/components/templates/athletes/AthleteSponsors";

export async function generateMetadata({ params }) {
  const { athleteSlug } = await params;
  const athlete = await getAthleteBySlug(athleteSlug);

  if (!athlete || athlete.error) {
    return { title: "ورزشکار پیدا نشد" };
  }

  return generateAthleteMetadata(athlete);
}

export default async function AthletePage({ params }) {
  const { athleteSlug } = await params;

  if (!athleteSlug) notFound();

  const athlete = await getAthleteBySlug(athleteSlug);
  if (!athlete || athlete.error) notFound();

  const [{ products }, rate] = await Promise.all([
    getProductListingPage({ filter: { athlete: athlete._id } }),
    getCachedRate(),
  ]);

  const personSchema = generateAthleteSchema(athlete);
  const breadcrumbSchema = generateAthleteBreadcrumbSchema(athlete);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personSchema).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c"),
        }}
      />

      <AthleteHero athlete={athlete} />

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:space-y-16 sm:py-14">
        <AthleteInfo athlete={athlete} />

        {athlete.bio ? (
          <AthleteSection
            title={`درباره ${athlete.title}`}
            eyebrow="Biography"
            icon={FaRegUser}
          >
            <p className="max-w-3xl whitespace-pre-line text-pretty text-sm leading-8 text-gray-600 sm:text-base">
              {athlete.bio}
            </p>
          </AthleteSection>
        ) : null}

        <AthleteAchievements honors={athlete.honors} />

        <AthleteSponsors
          sponsors={athlete.sponsors}
          sportSlug={athlete.sport?.slug}
        />

        {products.length === 0 ? (
          <AthleteSection
            title={`محصولات ${athlete.title}`}
            eyebrow="Products"
            icon={FaShoppingBag}
          >
            <div className="rounded-[6px] border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
              محصولی برای این ورزشکار ثبت نشده است
            </div>
          </AthleteSection>
        ) : null}
      </div>

      {products.length > 0 ? (
        <ProductSlider
          title={`محصولات ${athlete.title}`}
          highlight="محصولات"
          subtitle={`تجهیزات و پوشاکِ مرتبط با ${athlete.title}`}
          products={products}
          rate={rate}
        />
      ) : null}
    </>
  );
}
