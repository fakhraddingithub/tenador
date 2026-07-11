import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import { hasher, tokenGenrator, generateRefreshToken, validatePhone } from 'base/utils/auth';

export async function POST(request) {
  try {
    await connectToDB();

    const { phone, password, name, lastName } = await request.json();

    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedLastName = typeof lastName === "string" ? lastName.trim() : "";

    // ۱. اعتبار سنجی فیلدهای اجباری
    if (!phone || !password || !normalizedName || !normalizedLastName) {
      return NextResponse.json({ message: "\u0646\u0627\u0645\u060c \u0646\u0627\u0645 \u062e\u0627\u0646\u0648\u0627\u062f\u06af\u06cc\u060c \u0634\u0645\u0627\u0631\u0647 \u062a\u0644\u0641\u0646 \u0648 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0627\u0644\u0632\u0627\u0645\u06cc \u0647\u0633\u062a\u0646\u062f" }, { status: 400 });
    }

    if (!validatePhone(phone)) {
      return NextResponse.json({ message: 'شماره تلفن وارد شده معتبر نیست' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({
        message: 'رمز عبور باید حداقل ۸ کاراکتر باشد'
      }, { status: 400 });
    }

    // ۲. بررسی تکراری نبودن شماره تلفن
    const existingUser = await User.findOne({ phone: phone.trim() });
    if (existingUser) {
      return NextResponse.json({ message: 'کاربری با این شماره تلفن از قبل وجود دارد' }, { status: 409 });
    }

    // ۳. هش کردن رمز عبور
    const hashedPassword = await hasher(password);

    // ۴. ساخت کاربر جدید بر اساس ساختار اسکیمای اصلاح شده
    const newUser = new User({
      provider: 'local',
      phone: phone.trim(),
      password: hashedPassword,
      name: normalizedName,
      lastName: normalizedLastName,
      role: 'user',       // بر اساس default اسکیما
      level: 0,          // بر اساس default اسکیما
      phoneVerified: false // برای ثبت نام لوکال ابتدا تایید نشده است
    });

    await newUser.save();

    // ۵. تولید توکن‌های داخلی سیستم
    const accessToken = tokenGenrator({ userId: newUser._id, phone: newUser.phone, role: newUser.role });
    const refreshToken = generateRefreshToken({ userId: newUser._id, phone: newUser.phone });

    // ۶. تنظیم کوکی‌ها و خروجی موفقیت‌آمیز
    const response = NextResponse.json(
      { 
        message: 'ثبت نام با موفقیت انجام شد', 
        user: { id: newUser._id, phone: newUser.phone, name: newUser.name, lastName: newUser.lastName, role: newUser.role }
      }, 
      { status: 201 }
    );

    // توکن دسترسی کوتاه‌مدت (۵ دقیقه)
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 5 * 60, 
    });

    // توکن نوسازی بلندمدت (۱۵ روز)
    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 24 * 60 * 60, 
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ message: 'خطای سرور در پردازش ثبت نام' }, { status: 500 });
  }
}
