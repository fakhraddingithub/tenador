import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';
import { verifyToken } from 'base/utils/auth';

export async function PUT(request) {
  try {
    await connectToDB();

    const cookieStore = cookies();
    const accessToken = cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(accessToken);
    if (!payload) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const { name, lastName, avatar } = await request.json();

    // Find user
    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Update fields (restrict sensitive ones)
    if (name !== undefined) user.name = name;
    if (lastName !== undefined) user.lastName = lastName;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    return NextResponse.json({ message: 'Profile updated successfully', user: { id: user._id, phone: user.phone, name: user.name, lastName: user.lastName, avatar: user.avatar } }, { status: 200 });
  } catch (error) {
    console.error('Edit profile error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
