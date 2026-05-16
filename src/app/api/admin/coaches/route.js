import { NextResponse } from 'next/server'
import  connectToDB  from 'base/configs/db' // تابع اتصال به دیتابیس خود را اینجا ایمپورت کنید
import User from 'base/models/User' // مدل کاربر خود را اینجا ایمپورت کنید

export async function GET(req) {
  try {
    await connectToDB()
    
    const { searchParams } = new URL(req.url)
    const coachId = searchParams.get('id')

    // اگر آیدی فرستاده شده بود، مشخصات مربی به همراه شاگردانش را برگردان
    if (coachId) {
      // پیدا کردن مربی
      const coach = await User.findById(coachId).select('name email phone coachCode avatar')
      if (!coach) return NextResponse.json({ error: 'مربی یافت نشد' }, { status: 404 })

      const students = await User.find({ coach: coachId }).select('name email phone createdAt')
      
      // دیتای ماک نمونه جهت تست تا زمان متصل کردن مدل اصلی:
    //   const mockStudents = [
    //     { _id: 's1', name: 'امیرحسین رضایی', email: 'amir@test.com', phone: '09121112233', createdAt: '1402/11/05' },
    //     { _id: 's2', name: 'نیلوفر خسروی', email: 'nilo@test.com', phone: '09354445566', createdAt: '1403/01/12' }
    //   ]
    //   return NextResponse.json({ students: mockStudents })
    }

    // در غیر این صورت، لیست تمام مربیان تایید شده را برگردان
    const coaches = await User.find({ isCoach: true }).select('name email phone coachCode createdAt avatar')
    
    // const mockCoaches = [
    //   { _id: 'c1', name: 'سارا احمدی', email: 'sara@coach.com', phone: '09112223344', coachCode: 'TR-4921', createdAt: '1401/05/20' },
    //   { _id: 'c2', name: 'حسین حسینی', email: 'hossein@coach.com', phone: '09301112233', coachCode: 'TR-8812', createdAt: '1403/02/10' }
    // ]

    return NextResponse.json({ coaches })
  } catch (error) {
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}