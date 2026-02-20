import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Slide from "base/models/Slide";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const { position, image, title, subtitle, link, priority, isActive } = body;

    // ولیدیشن ساده ولی جدی
    if (!position || !image) {
      return NextResponse.json(
        { message: "position و image اجباری هستند" },
        { status: 400 }
      );
    }

    // اگر priority نفرستادن، آخرین priority رو پیدا کن
    let finalPriority = priority;

    if (finalPriority === undefined) {
      const lastSlide = await Slide.findOne({ position })
        .sort({ priority: -1 })
        .select("priority");

      finalPriority = lastSlide ? lastSlide.priority + 10 : 10;
    }

    const newSlide = await Slide.create({
      position,
      image,
      title,
      subtitle,
      link,
      priority: finalPriority,
      isActive: isActive ?? true,
    });

    return NextResponse.json(newSlide, { status: 201 });
  } catch (error) {
    // اگر ایندکس یکتا بخوره
    if (error.code === 11000) {
      return NextResponse.json(
        { message: "این priority قبلاً برای این position ثبت شده" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "خطا در ساخت اسلاید", error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req) {
    try {
      await connectToDB();
  
      const { searchParams } = new URL(req.url);
      const position = searchParams.get("position");
      const activeOnly = searchParams.get("active");
  
      const filter = {};
  
      if (position) filter.position = position;
      if (activeOnly === "true") filter.isActive = true;
  
      const slides = await Slide.find(filter).sort({ priority: 1 });
  
      return NextResponse.json(slides);
  
    } catch (error) {
      return NextResponse.json(
        { message: "خطا در دریافت اسلایدها", error: error.message },
        { status: 500 }
      );
    }
  }