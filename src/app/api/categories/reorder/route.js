import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import { revalidateContent } from "@/lib/revalidate";

export async function PUT(req) {
  try {
    await connectToDB();

    const body = await req.json();

    const categories = body.categories;

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { success: false, message: "Invalid data" },
        { status: 400 }
      );
    }

    await Promise.all(
      categories.map((item) =>
        Category.findByIdAndUpdate(item.id, {
          order: item.order,
        })
      )
    );

    revalidateContent(["navbar", "categories"]);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Server Error",
      },
      { status: 500 }
    );
  }
}
