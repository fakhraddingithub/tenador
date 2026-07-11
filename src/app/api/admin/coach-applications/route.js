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

export async function GET() {
  try {
    await connectToDB();
    const authUser = await getUserFromToken();

    if (!authUser) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // بررسی سطح دسترسی کاربر لایو شده
    // const adminUser = await User.findById(authUser.userId);
    // if (!adminUser || adminUser.role !== 'admin') {
    //   return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    // }

    // واکشی تمام کاربران با وضعیت pending
    const applications = await User.find({ 'coachApplication.status': 'pending' })
      .select('name lastName email phone coachApplication createdAt');

    return NextResponse.json({ applications }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}