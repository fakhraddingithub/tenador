import { readAuthProfile } from "@/lib/authProfile";
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import { verifyToken } from 'base/utils/auth';

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded;
}

export async function GET(req) {
  try {
    const { user, status } = await readAuthProfile(req.nextUrl.origin);
    return NextResponse.json(user ? { user } : { message: status === 401 ? 'Unauthorized' : 'User not found' },
      { status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await connectToDB();
    const authUser = await getUserFromToken();

    if (!authUser) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ message: 'کاربر یافت نشد' }, { status: 404 });
    }

    const body = await req.json();
    const { name, lastName, email, phone, avatar, certificateImage } = body;

    // فیلدهای عمومی پروفایل (در دسترس همه کاربران)
    if (typeof name === 'string') user.name = name.trim();
    if (typeof lastName === 'string') user.lastName = lastName.trim();

    // ایمیل بدون حساسیت به حروف بزرگ/کوچک بررسی می‌شود — ایندکس یکتای Mongo به‌تنهایی
    // این تفاوت را تشخیص نمی‌دهد (دو سند با کیس متفاوت را دو مقدار جدا می‌بیند)
    if (typeof email === 'string') {
      const trimmedEmail = email.trim();
      if (trimmedEmail) {
        const escaped = trimmedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const duplicate = await User.findOne({
          _id: { $ne: user._id },
          email: { $regex: `^${escaped}$`, $options: 'i' },
        });
        if (duplicate) {
          return NextResponse.json({ message: 'این ایمیل قبلاً توسط کاربر دیگری ثبت شده است' }, { status: 409 });
        }
      }
      user.email = trimmedEmail || undefined;
    }

    if (typeof phone === 'string') user.phone = phone.trim();

    // فیلدهای مخصوص مربی: فقط برای کاربر با نقش coach اعمال می‌شوند
    if (user.role === 'coach') {
      if (typeof avatar === 'string' && avatar) {
        user.avatar = avatar; // عکس پرسنلی (همان عکس روی کارت مربیگری)
      }
      if (typeof certificateImage === 'string' && certificateImage) {
        // اطمینان از وجود ساب‌داکیومنت پیش از مقداردهی
        if (!user.coachApplication) user.coachApplication = { status: 'approved' };
        user.coachApplication.certificateImage = certificateImage; // حکم/مدرک مربیگری
      }
    }

    await user.save();

    return NextResponse.json(
      { message: 'پروفایل با موفقیت بروزرسانی شد' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Profile update error:', error);

    // خطای یکتا بودن ایمیل/شماره موبایل
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const msg = field === 'email'
        ? 'این ایمیل قبلاً توسط کاربر دیگری ثبت شده است'
        : field === 'phone'
          ? 'این شماره موبایل قبلاً ثبت شده است'
          : 'مقدار وارد شده تکراری است';
      return NextResponse.json({ message: msg }, { status: 409 });
    }

    return NextResponse.json({ message: 'خطا در بروزرسانی اطلاعات' }, { status: 500 });
  }
}