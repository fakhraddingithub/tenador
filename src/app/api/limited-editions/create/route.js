import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import LimitedEdition from "base/models/LimitedEdition";
import { registerSlug } from "base/actions/registerSlug";
import { revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import requireAdminPermission from "@/lib/requireAdminPermission";
import {
  escapeRegexLiteral,
  validateLimitedEditionBrands,
} from "@/lib/limitedEditionRelations";

export async function POST(req) {
  const { denied } = await requireAdminPermission("limitedEditions.create");
  if (denied) return denied;

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
      relatedBrands,
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

    const brandValidation = await validateLimitedEditionBrands(brand, relatedBrands);
    if (brandValidation.error) {
      return apiError(brandValidation.error, brandValidation.status);
    }

    // نام تکراری فقط زیر همان برند ممنوع است؛ برندهای مختلف می‌توانند Edition
    // هم‌نام داشته باشند (مثل Wilson و Lacoste / Roland Garros).
    const duplicate = await LimitedEdition.findOne({
      brand: brandValidation.owner,
      name: { $regex: new RegExp(`^${escapeRegexLiteral(name)}$`, "i") },
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
      relatedBrands: brandValidation.relatedBrands,
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

    revalidateContent(["limited-editions", "products", "brands"]);

    return NextResponse.json(
      {
        message: "لیمیتد ادیشن جدید با موفقیت ایجاد شد",
        data: newLimitedEdition,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "خطا در ایجاد لیمیتد ادیشن");
  }
}
