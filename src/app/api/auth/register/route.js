import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import { hasher, tokenGenrator, generateRefreshToken, validatePhone } from 'base/utils/auth';

export async function POST(request) {
  try {
    await connectToDB();

    const { phone, password, name } = await request.json();

    // ۱. اعتبار سنجی فیلدهای اجباری
    if (!phone || !password) {
      return NextResponse.json({ message: 'شماره تلفن و رمز عبور الزامی هستند' }, { status: 400 });
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
      name: name ? name.trim() : '',
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
        user: { id: newUser._id, phone: newUser.phone, name: newUser.name, role: newUser.role } 
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