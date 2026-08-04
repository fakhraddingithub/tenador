import { notFound } from "next/navigation";
import {
  FaMars,
  FaVenus,
  FaFlag,
  FaRunning,
  FaRulerVertical,
  FaWeight,
  FaBirthdayCake,
  FaTrophy,
} from "react-icons/fa";
import { getAthleteBySlug } from "@/lib/athleteService";
import { generateAthleteMetadata } from "@/lib/seo/athleteSeo";
import { getProductListingPage } from "base/services/productListing.service";
import { getCachedRate } from "@/lib/Exchangerate";
import SportHero from "@/components/templates/sports/SportHero";
import { PublicProductGrid } from "@/components/features/articles/PublicProductGrid";

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

  return (
    <>
      <SportHero image={athlete.photo} title={athlete.title} alt={athlete.title} />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          {athlete.sport?.name && (
            <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700">
              <FaRunning className="text-[var(--color-primary)]" /> {athlete.sport.name}
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700">
            {athlete.gender === "female" ? <FaVenus /> : <FaMars />}{" "}
            {athlete.gender === "female" ? "بانوان" : "آقایان"}
          </span>

          {athlete.nationality && (
            <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700">
              <FaFlag /> {athlete.nationality}
            </span>
          )}

          {athlete.height != null && (
            <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700">
              <FaRulerVertical /> {athlete.height} سانتی‌متر
            </span>
          )}

          {athlete.weight != null && (
            <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700">
              <FaWeight /> {athlete.weight} کیلوگرم
            </span>
          )}

          {athlete.birthDate && (
            <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700">
              <FaBirthdayCake /> {new Date(athlete.birthDate).toLocaleDateString("fa-IR")}
            </span>
          )}
        </div>

        {athlete.bio && (
          <section className="rounded-[6px] border border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-800">درباره {athlete.title}</h2>
            <p className="whitespace-pre-line text-sm leading-7 text-gray-600 sm:text-base">
              {athlete.bio}
            </p>
          </section>
        )}

        {athlete.honors?.length > 0 && (
          <section className="rounded-[6px] border border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-800">افتخارات</h2>
            <ul className="space-y-3">
              {athlete.honors.map((honor, i) => (
                <li key={i} className="flex items-start gap-3">
                  <FaTrophy className="mt-1 shrink-0 text-[var(--color-secondary)]" />
                  <div>
                    <p className="font-bold text-gray-800">
                      {honor.title}
                      {honor.quantity > 1 && (
                        <span className="mr-1 text-sm font-medium text-gray-500">
                          × {honor.quantity}
                        </span>
                      )}
                    </p>
                    {honor.description && (
                      <p className="text-sm text-gray-500">{honor.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {athlete.sponsors?.length > 0 && (
          <section className="rounded-[6px] border border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-800">اسپانسرها</h2>
            <div className="flex flex-wrap items-center gap-4">
              {athlete.sponsors.map((sponsor) => (
                <div
                  key={sponsor._id}
                  title={sponsor.name}
                  className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-white p-2 shadow-sm"
                >
                  <img src={sponsor.logo} alt={sponsor.name} className="h-full w-full object-contain" />
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-lg font-bold text-gray-800">محصولات {athlete.title}</h2>
          {products.length > 0 ? (
            <PublicProductGrid products={products} rate={rate} />
          ) : (
            <div className="py-10 text-center text-gray-500">
              محصولی برای این ورزشکار ثبت نشده است
            </div>
          )}
        </section>
      </div>
    </>
  );
}
