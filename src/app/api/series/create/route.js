import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import Serie from "base/models/Serie";
import Brand from "base/models/Brand";

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

      brand,

      parentSerie = null,

      isLimitedEdition = false,
    } = body;

    /*
     |--------------------------------------------------------------------------
     | Validation
     |--------------------------------------------------------------------------
     */

    if (!name || !title || !brand) {
      return NextResponse.json(
        {
          error: "فیلدهای نام، عنوان و برند الزامی هستند",
        },

        { status: 422 }
      );
    }

    /*
     |--------------------------------------------------------------------------
     | Brand Check
     |--------------------------------------------------------------------------
     */

    const existingBrand = await Brand.findById(brand);

    if (!existingBrand) {
      return NextResponse.json(
        {
          error: "برند انتخاب شده یافت نشد",
        },

        { status: 404 }
      );
    }

    /*
     |--------------------------------------------------------------------------
     | Parent Serie Check
     |--------------------------------------------------------------------------
     */

    let parentSerieDoc = null;

    if (parentSerie) {
      parentSerieDoc = await Serie.findById(parentSerie);

      if (!parentSerieDoc) {
        return NextResponse.json(
          {
            error: "سری والد یافت نشد",
          },

          { status: 404 }
        );
      }

      // parent باید متعلق به همان برند باشد
      if (parentSerieDoc.brand.toString() !== brand) {
        return NextResponse.json(
          {
            error:
              "سری والد باید متعلق به همان برند باشد",
          },

          { status: 400 }
        );
      }
    }

    /*
     |--------------------------------------------------------------------------
     | Duplicate Check
     |--------------------------------------------------------------------------
     |
     | اسم تکراری فقط داخل یک parent ممنوع باشد
     |
     */

    const duplicateSerie = await Serie.findOne({
      name: {
        $regex: new RegExp(`^${name}$`, "i"),
      },

      brand,

      parentSerie: parentSerie || null,
    });

    if (duplicateSerie) {
      return NextResponse.json(
        {
          error:
            "سری با این نام قبلاً ثبت شده است",
        },

        { status: 409 }
      );
    }

    /*
     |--------------------------------------------------------------------------
     | Level Calculation
     |--------------------------------------------------------------------------
     */

    const level = parentSerieDoc
      ? parentSerieDoc.level + 1
      : 0;

    /*
     |--------------------------------------------------------------------------
     | Create Serie
     |--------------------------------------------------------------------------
     */

    const newSerie = await Serie.create({
      name,
      title,
      description,

      colors,

      logo,
      headImage,
      image,

      brand,

      parentSerie,

      level,

      isLimitedEdition,
    });

    /*
     |--------------------------------------------------------------------------
     | Push To Brand
     |--------------------------------------------------------------------------
     */

    await Brand.findByIdAndUpdate(brand, {
      $addToSet: {
        series: newSerie._id,
      },
    });

    /*
     |--------------------------------------------------------------------------
     | Response
     |--------------------------------------------------------------------------
     */

    return NextResponse.json(
      {
        message:
          "سری جدید با موفقیت ایجاد شد",

        data: newSerie,
      },

      { status: 201 }
    );
  } catch (error) {
    console.error(
      "❌ Error in Serie Creation:",
      error
    );

    /*
     |--------------------------------------------------------------------------
     | Mongoose Validation
     |--------------------------------------------------------------------------
     */

    if (error.name === "ValidationError") {
      const messages = Object.values(
        error.errors
      ).map((err) => err.message);

      return NextResponse.json(
        {
          error: messages[0],
        },

        { status: 400 }
      );
    }

    /*
     |--------------------------------------------------------------------------
     | General Error
     |--------------------------------------------------------------------------
     */

    return NextResponse.json(
      {
        error:
          "خطای داخلی سرور در هنگام ایجاد سری",
      },

      { status: 500 }
    );
  }
}