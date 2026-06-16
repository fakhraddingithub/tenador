import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import LimitedEdition from "base/models/LimitedEdition";
import Product from "base/models/Product";
import { revalidateContent } from "@/lib/revalidate";

export async function GET(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    const limitedEdition = await LimitedEdition.findById(id).lean();

    if (!limitedEdition) {
      return NextResponse.json(
        { error: "لیمیتد ادیشن مورد نظر یافت نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json({ limitedEdition }, { status: 200 });
  } catch (error) {
    console.error("GET Single LimitedEdition Error:", error);
    return NextResponse.json(
      { error: "خطا در بازیابی اطلاعات لیمیتد ادیشن" },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;
    const body = await req.json();

    const limitedEdition = await LimitedEdition.findById(id);

    if (!limitedEdition) {
      return NextResponse.json(
        { error: "لیمیتد ادیشن مورد نظر یافت نشد" },
        { status: 404 }
      );
    }

    // در صورت تغییر نام، یکتا بودن آن بررسی می‌شود
    if (body.name && body.name !== limitedEdition.name) {
      const duplicate = await LimitedEdition.findOne({
        name: { $regex: new RegExp(`^${body.name}$`, "i") },
        _id: { $ne: id },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "لیمیتد ادیشن با این نام قبلاً ثبت شده است" },
          { status: 409 }
        );
      }
    }

    Object.keys(body).forEach((key) => {
      limitedEdition[key] = body[key];
    });

    await limitedEdition.save();

    revalidateContent(["limited-editions", "products"]);

    return NextResponse.json(
      {
        message: "به‌روزرسانی با موفقیت انجام شد",
        data: limitedEdition,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PUT LimitedEdition Error:", error);
    return NextResponse.json(
      { error: "خطا در ویرایش اطلاعات" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    const limitedEdition = await LimitedEdition.findById(id);

    if (!limitedEdition) {
      return NextResponse.json(
        { error: "لیمیتد ادیشن یافت نشد" },
        { status: 404 }
      );
    }

    // محصولات حذف نمی‌شوند؛ فقط ارتباطشان با این لیمیتد ادیشن برداشته می‌شود
    await Product.updateMany(
      { limitedEdition: id },
      { $set: { limitedEdition: null } }
    );

    await LimitedEdition.findByIdAndDelete(id);

    revalidateContent(["limited-editions", "products"]);

    return NextResponse.json(
      { message: "لیمیتد ادیشن با موفقیت حذف شد" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE LimitedEdition Error:", error);
    return NextResponse.json(
      { error: "خطا در عملیات حذف" },
      { status: 500 }
    );
  }
}
