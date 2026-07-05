import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import Serie from "base/models/Serie";
import Brand from "base/models/Brand";
import { revalidateContent } from "@/lib/revalidate";

export async function GET(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    const serie = await Serie.findById(id)
      .populate("brand")
      .populate("parentSerie");

    if (!serie) {
      return NextResponse.json(
        {
          error: "سری مورد نظر یافت نشد",
        },

        { status: 404 }
      );
    }

    return NextResponse.json(serie, {
      status: 200,
    });
  } catch (error) {
    console.error(
      "GET Single Serie Error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "خطا در بازیابی اطلاعات سری",
      },

      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    const body = await req.json();

    /*
     |--------------------------------------------------------------------------
     | Find Serie
     |--------------------------------------------------------------------------
     */

    const serie = await Serie.findById(id);

    if (!serie) {
      return NextResponse.json(
        {
          error:
            "سری مورد نظر یافت نشد",
        },

        { status: 404 }
      );
    }

    /*
     |--------------------------------------------------------------------------
     | Brand Validation
     |--------------------------------------------------------------------------
     */

    if (body.brand) {
      const brandExists =
        await Brand.findById(body.brand);

      if (!brandExists) {
        return NextResponse.json(
          {
            error:
              "برند جدید معتبر نیست",
          },

          { status: 404 }
        );
      }
    }

    /*
     |--------------------------------------------------------------------------
     | Parent Serie Validation
     |--------------------------------------------------------------------------
     */

    if (body.parentSerie) {
      // جلوگیری از parent شدن خودش
      if (
        body.parentSerie.toString() ===
        id.toString()
      ) {
        return NextResponse.json(
          {
            error:
              "سری نمی‌تواند والد خودش باشد",
          },

          { status: 400 }
        );
      }

      const parentSerie =
        await Serie.findById(
          body.parentSerie
        );

      if (!parentSerie) {
        return NextResponse.json(
          {
            error:
              "سری والد یافت نشد",
          },

          { status: 404 }
        );
      }

      // parent باید از همان برند باشد
      const targetBrand =
        body.brand || serie.brand;

      if (
        parentSerie.brand.toString() !==
        targetBrand.toString()
      ) {
        return NextResponse.json(
          {
            error:
              "سری والد باید متعلق به همان برند باشد",
          },

          { status: 400 }
        );
      }

      // level update
      serie.level =
        parentSerie.level + 1;
    }

    /*
     |--------------------------------------------------------------------------
     | Remove Parent
     |--------------------------------------------------------------------------
     */

    if (
      body.parentSerie === null ||
      body.parentSerie === ""
    ) {
      serie.parentSerie = null;

      serie.level = 0;
    }

    /*
     |--------------------------------------------------------------------------
     | Update Fields
     |--------------------------------------------------------------------------
     */

    if (Array.isArray(body.sportImages)) {
      serie.sportImages = body.sportImages
        .filter((entry) => entry && entry.sport)
        .map((entry) => ({
          sport: entry.sport,
          image: typeof entry.image === "string" ? entry.image.trim() : "",
          headImage:
            typeof entry.headImage === "string" ? entry.headImage.trim() : "",
        }));
    }

    Object.keys(body).forEach((key) => {
      if (key === "sportImages") return;

      serie[key] = body[key];
    });

    await serie.save();

    revalidateContent(["navbar", "series", "brands"]);

    return NextResponse.json(
      {
        message:
          "به‌روزرسانی با موفقیت انجام شد",

        data: serie,
      },

      { status: 200 }
    );
  } catch (error) {
    console.error(
      "PUT Error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "خطا در ویرایش اطلاعات",
      },

      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    /*
     |--------------------------------------------------------------------------
     | Find Serie
     |--------------------------------------------------------------------------
     */

    const serie = await Serie.findById(id);

    if (!serie) {
      return NextResponse.json(
        {
          error: "سری یافت نشد",
        },

        { status: 404 }
      );
    }

    /*
     |--------------------------------------------------------------------------
     | Child Protection
     |--------------------------------------------------------------------------
     */

    const hasChildren =
      await Serie.exists({
        parentSerie: id,
      });

    if (hasChildren) {
      return NextResponse.json(
        {
          error:
            "ابتدا زیرسری‌های این سری را حذف کنید",
        },

        { status: 400 }
      );
    }

    /*
     |--------------------------------------------------------------------------
     | Delete Serie
     |--------------------------------------------------------------------------
     */

    await Serie.findByIdAndDelete(id);

    /*
     |--------------------------------------------------------------------------
     | Remove From Brand
     |--------------------------------------------------------------------------
     */

    if (serie.brand) {
      await Brand.findByIdAndUpdate(
        serie.brand,
        {
          $pull: {
            series: id,
          },
        }
      );
    }

    revalidateContent(["navbar", "series", "brands"]);

    return NextResponse.json(
      {
        message:
          "سری با موفقیت حذف شد",
      },

      { status: 200 }
    );
  } catch (error) {
    console.error(
      "DELETE Error:",
      error
    );

    return NextResponse.json(
      {
        error: "خطا در عملیات حذف",
      },

      { status: 500 }
    );
  }
}
