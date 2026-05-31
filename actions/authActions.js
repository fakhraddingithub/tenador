'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import {
  passwordValidator,
  tokenGenrator,
  generateRefreshToken,
  validatePhone,
} from 'base/utils/auth';

export async function loginAction({ phone, password, callbackUrl = '/' }) {
  let redirectUrl = callbackUrl;

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

    const accessToken = tokenGenrator({ userId: user._id, phone: user.phone });
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

    // باطل کردن کش layout از سمت سرور
    revalidatePath('/', 'layout');

  } catch (error) {
    console.error('Login action error:', error);
    return { error: 'خطا در سرور' };
  }

  // redirect باید خارج از try/catch باشه
  redirect(redirectUrl);
}