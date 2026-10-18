import "base/models/registerModels";
import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";
import { NextResponse } from "next/server";
import { revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { brochureStatusOf } from "@/lib/brandBrochure";

export async function GET(req, { params }) {
  try {
    await connectToDB();
    const { sportId } = await params;
    const sport = await Sport.findById(sportId).select("+brochure");

    if (!sport) {
      return NextResponse.json(
        { error: "ورزش پیدا نشد" },
        { status: 404 }
      );
    }

    // فقط *وضعیتِ* بروشور، برای کارتِ بروشور در فرمِ ورزش (همان قراردادِ روتِ
    // برند)؛ خودِ بلوک‌ها از روتِ بروشور خوانده می‌شوند.
    const brochureStatus = brochureStatusOf(sport.brochure);
    sport.brochure = undefined;

    return NextResponse.json({ sport, brochureStatus });
  } catch (error) {
    return handleApiError(error, "خطا در دریافت ورزش");
  }
}

export async function PUT(req, { params }) {
  const { denied } = await requireAdminPermission("sports.edit");
  if (denied) return denied;

  try {
    await connectToDB();
    const { sportId } = await params;
    const body = await req.json();
    const { name, title, description, icon, image } = body;

    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return apiError("«عنوان فارسی ورزش» الزامی است", 400, {
        fieldErrors: { title: "«عنوان فارسی ورزش» الزامی است" },
      });
    }

    const sport = await Sport.findById(sportId);
    if (!sport) {
      return NextResponse.json(
        { error: "ورزش پیدا نشد" },
        { status: 404 }
      );
    }

    if (name && name.trim() !== "") {
      sport.name = name.trim();
    }
    if (title !== undefined) {
      sport.title = title.trim();
    }
    if (description !== undefined) {
      sport.description = description;
    }
    if (icon !== undefined) {
      sport.icon = icon;
    }
    if (image !== undefined) {
      sport.image = image;
    }

    await sport.save();

    revalidateContent(["navbar", "sports"]);

    return NextResponse.json({
      message: "ورزش با موفقیت به‌روزرسانی شد",
      sport,
    });
  } catch (error) {
    return handleApiError(error, "خطا در به‌روزرسانی ورزش");
  }
}

export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("sports.delete");
  if (denied) return denied;

  try {
    await connectToDB();
    const { sportId } = await params;
    
    const sport = await Sport.findByIdAndDelete(sportId);
    if (!sport) {
      return NextResponse.json(
        { error: "ورزش پیدا نشد" },
        { status: 404 }
      );
    }

    revalidateContent(["navbar", "sports"]);

    return NextResponse.json({
      message: "ورزش با موفقیت حذف شد",
    });
  } catch (error) {
    return handleApiError(error, "خطا در حذف ورزش");
  }
}
