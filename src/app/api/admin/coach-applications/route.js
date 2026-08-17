import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import requireAdminPermission from '@/lib/requireAdminPermission';

import User from 'base/models/User';
export async function GET() {
  const { denied } = await requireAdminPermission("coaches.view");
  if (denied) return denied;

  try {
    await connectToDB();

    // واکشی تمام کاربران با وضعیت pending
    const applications = await User.find({ 'coachApplication.status': 'pending' })
      .select('name lastName email phone coachApplication createdAt');

    return NextResponse.json({ applications }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}