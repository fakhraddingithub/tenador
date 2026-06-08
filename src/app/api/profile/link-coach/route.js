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

export async function POST(req) {
  try {
    await connectToDB();
    const authUser = await getUserFromToken();

    if (!authUser) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { coachCode } = await req.json();
    if (!coachCode) {
      return NextResponse.json({ message: 'کد مربی الزامی است' }, { status: 400 });
    }

    // پیدا کردن مربی بر اساس کدی که شاگرد وارد کرده (حذف خط تیره و فاصله برای سازگاری با فرمت قدیمی)
    const normalizedCode = coachCode.replace(/[\s-]/g, '').toUpperCase();
    const coach = await User.findOne({ coachCode: normalizedCode, role: 'coach' });
    if (!coach) {
      return NextResponse.json({ message: 'مربی با این کد معرف یافت نشد' }, { status: 404 });
    }

    const student = await User.findById(authUser.userId);
    if (student.coach) {
      return NextResponse.json({ message: 'شما قبلاً مربی خود را ثبت کرده‌اید' }, { status: 400 });
    }

    if (student._id.toString() === coach._id.toString()) {
      return NextResponse.json({ message: 'شما نمی‌توانید خودتان را به عنوان مربی انتخاب کنید' }, { status: 400 });
    }

    // متصل کردن دو طرفه رابط کاربری
    student.coach = coach._id;
    await student.save();

    // اضافه کردن امن شاگرد به آرایه مربی
    await User.findByIdAndUpdate(coach._id, {
      $addToSet: { students: student._id }
    });

    return NextResponse.json({ message: `شما با موفقیت به عنوان شاگرد ${coach.name} ثبت شدید` }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}