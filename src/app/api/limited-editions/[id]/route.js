import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import LimitedEdition from "base/models/LimitedEdition";
import Product from "base/models/Product";
import { revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import requireAdminPermission from "@/lib/requireAdminPermission";
import {
  escapeRegexLiteral,
  validateLimitedEditionBrands,
} from "@/lib/limitedEditionRelations";

const EDITABLE_FIELDS = [
  "name",
  "title",
  "description",
  "colors",
  "logo",
  "headImage",
  "image",
];

export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("limitedEditions.view");
  if (denied) return denied;

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
  const { denied } = await requireAdminPermission("limitedEditions.edit");
  if (denied) return denied;

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

    const brandValidation = await validateLimitedEditionBrands(
      limitedEdition.brand,
      Object.hasOwn(body, "relatedBrands")
        ? body.relatedBrands
        : limitedEdition.relatedBrands,
    );
    if (brandValidation.error) {
      return apiError(brandValidation.error, brandValidation.status);
    }

    // در صورت تغییر نام، یکتا بودن آن در محدوده‌ی همان برند بررسی می‌شود
    if (body.name && body.name !== limitedEdition.name) {
      const duplicate = await LimitedEdition.findOne({
        brand: limitedEdition.brand,
        name: {
          $regex: new RegExp(`^${escapeRegexLiteral(body.name)}$`, "i"),
        },
        _id: { $ne: id },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "لیمیتد ادیشن با این نام قبلاً ثبت شده است" },
          { status: 409 }
        );
      }
    }

    for (const key of EDITABLE_FIELDS) {
      if (Object.hasOwn(body, key)) limitedEdition[key] = body[key];
    }
    limitedEdition.relatedBrands = brandValidation.relatedBrands;

    await limitedEdition.save();

    revalidateContent(["limited-editions", "products", "brands"]);

    return NextResponse.json(
      {
        message: "به‌روزرسانی با موفقیت انجام شد",
        data: limitedEdition,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, "خطا در ویرایش اطلاعات");
  }
}

export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("limitedEditions.delete");
  if (denied) return denied;

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

    revalidateContent(["limited-editions", "products", "brands"]);

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
