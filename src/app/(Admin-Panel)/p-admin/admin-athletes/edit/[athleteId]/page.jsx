import connectToDB from "base/configs/db";
import Athlete from "base/models/Athlete";
import Sport from "base/models/Sport";
import AthleteCreateForm from "@/components/admin/AthleteCreateForm";
import { notFound } from "next/navigation";

export default async function EditAthletePage({ params }) {
  const { athleteId } = await params;

  await connectToDB();

  // واکشی اطلاعات ورزشکار و لیست ورزش‌ها به صورت موازی
  const [athlete, sports] = await Promise.all([
    Athlete.findById(athleteId).lean(),
    Sport.find({}, "_id name").lean()
  ]);

  if (!athlete) {
    return notFound(); // اگر ورزشکاری با این ID نبود، صفحه 404 نمایش داده شود
  }

  // تبدیل Object های مونگو به استرینگ برای جلوگیری از خطای Serialization در Next.js
  const serializedAthlete = JSON.parse(JSON.stringify(athlete));
  const serializedSports = JSON.parse(JSON.stringify(sports));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">ویرایش اطلاعات ورزشکار</h1>
        <p className="text-gray-500 text-sm mt-1">
          در حال ویرایش پروفایل: <span className="text-[var(--color-primary)] font-medium">{athlete.title}</span>
        </p>
      </div>

      {/* استفاده از همان فرم با داده‌های اولیه */}
      <AthleteCreateForm 
        initialData={serializedAthlete}
        sports = {serializedSports} 
        isEdit={true} 
      />
    </div>
  );
}