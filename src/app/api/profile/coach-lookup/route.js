/**
 * src/app/api/profile/coach-lookup/route.js
 *
 * GET → جستجوی مربی بر اساس کد معرف بدون اتصال (برای نمایش در مودال تایید)
 *        query param: code
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import User from "base/models/User";
import { verifyToken } from "base/utils/auth";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// نرمال‌سازی کد: حذف خط تیره و فاصله و بزرگ کردن حروف (سازگار با فرمت قدیمی TR-0000)
function normalizeCode(code) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export async function GET(req) {
  try {
    await connectToDB();
    const authUser = await getUserFromToken();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawCode = searchParams.get("code")?.trim();
    if (!rawCode) {
      return NextResponse.json({ message: "کد مربی الزامی است" }, { status: 400 });
    }

    const code = normalizeCode(rawCode);
    const coach = await User.findOne({ coachCode: code, role: "coach" }).select(
      "name avatar coachCode email phone createdAt"
    );

    if (!coach) {
      return NextResponse.json(
        { message: "مربی با این کد معرف یافت نشد" },
        { status: 404 }
      );
    }

    if (coach._id.toString() === authUser.userId) {
      return NextResponse.json(
        { message: "شما نمی‌توانید خودتان را به عنوان مربی انتخاب کنید" },
        { status: 400 }
      );
    }

    // تعداد شاگردان مربی برای نمایش در مودال
    const studentsCount = await User.countDocuments({ coach: coach._id });

    return NextResponse.json(
      {
        coach: {
          _id: coach._id,
          name: coach.name,
          avatar: coach.avatar,
          coachCode: coach.coachCode,
          studentsCount,
          createdAt: coach.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[profile/coach-lookup GET]", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
