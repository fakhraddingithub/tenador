import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import PasswordResetToken from 'base/models/PasswordResetToken';
import { hasher } from 'base/utils/auth';
import { sendPasswordResetCodeEmail } from '@/lib/emailService';
import {
  RESET_CODE_TTL_MS,
  RESET_CODE_TTL_MINUTES,
  RESEND_COOLDOWN_MS,
  generateResetCode,
  generateResetToken,
  hashResetToken,
} from '@/lib/passwordResetEmail';

const GENERIC_INVALID = { message: 'نشست بازیابی نامعتبر یا منقضی شده است؛ دوباره ایمیل خود را وارد کنید' };

export async function POST(request) {
  try {
    await connectToDB();

    const { resetToken } = await request.json();

    if (!resetToken || typeof resetToken !== 'string') {
      return NextResponse.json(GENERIC_INVALID, { status: 400 });
    }

    const doc = await PasswordResetToken.findOne({ tokenHash: hashResetToken(resetToken) });

    if (!doc || doc.expiresAt <= new Date()) {
      return NextResponse.json(GENERIC_INVALID, { status: 400 });
    }

    if (Date.now() - doc.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - doc.lastSentAt.getTime())) / 1000);
      return NextResponse.json({ message: `لطفاً ${waitSeconds} ثانیه صبر کنید و دوباره تلاش کنید` }, { status: 429 });
    }

    const user = await User.findById(doc.user);
    if (!user) {
      return NextResponse.json(GENERIC_INVALID, { status: 400 });
    }

    const code = generateResetCode();
    const newResetToken = generateResetToken();
    const now = new Date();

    doc.codeHash = await hasher(code);
    doc.tokenHash = hashResetToken(newResetToken);
    doc.expiresAt = new Date(now.getTime() + RESET_CODE_TTL_MS);
    doc.verified = false;
    doc.attempts = 0;
    doc.lastSentAt = now;
    await doc.save();

    await sendPasswordResetCodeEmail(user.email, code, RESET_CODE_TTL_MINUTES);

    return NextResponse.json({ message: 'کد جدید ارسال شد', resetToken: newResetToken }, { status: 200 });
  } catch (error) {
    console.error('Resend password reset code error:', error);
    return NextResponse.json({ message: 'خطای سرور' }, { status: 500 });
  }
}
