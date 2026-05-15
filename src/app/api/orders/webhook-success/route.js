import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db';
import User from 'base/models/User';

export async function POST(req) {
  try {
    await connectToDB();
    
    // دریافت اطلاعات سفارش نهایی شده از کنترلر فاکتورها یا وب‌هوک بانک
    const { userId, totalAmount } = await req.json();

    const buyer = await User.findById(userId);
    // اگر خریدار وجود نداشت یا مربی نداشت، نیازی به محاسبه پورسانت نیست
    if (!buyer || !buyer.coach) {
      return NextResponse.json({ message: 'سفارش ثبت شد (فاقد مربی معرف)' }, { status: 200 });
    }

    // محاسبه درصد سود مربی (به عنوان مثال ۵ درصد از مبلغ کل خرید)
    const commissionPercent = 5;
    const earnedAmount = (totalAmount * commissionPercent) / 100;

    // افزایش آنی و کاملاً امن موجودی کیف پول مربی در دیتابیس
    await User.findByIdAndUpdate(buyer.coach, {
      $inc: { walletBalance: earnedAmount }
    });

    return NextResponse.json({ 
      message: 'پورسانت خرید شاگرد با موفقیت به کیف پول مربی واریز شد',
      commission: earnedAmount
    }, { status: 200 });

  } catch (error) {
    console.error('Webhook coach reward error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}