import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import { verifyToken } from 'base/utils/auth';
import { notifyCoachApplication } from 'base/services/notificationService';

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

    const { fullName, certificateImage, personalImage } = await req.json();

    if (!fullName || !certificateImage || !personalImage) {
      return NextResponse.json({ message: 'تمامی فیلدها الزامی هستند' }, { status: 400 });
    }

    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ message: 'کاربر یافت نشد' }, { status: 404 });
    }

    if (user.role === 'coach') {
      return NextResponse.json({ message: 'شما در حال حاضر مربی هستید' }, { status: 400 });
    }

    // ثبت اطلاعات درخواست در فیلد ساب‌داکومنت دیتابیس
    user.coachApplication = {
      status: 'pending',
      fullName: fullName.trim(),
      certificateImage,
      personalImage,
      appliedAt: new Date(),
    };

    await user.save();

    // اعلان درخواست مربیگری برای پنل مدیریت (شکست، روند را متوقف نمی‌کند)
    await notifyCoachApplication(user);

    return NextResponse.json({ message: 'درخواست شما ثبت شد و در صف بررسی قرار گرفت' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}