import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import PasswordResetToken from 'base/models/PasswordResetToken';
import { validateEmail, hasher } from 'base/utils/auth';
import { sendPasswordResetCodeEmail } from '@/lib/emailService';
import {
  RESET_CODE_TTL_MS,
  RESET_CODE_TTL_MINUTES,
  RESEND_COOLDOWN_MS,
  generateResetCode,
  generateResetToken,
  hashResetToken,
  emailMatchQuery,
  checkRateLimit,
  getClientIp,
} from '@/lib/passwordResetEmail';

const GENERIC_NO_ACCOUNT = { message: 'حسابی با این ایمیل وجود ندارد' };
const GENERIC_RATE_LIMITED = { message: 'درخواست‌های زیادی ارسال شده است؛ کمی بعد دوباره تلاش کنید' };

export async function POST(request) {
  try {
    await connectToDB();

    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !validateEmail(email.trim())) {
      return NextResponse.json({ message: 'ایمیل معتبر نیست' }, { status: 400 });
    }

    const normalizedEmail = email.trim();

    // محدودسازی نرخ بر اساس IP — قبل از هرگونه lookup تا رفتار برای ایمیل
    // معتبر/نامعتبر یکسان بماند و اطلاعاتی درباره‌ی وجودِ حساب درز نکند.
    const ip = getClientIp(request);
    const allowed = await checkRateLimit(`fpw-email:ip:${ip}`, { max: 8, windowMs: 15 * 60 * 1000 });
    if (!allowed) {
      return NextResponse.json(GENERIC_RATE_LIMITED, { status: 429 });
    }

    const user = await User.findOne({
      email: emailMatchQuery(normalizedEmail),
      provider: 'local',
    });

    if (!user) {
      return NextResponse.json(GENERIC_NO_ACCOUNT, { status: 404 });
    }

    const existing = await PasswordResetToken.findOne({ user: user._id });

    // اگر کدی به‌تازگی (در بازه‌ی cooldown) ارسال شده، همان کد را نگه می‌داریم و
    // فقط یک resetToken تازه به آن پیوند می‌زنیم — بدون ارسال مجدد ایمیل. این‌طور
    // پاسخ برای «تلاش دوباره‌ی سریع» با «ارسال تازه» یکسان می‌ماند و هیچ سیگنالِ
    // اضافی درباره‌ی وجود حساب درز نمی‌کند (توکن قبلی نیز بلافاصله باطل می‌شود).
    if (existing && existing.expiresAt > new Date() && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      const resetToken = generateResetToken();
      existing.tokenHash = hashResetToken(resetToken);
      await existing.save();
      return NextResponse.json({ message: 'کد ارسال شد', resetToken }, { status: 200 });
    }

    const code = generateResetCode();
    const codeHash = await hasher(code);
    const resetToken = generateResetToken();
    const tokenHash = hashResetToken(resetToken);
    const now = new Date();

    await PasswordResetToken.findOneAndUpdate(
      { user: user._id },
      {
        user: user._id,
        tokenHash,
        codeHash,
        expiresAt: new Date(now.getTime() + RESET_CODE_TTL_MS),
        verified: false,
        attempts: 0,
        lastSentAt: now,
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    await sendPasswordResetCodeEmail(user.email, code, RESET_CODE_TTL_MINUTES);

    return NextResponse.json({ message: 'کد ارسال شد', resetToken }, { status: 200 });
  } catch (error) {
    console.error('Forgot password (email) error:', error);
    return NextResponse.json({ message: 'خطای سرور' }, { status: 500 });
  }
}
