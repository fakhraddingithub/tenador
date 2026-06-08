import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import { verifyToken } from 'base/utils/auth';

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded;
}

export async function GET(req) {
  try {
    await connectToDB();
    const authUser = await getUserFromToken();

    if (!authUser) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(authUser.userId)
      .select('-password')
      .populate('coach', 'name avatar coachCode');
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // ساخت لینک معرف داینامیک بر اساس دامین سایت
    const origin = req.nextUrl.origin;
    const referralLink = user.coachCode ? `${origin}/register?ref=${user.coachCode}` : null;

    return NextResponse.json(
      {
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          isCoach: user.role === 'coach', // فلگ برای کنترل فرانت‌اند
          coachCode: user.coachCode,
          walletBalance: user.walletBalance || 0,
          coachApplicationStatus: user.coachApplication?.status || 'none',
          coach: user.coach || null,
          referralLink: referralLink,
          createdAt: user.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}