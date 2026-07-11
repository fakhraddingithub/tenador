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
    await connectToDB();
    const authUser = await getUserFromToken();

    if (!authUser) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(authUser.userId)
      .select('-password')
      .populate('coach', 'name lastName avatar coachCode');
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // ساخت لینک معرف داینامیک بر اساس دامین سایت
    const origin = req.nextUrl.origin;
    const referralLink = user.coachCode ? `${origin}/register?ref=${user.coachCode}` : null;

    return NextResponse.json(
      {
        user: {
          id: user._id,
          name: user.name,
          lastName: user.lastName,
          phone: user.phone,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          isCoach: user.role === 'coach', // فلگ برای کنترل فرانت‌اند
          coachCode: user.coachCode,
          walletBalance: user.walletBalance || 0,
          coachApplicationStatus: user.coachApplication?.status || 'none',
          // مدرک/حکم مربیگری (برای ویرایش توسط خودِ مربی)
          coachCertificate: user.role === 'coach' ? (user.coachApplication?.certificateImage || '') : null,
          coach: user.coach || null,
          referralLink: referralLink,
          createdAt: user.createdAt,
        },
      },
      { status: 200 }
    );
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
    if (typeof email === 'string') user.email = email.trim() || undefined;
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