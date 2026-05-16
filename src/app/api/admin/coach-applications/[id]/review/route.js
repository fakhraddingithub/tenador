import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import { verifyToken } from 'base/utils/auth';

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// تابع کمکی برای ساخت کد منحصربه‌فرد مربیگری (مانند: TR-4921)
async function generateUniqueCoachCode() {
  let isUnique = false;
  let code = "";
  while (!isUnique) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    code = `TR-${randomDigits}`;
    const exists = await User.findOne({ coachCode: code });
    if (!exists) isUnique = true;
  }
  return code;
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();
    const authUser = await getUserFromToken();

    if (!authUser) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // const adminUser = await User.findById(authUser.userId);
    // if (!adminUser || adminUser.role !== 'admin') {
    //   return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    // }

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
      targetUser.name = targetUser.coachApplication.fullName;
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