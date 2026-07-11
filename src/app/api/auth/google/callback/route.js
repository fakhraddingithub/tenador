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

    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) throw new Error('No access token received from Google');

    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userinfoRes.ok) throw new Error('Failed to fetch Google user info');

    const { sub, email, name, given_name: givenName, family_name: familyName, picture } = await userinfoRes.json();
    if (!sub || !email) throw new Error('Incomplete Google user info');

    await connectToDB();

    let user = await User.findOne({ googleId: sub });
    if (!user) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
      if (user) {
        user.googleId = sub;
        if (!user.avatar) user.avatar = picture;
        await user.save();
      } else {
        user = new User({
          provider: 'google',
          googleId: sub,
          email: email.toLowerCase().trim(),
          name: givenName || name || '',
          lastName: familyName || '',
          avatar: picture || '',
          role: 'user',
          level: 0,
        });
        await user.save();
      }
    }

    const accessToken = tokenGenrator({ userId: user._id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id, email: user.email });

    // callbackUrl از کوکی موقت خونده میشه
    const rawCallback = request.cookies.get('oauth_callback')?.value;
    const finalUrl = rawCallback ? decodeURIComponent(rawCallback) : '/';

    // نکته: قبلاً اینجا revalidatePath('/', 'layout') صدا زده می‌شد که در هر ورودِ
    // گوگل کلِ کشِ ISR سایت را باطل می‌کرد (منشأ اصلی مصرفِ بیش از حدِ ISR Writes).
    // وضعیتِ ورود کاربر سمتِ کلاینت (UserProvider / /api/auth/profile) مدیریت می‌شود،
    // پس باطل‌سازیِ کشِ صفحات هیچ کمکی نمی‌کرد و فقط هزینه ایجاد می‌کرد — حذف شد.

    // ← به جای redirect مستقیم، از صفحه intermediate رد میشیم
    const response = NextResponse.redirect(
      new URL(`/auth/success?next=${encodeURIComponent(finalUrl)}`, request.url)
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

    response.cookies.delete('oauth_callback');

    return response;

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/login-register?error=oauth_failed', request.url)
    );
  }
}