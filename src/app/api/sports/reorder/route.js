import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";
import { revalidateContent } from "@/lib/revalidate";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function PUT(req) {
  const { denied } = await requireAdminPermission("sports.reorder");
  if (denied) return denied;

  try {
    await connectToDB();

    const body = await req.json();

    const sports = body.sports;

    if (!Array.isArray(sports)) {
      return NextResponse.json(
        { success: false, message: "Invalid data" },
        { status: 400 }
      );
    }

    await Promise.all(
      sports.map((item) =>
        Sport.findByIdAndUpdate(item.id, {
          order: item.order,
        })
      )
    );

    revalidateContent(["navbar", "sports"]);

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