import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";
import { registerSlug } from "base/actions/registerSlug";
import { revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const {
      name,
      title,
      description = "",
      icon = "",
      image = "",
    } = body;

    // basic validation
    if (!name || !name.trim()) {
      return apiError("«نام انگلیسی ورزش» الزامی است", 400, {
        fieldErrors: { name: "«نام انگلیسی ورزش» الزامی است" },
      });
    }

    if (!title || !title.trim()) {
      return apiError("«عنوان فارسی ورزش» الزامی است", 400, {
        fieldErrors: { title: "«عنوان فارسی ورزش» الزامی است" },
      });
    }

    const normalizedName = name.trim();

    // duplicate check (name)
    const exists = await Sport.findOne({ name: normalizedName });
    if (exists) {
      return apiError("ورزشی با این نام قبلاً ثبت شده است", 409, {
        fieldErrors: { name: "ورزشی با این نام قبلاً ثبت شده است" },
      });
    }
    const count = await Sport.countDocuments();
    // create sport (slug handled by model)
    const created = await Sport.create({
      name: normalizedName,
      title: title.trim(),
      description: description.trim(),
      icon: icon.trim(),
      image: image.trim(),
      order: count,
    });

    // register slug
    await registerSlug({
      slug: created.slug,
      type: "sport",
      model: "Sport",
      refId: created._id,
      filterField: "sport",
      filterValue: created._id,
      label: created.name || created.title,
      parentSlug: null,
    });

    revalidateContent(["navbar", "sports"]);

    return Response.json(
      {
        message: "Sport created successfully",
        sport: created,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, "خطا در ایجاد ورزش");
  }
}
