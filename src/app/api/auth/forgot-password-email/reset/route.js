import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import PasswordResetToken from 'base/models/PasswordResetToken';
import { hasher, validatePassword, tokenGenrator, generateRefreshToken } from 'base/utils/auth';
import { hashResetToken } from '@/lib/passwordResetEmail';

const GENERIC_INVALID = { message: 'نشست بازیابی نامعتبر یا منقضی شده است؛ دوباره ایمیل خود را وارد کنید' };

export async function POST(request) {
  try {
    await connectToDB();

    const { resetToken, password, confirmPassword } = await request.json();

    if (!resetToken || typeof resetToken !== 'string') {
      return NextResponse.json(GENERIC_INVALID, { status: 400 });
    }

    if (!password || !confirmPassword) {
      return NextResponse.json({ message: 'رمز عبور و تکرار آن الزامی است' }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ message: 'رمز عبور و تکرار آن یکسان نیستند' }, { status: 400 });
    }

    if (!validatePassword(password)) {
      return NextResponse.json(
        { message: 'رمز عبور باید حداقل ۸ کاراکتر، شامل حروف بزرگ، کوچک، عدد و کاراکتر ویژه باشد' },
        { status: 400 },
      );
    }

    const doc = await PasswordResetToken.findOne({ tokenHash: hashResetToken(resetToken) });

    if (!doc || doc.expiresAt <= new Date()) {
      return NextResponse.json(GENERIC_INVALID, { status: 400 });
    }

    if (!doc.verified) {
      return NextResponse.json({ message: 'ابتدا کد ارسال‌شده را تأیید کنید' }, { status: 400 });
    }

    const user = await User.findOne({ _id: doc.user, provider: 'local' });
    if (!user) {
      return NextResponse.json(GENERIC_INVALID, { status: 400 });
    }

    user.password = await hasher(password);
    await user.save();

    // نشست بازیابی تک‌مصرفی است — پس از تغییر موفق رمز، بلافاصله حذف می‌شود
    await PasswordResetToken.deleteOne({ _id: doc._id });

    // ورود خودکار — همان الگوی مورد استفاده در ثبت‌نام/ورود
    const accessToken = tokenGenrator({ userId: user._id, phone: user.phone, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id, phone: user.phone });

    const response = NextResponse.json(
      {
        message: 'رمز عبور با موفقیت تغییر یافت',
        user: { id: user._id, phone: user.phone, name: user.name, lastName: user.lastName, role: user.role },
      },
      { status: 200 },
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
    console.error('Reset password (email) error:', error);
    return NextResponse.json({ message: 'خطای سرور' }, { status: 500 });
  }
}
