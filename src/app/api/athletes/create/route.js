import connectToDB from "base/configs/db";
import Athlete from "base/models/Athlete";
import Sport from "base/models/Sport";
import { registerSlug } from "base/actions/registerSlug";

export async function POST(req) {
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
      return Response.json(
        { error: "Name and Title are required" },
        { status: 400 }
      );
    }

    // regex validation
    const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!nameRegex.test(name)) {
      return Response.json(
        { error: "Name must contain only English letters, numbers, spaces, - or _" },
        { status: 400 }
      );
    }

    if (!sport) {
      return Response.json({ error: "Sport ID is required" }, { status: 400 });
    }

    // چک کردن وجود ورزش و ورزشکار تکراری به صورت همزمان برای بهینه‌سازی (Optional)
    const sportFound = await Sport.findById(sport);
    if (!sportFound) {
      return Response.json({ error: "Sport not found" }, { status: 404 });
    }

    const exists = await Athlete.findOne({ name: name.trim(), sport });
    if (exists) {
      return Response.json(
        { error: "Athlete already exists for this sport" },
        { status: 409 }
      );
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

    return Response.json(
      {
        message: "Athlete created successfully",
        athlete: created,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Athlete Creation Error:", err); // لاگ کردن خطا برای دیباگ راحت‌تر
    return Response.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}