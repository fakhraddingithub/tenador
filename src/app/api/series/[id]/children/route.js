import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import Serie from "base/models/Serie";

export async function GET(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    /*
     |--------------------------------------------------------------------------
     | Parent Serie Check
     |--------------------------------------------------------------------------
     */

    const parentSerie = await Serie.findById(id);

    if (!parentSerie) {
      return NextResponse.json(
        {
          error: "سری مورد نظر یافت نشد",
        },

        { status: 404 }
      );
    }

    /*
     |--------------------------------------------------------------------------
     | Get Direct Children
     |--------------------------------------------------------------------------
     */

    const children = await Serie.find({
      parentSerie: id,
    })
      .populate("brand")
      .sort({
        createdAt: -1,
      })
      .lean();

    /*
     |--------------------------------------------------------------------------
     | Response
     |--------------------------------------------------------------------------
     */

    return NextResponse.json(
      {
        parent: parentSerie,

        count: children.length,

        children,
      },

      { status: 200 }
    );
  } catch (error) {
    console.error(
      "GET CHILD SERIES ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "خطا در دریافت زیرسری‌ها",
      },

      { status: 500 }
    );
  }
}