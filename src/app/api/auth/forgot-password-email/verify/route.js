import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import PasswordResetToken from 'base/models/PasswordResetToken';
import { passwordValidator } from 'base/utils/auth';
import { MAX_VERIFY_ATTEMPTS, hashResetToken } from '@/lib/passwordResetEmail';

const GENERIC_INVALID = { message: 'کد نامعتبر یا منقضی شده است' };

export async function POST(request) {
  try {
    await connectToDB();

    const { resetToken, code } = await request.json();

    if (!resetToken || typeof resetToken !== 'string' || !code || typeof code !== 'string') {
      return NextResponse.json({ message: 'کد و نشست بازیابی الزامی است' }, { status: 400 });
    }

    const doc = await PasswordResetToken.findOne({ tokenHash: hashResetToken(resetToken) });

    if (!doc || doc.expiresAt <= new Date()) {
      return NextResponse.json(GENERIC_INVALID, { status: 400 });
    }

    if (doc.attempts >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json(
        { message: 'تعداد تلاش‌های مجاز به پایان رسید؛ درخواست کد جدید کنید' },
        { status: 429 },
      );
    }

    const isValid = await passwordValidator(code, doc.codeHash);

    if (!isValid) {
      doc.attempts += 1;
      await doc.save();
      return NextResponse.json({ message: 'کد وارد شده صحیح نیست' }, { status: 400 });
    }

    doc.verified = true;
    await doc.save();

    return NextResponse.json({ message: 'کد تأیید شد' }, { status: 200 });
  } catch (error) {
    console.error('Verify password reset code error:', error);
    return NextResponse.json({ message: 'خطای سرور' }, { status: 500 });
  }
}
