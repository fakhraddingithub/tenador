import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import { tokenGenrator, generateRefreshToken } from 'base/utils/auth';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ message: 'Authorization code is required' }, { status: 400 });
    }

    // ۱. تبادل کد با توکن‌های رسمی گوگل
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    // ۲. دریافت اطلاعات رسمی پروفایل گوگل کاربر
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userinfoRes.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    const { sub, email, name, picture } = await userinfoRes.json();
    if (!sub || !email) {
      throw new Error('Incomplete Google user info');
    }

    const googleId = sub;
    await connectToDB();

    // ۳. بررسی هوشمند کاربر در دیتابیس (جلوگیری از خطای Duplicate Key ایمیل)
    let user = await User.findOne({ googleId });

    if (!user) {
      // اگر کاربر با این گوگل‌آیدی نبود، چک میکنیم آیا قبلا با این ایمیل به صورت لوکال ثبت نام کرده؟
      user = await User.findOne({ email: email.toLowerCase().trim() });

      if (user) {
        // اتصال حساب گوگل به حساب کاربری موجود (Account Linking)
        user.googleId = googleId;
        if (!user.avatar) user.avatar = picture; // اگر آواتار نداشت آپدیت میکنیم
        await user.save();
      } else {
        // ساخت کاربر کاملاً جدید گوگل در صورت عدم وجود هرگونه سابقه
        user = new User({
          provider: 'google',
          googleId,
          email: email.toLowerCase().trim(),
          name: name || '',
          avatar: picture || '',
          role: 'user',
          level: 0
          // فیلد phoneVerified به طور خودکار طبق اسکیما برای گوگل true می‌شود
        });
        await user.save();
      }
    }

    // ۴. صدور توکن‌های یکپارچه داخلی سیستم
    const accessToken = tokenGenrator({
      userId: user._id,
      email: user.email,
      role: user.role
    });

    const refreshToken = generateRefreshToken({
      userId: user._id,
      email: user.email,
    });

    // ۵. تنظیم کوکی‌ها و هدایت به صفحه اصلی (ری‌دایرکت)
    const response = NextResponse.redirect(new URL('/', request.url));

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
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/login-register?error=oauth_failed', request.url)
    );
  }
}