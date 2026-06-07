import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Banner from "base/models/Banner";
import { revalidateContent } from "@/lib/revalidate";

// GET یک بنر
export async function GET(req, { params }) {
  try {
    await connectToDB();
    const param = await params
    const banner = await Banner.findById(param.id);
    if (!banner) {
      return NextResponse.json(
        { success: false, error: "بنر یافت نشد" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, banner });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "خطا در دریافت بنر" },
      { status: 500 }
    );
  }
}

// PUT - ویرایش بنر
export async function PUT(req, { params }) {
  try {
    await connectToDB();
    const body = await req.json();
    const param = await params
    const banner = await Banner.findByIdAndUpdate(
      param.id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!banner) {
      return NextResponse.json(
        { success: false, error: "بنر یافت نشد" },
        { status: 404 }
      );
    }

    revalidateContent(["banners"]);

    return NextResponse.json({ success: true, banner });
  } catch (error) {
    console.error("UPDATE BANNER ERROR:", error);
    return NextResponse.json(
      { success: false, error: "خطا در ویرایش بنر" },
      { status: 500 }
    );
  }
}

// DELETE - حذف بنر
export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const param = await params
    const banner = await Banner.findByIdAndDelete(param.id);

    if (!banner) {
      return NextResponse.json(
        { success: false, error: "بنر یافت نشد" },
        { status: 404 }
      );
    }

    revalidateContent(["banners"]);

    return NextResponse.json({ success: true, message: "بنر حذف شد" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "خطا در حذف بنر" },
      { status: 500 }
    );
  }
}
