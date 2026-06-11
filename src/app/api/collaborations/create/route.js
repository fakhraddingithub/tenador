import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import Collaboration from "base/models/Collaboration";
import { registerSlug } from "base/actions/registerSlug";
import { revalidateContent } from "@/lib/revalidate";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();

    const {
      name,
      title,
      description,
      colors,
      logo,
      headImage,
      image,
    } = body;

    if (!name || !title) {
      return NextResponse.json(
        { error: "فیلدهای نام و عنوان الزامی هستند" },
        { status: 422 }
      );
    }

    // نام تکراری ممنوع — هر همکاری فقط یک بار ساخته می‌شود
    const duplicate = await Collaboration.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "همکاری با این نام قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    const newCollaboration = await Collaboration.create({
      name,
      title,
      description,
      colors,
      logo,
      headImage,
      image,
    });

    // ثبت اسلاگ همکاری در رجیستری اسلاگ‌ها (مشابه سری‌ها)
    await registerSlug({
      slug: newCollaboration.slug,
      type: "collaboration",
      model: "Collaboration",
      refId: newCollaboration._id,
      filterField: "collaboration",
      filterValue: newCollaboration._id,
      label: newCollaboration.name || newCollaboration.title,
    });

    revalidateContent(["collaborations", "products"]);

    return NextResponse.json(
      {
        message: "همکاری جدید با موفقیت ایجاد شد",
        data: newCollaboration,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error in Collaboration Creation:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json({ error: messages[0] }, { status: 400 });
    }

    return NextResponse.json(
      { error: "خطای داخلی سرور در هنگام ایجاد همکاری" },
      { status: 500 }
    );
  }
}
