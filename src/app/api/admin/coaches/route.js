import { NextResponse } from 'next/server'
import connectToDB from 'base/configs/db'
import User from 'base/models/User'

export async function GET(req) {
  try {
    await connectToDB()

    const { searchParams } = new URL(req.url)
    const coachId = searchParams.get('id')

    // اگر آیدی فرستاده شده بود، مشخصات مربی به همراه شاگردانش را برگردان
    if (coachId) {
      const coach = await User.findById(coachId).select('name email phone coachCode avatar')
      if (!coach) return NextResponse.json({ error: 'مربی یافت نشد' }, { status: 404 })

      const students = await User.find({ coach: coachId }).select('name email phone createdAt')

      return NextResponse.json({ coach, students })
    }

    // در غیر این صورت، لیست تمام مربیان تایید شده را برگردان
    const coaches = await User.find({ role: 'coach' })
      .select('name email phone coachCode createdAt avatar')
      .sort({ createdAt: -1 })

    return NextResponse.json({ coaches })
  } catch (error) {
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
