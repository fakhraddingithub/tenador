import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Serie from "base/models/Serie";
import { revalidateContent } from "@/lib/revalidate";
import requireAdminPermission from "@/lib/requireAdminPermission";

/**
 * PUT /api/series/reorder
 * body: { series: [{ id, order }] }
 *
 * ترتیب نمایش سری‌ها/زیرسری‌ها را ذخیره می‌کند (drag & drop در پنل ادمین).
 * همان ترتیب در همه جای سایت (صفحه برند، صفحات ورزشی و ...) اعمال می‌شود.
 */
export async function PUT(req) {
  // رجیستری کلیدِ مستقلِ «ترتیب» برای سری ندارد؛ همان ویرایش است (manifest).
  const { denied } = await requireAdminPermission("series.edit");
  if (denied) return denied;

  try {
    await connectToDB();

    const body = await req.json();
    const series = body.series;

    if (!Array.isArray(series)) {
      return NextResponse.json(
        { success: false, message: "Invalid data" },
        { status: 400 }
      );
    }

    await Promise.all(
      series.map((item) =>
        Serie.findByIdAndUpdate(item.id, { order: item.order })
      )
    );

    revalidateContent(["navbar", "brands", "series"]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 }
    );
  }
}
