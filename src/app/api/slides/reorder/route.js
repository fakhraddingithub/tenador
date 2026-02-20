import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Slide from "base/models/Slide";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const { position, orderedIds } = body;

    if (!position || !Array.isArray(orderedIds)) {
      return NextResponse.json({ message: "داده نامعتبر است" }, { status: 400 });
    }

    // ۱. مرحله اول: تمام اسلایدهای این پوزیشن را به مقادیر منفی موقت ببرید
    // این کار باعث می‌شود تمام priorityهای فعلی آزاد شوند
    const tempOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, position },
        update: { $set: { priority: -(index + 1) } },
      },
    }));

    await Slide.bulkWrite(tempOps);

    // ۲. مرحله دوم: حالا مقادیر مثبت و نهایی را ست کنید
    const finalOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, position },
        update: { $set: { priority: (index + 1) * 10 } },
      },
    }));

    await Slide.bulkWrite(finalOps);

    return NextResponse.json({ message: "مرتب‌سازی با موفقیت انجام شد" });

  } catch (error) {
    console.log("REORDER ERROR:", error);
    return NextResponse.json(
      { message: "خطا در مرتب‌سازی", error: error.message },
      { status: 500 }
    );
  }
}