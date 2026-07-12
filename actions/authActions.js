'use server';

import { cookies } from 'next/headers';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import {
  passwordValidator,
  tokenGenrator,
  generateRefreshToken,
  validatePhone,
} from 'base/utils/auth';

export async function loginAction({ phone, password, callbackUrl = '/' }) {
  try {
    await connectToDB();

    if (!phone || !password) {
      return { error: 'شماره و رمز عبور الزامی است' };
    }

    if (!validatePhone(phone)) {
      return { error: 'شماره موبایل نامعتبر است' };
    }

    const user = await User.findOne({ phone, provider: 'local' });
    if (!user) {
      return { error: 'کاربری با این مشخصات یافت نشد' };
    }

    const isValid = await passwordValidator(password, user.password);
    if (!isValid) {
      return { error: 'رمز عبور اشتباه است' };
    }

    // The admin middleware authorizes /p-admin from the role claim. Keep the
    // local-login token consistent with Google login and the login API.
    const accessToken = tokenGenrator({
      userId: user._id,
      phone: user.phone,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({ userId: user._id, phone: user.phone });

    const cookieStore = await cookies();

    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 24 * 60 * 60,
    });

    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 24 * 60 * 60,
    });
  } catch (error) {
    console.error('Login action error:', error);
    return { error: 'خطا در سرور' };
  }

  // به‌جای redirect سروری (soft-nav) موفقیت را برمی‌گردانیم تا کلاینت یک
  // hard-navigation انجام دهد؛ این‌طور جزیره‌ی UserProvider با وضعیت جدید مانت
  // می‌شود و نام کاربر بلافاصله در نوبار ظاهر می‌شود. (صفحات عمومی static باقی می‌مانند)
  return { success: true, redirectUrl: callbackUrl };
}