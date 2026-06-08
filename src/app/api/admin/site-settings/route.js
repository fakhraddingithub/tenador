import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import connectToDB from "base/configs/db";
import SiteSetting from "base/models/SiteSetting";

// مسیرهایی که با تغییر یک کلید تنظیم باید دوباره ساخته شوند
const REVALIDATE_PATHS = {
  secondhand_header_image: ["/second-hand"],
};

// GET /api/admin/site-settings?key=secondhand_header_image  →  { value }
export async function GET(req) {
  try {
    await connectToDB();
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "کلید الزامی است" }, { status: 400 });
    }
    const setting = await SiteSetting.findOne({ key }).lean();
    return NextResponse.json({ value: setting?.value ?? null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PUT /api/admin/site-settings  { key, value }  →  upsert + revalidate
export async function PUT(req) {
  try {
    await connectToDB();
    const { key, value } = await req.json();
    if (!key) {
      return NextResponse.json({ error: "کلید الزامی است" }, { status: 400 });
    }

    const setting = await SiteSetting.findOneAndUpdate(
      { key },
      { value: value ?? null },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    for (const path of REVALIDATE_PATHS[key] || []) {
      try {
        revalidatePath(path);
      } catch {
        // در محیط‌هایی که revalidatePath در دسترس نیست بی‌صدا رد شو
      }
    }

    return NextResponse.json({ value: setting.value });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
