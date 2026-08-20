import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import recordAdminLogin from '@/lib/recordAdminLogin';
import { passwordValidator, tokenGenrator, generateRefreshToken, validatePhone } from 'base/utils/auth';

export async function POST(request) {
  try {
    await connectToDB();

    const { phone, password } = await request.json();

    if (!phone || !password) {
      return NextResponse.json({ message: 'Phone and password are required' }, { status: 400 });
    }

    if (!validatePhone(phone)) {
      return NextResponse.json({ message: 'Invalid phone number' }, { status: 400 });
    }

    // بدون فیلتر provider — کاربری که با گوگل ثبت‌نام کرده و بعداً شماره تلفن +
    // رمز عبور تنظیم کرده نیز باید بتواند با ورود محلی وارد شود.
    const user = await User.findOne({ phone });
    if (!user || !user.password) {
      return NextResponse.json({ message: 'User not found or not a local user' }, { status: 404 });
    }

    const isValid = await passwordValidator(password, user.password);
    if (!isValid) {
      return NextResponse.json({ message: 'Invalid password' }, { status: 401 });
    }

    // اگر این کاربر عضویتِ ادمین دارد، زمانِ ورودش ثبت می‌شود. برای بقیه بی‌اثر است.
    await recordAdminLogin(user._id);

    const accessToken = tokenGenrator({ userId: user._id, phone: user.phone, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id, phone: user.phone });

    const response = NextResponse.json(
      { message: 'Login successful', user: { id: user._id, phone: user.phone, name: user.name, lastName: user.lastName } },
      { status: 200 }
    );

    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 24 * 60 * 60,
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}