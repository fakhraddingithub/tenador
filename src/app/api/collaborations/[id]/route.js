import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import Collaboration from "base/models/Collaboration";
import Product from "base/models/Product";
import { revalidateContent } from "@/lib/revalidate";

export async function GET(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    const collaboration = await Collaboration.findById(id).lean();

    if (!collaboration) {
      return NextResponse.json(
        { error: "همکاری مورد نظر یافت نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json({ collaboration }, { status: 200 });
  } catch (error) {
    console.error("GET Single Collaboration Error:", error);
    return NextResponse.json(
      { error: "خطا در بازیابی اطلاعات همکاری" },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;
    const body = await req.json();

    const collaboration = await Collaboration.findById(id);

    if (!collaboration) {
      return NextResponse.json(
        { error: "همکاری مورد نظر یافت نشد" },
        { status: 404 }
      );
    }

    // در صورت تغییر نام، یکتا بودن آن بررسی می‌شود
    if (body.name && body.name !== collaboration.name) {
      const duplicate = await Collaboration.findOne({
        name: { $regex: new RegExp(`^${body.name}$`, "i") },
        _id: { $ne: id },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "همکاری با این نام قبلاً ثبت شده است" },
          { status: 409 }
        );
      }
    }

    Object.keys(body).forEach((key) => {
      collaboration[key] = body[key];
    });

    await collaboration.save();

    revalidateContent(["collaborations", "products"]);

    return NextResponse.json(
      {
        message: "به‌روزرسانی با موفقیت انجام شد",
        data: collaboration,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PUT Collaboration Error:", error);
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

    const collaboration = await Collaboration.findById(id);

    if (!collaboration) {
      return NextResponse.json(
        { error: "همکاری یافت نشد" },
        { status: 404 }
      );
    }

    // محصولات حذف نمی‌شوند؛ فقط ارتباطشان با این همکاری برداشته می‌شود
    await Product.updateMany(
      { collaboration: id },
      { $set: { collaboration: null } }
    );

    await Collaboration.findByIdAndDelete(id);

    revalidateContent(["collaborations", "products"]);

    return NextResponse.json(
      { message: "همکاری با موفقیت حذف شد" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE Collaboration Error:", error);
    return NextResponse.json(
      { error: "خطا در عملیات حذف" },
      { status: 500 }
    );
  }
}
