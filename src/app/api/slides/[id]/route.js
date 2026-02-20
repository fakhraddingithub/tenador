import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Slide from "base/models/Slide";


export async function GET(req, { params }) {
  try {
    await connectToDB();

    const param = await params 

    const slide = await Slide.findById(param.id);

    if (!slide) {
      return NextResponse.json(
        { message: "اسلاید پیدا نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json(slide);

  } catch (error) {
    return NextResponse.json(
      { message: "خطا در دریافت اسلاید", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();

    const param = await params 

    const slide = await Slide.findById(param.id);

    if (!slide) {
      return NextResponse.json(
        { message: "اسلاید پیدا نشد" },
        { status: 404 }
      );
    }

    await slide.deleteOne();

    return NextResponse.json({ message: "اسلاید حذف شد" });

  } catch (error) {
    console.log(error);
    
    return NextResponse.json(
      { message: "خطا در حذف اسلاید", error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();

    const param = await params 

    const id = param.id

    const body = await req.json();

    const {
      position,
      image,
      title,
      subtitle,
      link,
      priority,
      isActive,
    } = body;

    const existingSlide = await Slide.findById(id);

    if (!existingSlide) {
      return NextResponse.json(
        { message: "اسلاید پیدا نشد" },
        { status: 404 }
      );
    }

    // اگر priority تغییر کرده
    if (
      priority !== undefined &&
      priority !== existingSlide.priority
    ) {
      // بررسی تکراری نبودن
      const conflict = await Slide.findOne({
        _id: { $ne: id },
        position: position || existingSlide.position,
        priority,
      });

      if (conflict) {
        return NextResponse.json(
          { message: "این priority قبلاً استفاده شده" },
          { status: 400 }
        );
      }
    }

    existingSlide.position = position ?? existingSlide.position;
    existingSlide.image = image ?? existingSlide.image;
    existingSlide.title = title ?? existingSlide.title;
    existingSlide.subtitle = subtitle ?? existingSlide.subtitle;
    existingSlide.link = link ?? existingSlide.link;
    existingSlide.priority =
      priority !== undefined ? priority : existingSlide.priority;
    existingSlide.isActive =
      isActive !== undefined ? isActive : existingSlide.isActive;

    await existingSlide.save();

    return NextResponse.json(existingSlide);
  } catch (error) {
    if (error.code === 11000) {
      return NextResponse.json(
        { message: "تداخل در priority" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "خطا در ویرایش اسلاید", error: error.message },
      { status: 500 }
    );
  }
}