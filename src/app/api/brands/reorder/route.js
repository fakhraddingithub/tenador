import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import { revalidateContent } from "@/lib/revalidate";

export async function PUT(req) {
  try {
    await connectToDB();

    const body = await req.json();

    const brands = body.brands;

    if (!Array.isArray(brands)) {
      return NextResponse.json(
        { success: false, message: "Invalid data" },
        { status: 400 }
      );
    }

    await Promise.all(
      brands.map((item) =>
        Brand.findByIdAndUpdate(item.id, {
          order: item.order,
        })
      )
    );

    revalidateContent(["navbar", "brands"]);

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
