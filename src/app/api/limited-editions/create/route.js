import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import LimitedEdition from "base/models/LimitedEdition";
import { registerSlug } from "base/actions/registerSlug";
import { revalidateContent } from "@/lib/revalidate";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();

    const {
      brand,
      name,
      title,
      description,
      colors,
      logo,
      headImage,
      image,
    } = body;

    if (!brand) {
      return NextResponse.json(
        { error: "برند الزامی است" },
        { status: 422 }
      );
    }

    if (!name || !title) {
      return NextResponse.json(
        { error: "فیلدهای نام و عنوان الزامی هستند" },
        { status: 422 }
      );
    }

    // نام تکراری ممنوع — هر لیمیتد ادیشن فقط یک بار ساخته می‌شود
    const duplicate = await LimitedEdition.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "لیمیتد ادیشن با این نام قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    const newLimitedEdition = await LimitedEdition.create({
      brand,
      name,
      title,
      description,
      colors,
      logo,
      headImage,
      image,
    });

    // ثبت اسلاگ لیمیتد ادیشن در رجیستری اسلاگ‌ها (مشابه سری‌ها)
    await registerSlug({
      slug: newLimitedEdition.slug,
      type: "limited-edition",
      model: "LimitedEdition",
      refId: newLimitedEdition._id,
      filterField: "limitedEdition",
      filterValue: newLimitedEdition._id,
      label: newLimitedEdition.name || newLimitedEdition.title,
    });

    revalidateContent(["limited-editions", "products"]);

    return NextResponse.json(
      {
        message: "لیمیتد ادیشن جدید با موفقیت ایجاد شد",
        data: newLimitedEdition,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error in LimitedEdition Creation:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json({ error: messages[0] }, { status: 400 });
    }

    return NextResponse.json(
      { error: "خطای داخلی سرور در هنگام ایجاد لیمیتد ادیشن" },
      { status: 500 }
    );
  }
}
