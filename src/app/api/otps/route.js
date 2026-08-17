import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Otp from "base/models/Otp";
import requireAdminPermission from "@/lib/requireAdminPermission";

/**
 * ⚠️ توصیه‌ی صریح: این روت باید *حذف* شود، نه فقط محافظت.
 *
 *   GET  همه‌ی کدهای یک‌بارمصرفِ دیتابیس را برمی‌گرداند → ورود به هر حساب
 *   POST برای هر شماره‌ای کدِ دلخواه می‌سازد            → ورود به هر حساب
 *
 * هیچ فراخوانی‌ای در کلِ کدبیس ندارد و هیچ «قابلیتِ مدیریتیِ مشروعی» متناظرش
 * نیست، پس کلیدِ اختصاصی هم برایش ساخته نشده. تا زمان حذف، پشتِ بالاترین
 * کلیدِ اعتماد بسته می‌شود تا عملاً از دسترس خارج باشد.
 */

export async function GET(req) {
  const { denied } = await requireAdminPermission("admins.managePermissions");
  if (denied) return denied;

  try {
    await connectToDB();
    const otps = await Otp.find({});
    return NextResponse.json({ otps });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const { denied } = await requireAdminPermission("admins.managePermissions");
  if (denied) return denied;

  try {
    await connectToDB();
    const body = await req.json();
    const { phone, code, expTime, waitTime, useTimes } = body;

    // Validation
    if (!phone || !code || !expTime) {
      return NextResponse.json({ error: "Phone, code, and expTime are required" }, { status: 400 });
    }

    const newOtp = new Otp({
      phone,
      code,
      expTime,
      waitTime: waitTime || 0,
      useTimes: useTimes || 0
    });

    await newOtp.save();
    return NextResponse.json({ otp: newOtp }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
