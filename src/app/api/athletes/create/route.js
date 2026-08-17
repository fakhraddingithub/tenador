import connectToDB from "base/configs/db";
import Athlete from "base/models/Athlete";
import Sport from "base/models/Sport";
import { registerSlug } from "base/actions/registerSlug";
import { apiError, handleApiError } from "@/lib/apiError";
import { revalidateContent } from "@/lib/revalidate";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function POST(req) {
  const { denied } = await requireAdminPermission("athletes.create");
  if (denied) return denied;

  try {
    await connectToDB();

    const body = await req.json();

    const {
      name,
      title,
      sport,
      birthDate,
      gender,
      nationality,
      bio,
      photo,
      height,    
      weight,    
      honors,    
      sponsors,  
    } = body;

    /* ---------- validations ---------- */

    if (!name?.trim() || !title?.trim()) {
      return apiError("«نام» و «عنوان» ورزشکار الزامی هستند", 400);
    }

    // regex validation
    const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!nameRegex.test(name)) {
      return apiError(
        "نام انگلیسی باید فقط شامل حروف انگلیسی، اعداد و علائم مجاز (- _) باشد",
        400,
        { fieldErrors: { name: "فرمت نام انگلیسی نامعتبر است" } }
      );
    }

    if (!sport) {
      return apiError("«ورزش» ورزشکار الزامی است", 400, {
        fieldErrors: { sport: "«ورزش» ورزشکار الزامی است" },
      });
    }

    // چک کردن وجود ورزش و ورزشکار تکراری به صورت همزمان برای بهینه‌سازی (Optional)
    const sportFound = await Sport.findById(sport);
    if (!sportFound) {
      return apiError("ورزش انتخاب‌شده یافت نشد", 404, {
        fieldErrors: { sport: "ورزش انتخاب‌شده یافت نشد" },
      });
    }

    const exists = await Athlete.findOne({ name: name.trim(), sport });
    if (exists) {
      return apiError("ورزشکاری با این نام در این ورزش قبلاً ثبت شده است", 409, {
        fieldErrors: { name: "ورزشکاری با این نام در این ورزش قبلاً ثبت شده است" },
      });
    }

    /* ---------- create ---------- */

    const created = await Athlete.create({
      name: name.trim(),
      title: title.trim(),
      sport,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender,
      nationality: nationality?.trim() || "",
      bio: bio || "",
      photo: photo || "",
      // فیلدهای جدید
      height: height || null,
      weight: weight || null,
      honors: Array.isArray(honors) ? honors : [], 
      sponsors: Array.isArray(sponsors) ? sponsors : [],
    });

    /* ---------- slug registry ---------- */

    // ثبت در جدول Slug ها
    await registerSlug({
      slug: created.slug,
      type: "athlete",
      model: "Athlete",
      refId: created._id,
      filterField: "athlete",
      filterValue: created._id,
      label: created.name,
      parentSlug: null,
    });

    revalidateContent(["athletes"]);

    return Response.json(
      {
        message: "Athlete created successfully",
        athlete: created,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, "خطا در ایجاد ورزشکار");
  }
}