import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import Serie from "base/models/Serie";
import Brand from "base/models/Brand";
import { purgeSportPagesCdn, revalidateContent } from "@/lib/revalidate";
import { sanitizeSerieSportEntries } from "@/lib/serieSportContent";
import { apiError, handleApiError } from "@/lib/apiError";
import { sanitizeArticleBlocks } from "@/lib/articleValidation";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function GET(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    const serie = await Serie.findById(id)
      .select("+articleBlocks")
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
    return handleApiError(error, "خطا در بازیابی اطلاعات سری");
  }
}

export async function PUT(req, { params }) {
  const { denied } = await requireAdminPermission("series.edit");
  if (denied) return denied;

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
      serie.sportImages = sanitizeSerieSportEntries(body.sportImages);
    }

    // undefined = this request is not about the mini article; leave it alone.
    if (body.articleBlocks !== undefined) {
      const blockErrors = {};
      const sanitizedArticleBlocks = sanitizeArticleBlocks(body.articleBlocks, blockErrors);
      if (Object.keys(blockErrors).length > 0) {
        return apiError("بلوک‌های مینی مقاله معتبر نیستند", 400, {
          fieldErrors: blockErrors,
        });
      }
      serie.articleBlocks = sanitizedArticleBlocks;
    }

    Object.keys(body).forEach((key) => {
      if (key === "sportImages" || key === "articleBlocks") return;

      serie[key] = body[key];
    });

    await serie.save();

    revalidateContent(["navbar", "series", "brands"]);
    // The serie article renders on /[sport]/[brand]/[serie], which the CDN caches.
    if (body.articleBlocks !== undefined) await purgeSportPagesCdn();

    return NextResponse.json(
      {
        message:
          "به‌روزرسانی با موفقیت انجام شد",

        data: serie,
      },

      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, "خطا در ویرایش سری");
  }
}

export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("series.delete");
  if (denied) return denied;

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
    return handleApiError(error, "خطا در حذف سری");
  }
}
