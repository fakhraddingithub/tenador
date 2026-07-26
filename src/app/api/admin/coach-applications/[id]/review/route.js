import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import { splitFullName } from 'base/utils/userName';
import requireAdmin, { unauthorized } from '@/lib/requireAdmin';

import User from 'base/models/User';
// تابع کمکی برای ساخت کد منحصربه‌فرد مربیگری (مانند: TR4921)
async function generateUniqueCoachCode() {
  let isUnique = false;
  let code = "";
  while (!isUnique) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    code = `TR${randomDigits}`;
    const exists = await User.findOne({ coachCode: code });
    if (!exists) isUnique = true;
  }
  return code;
}

export async function PUT(req, { params }) {
  // تأیید درخواست، نقش کاربر را به «مربی» ارتقا می‌دهد؛ بنابراین نقشِ درخواست‌کننده
  // حتماً باید از دیتابیس بررسی شود (نه صرفاً از روی توکن).
  if (!(await requireAdmin())) return unauthorized();

  try {
    await connectToDB();

    const { id } = await params; // آی‌دی کاربری که درخواست مربیگری داده است
    const { action, rejectionReason } = await req.json(); // action: "approved" یا "rejected"

    const targetUser = await User.findById(id);
    if (!targetUser || targetUser.coachApplication.status !== 'pending') {
      return NextResponse.json({ message: 'درخواست معتبری یافت نشد' }, { status: 404 });
    }

    if (action === 'approved') {
      const coachCode = await generateUniqueCoachCode();

      targetUser.role = 'coach';
      targetUser.coachCode = coachCode;
      
      // جایگزینی نام و آواتار تایید شده در فیلدهای اصلی پروفایل مربی
      const verifiedName = splitFullName(targetUser.coachApplication.fullName);
      targetUser.name = verifiedName.name;
      targetUser.lastName = verifiedName.lastName;
      targetUser.avatar = targetUser.coachApplication.personalImage;
      
      targetUser.coachApplication.status = 'approved';
      targetUser.coachApplication.reviewedAt = new Date();

      await targetUser.save();
      return NextResponse.json({ message: 'مربی با موفقیت تایید و فعال شد', coachCode }, { status: 200 });
    } 
    
    if (action === 'rejected') {
      if (!rejectionReason) {
        return NextResponse.json({ message: 'علت رد درخواست الزامی است' }, { status: 400 });
      }

      targetUser.coachApplication.status = 'rejected';
      targetUser.coachApplication.rejectionReason = rejectionReason;
      targetUser.coachApplication.reviewedAt = new Date();

      await targetUser.save();
      return NextResponse.json({ message: 'درخواست مربیگری رد شد' }, { status: 200 });
    }

    return NextResponse.json({ message: 'اکشن نامعتبر است' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}