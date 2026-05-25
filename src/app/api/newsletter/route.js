import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Newsletter from "base/models/Newsletter";

export async function POST(req) {
  try {
    await connectToDB();

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "ایمیل الزامی است" }, { status: 400 });
    }

    // بررسی اینکه آیا قبلاً ثبت شده یا باید ثبت شود
    try {
      await Newsletter.create({ email });
    } catch (error) {
      // اگر خطا مربوط به تکراری بودن ایمیل (11000) بود، اجازه می‌دهیم ادامه پیدا کند
      if (error.code !== 11000) {
        throw error;
      }
    }

    // ایجاد پاسخ اولیه
    const response = NextResponse.json({ message: "شما در خبرنامه عضو هستید" });

    // ست کردن کوکی (این کوکی به مدت یک سال معتبر خواهد بود)
    response.cookies.set("newsletter_subscribed", "true", {
      httpOnly: true, // امنیت: غیرقابل دسترسی با جاوااسکریپت کلاینت
      secure: process.env.NODE_ENV === "production", // در حالت پروداکشن حتما باید https باشد
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 365, // یک سال
      path: "/",
    });

    return response;

  } catch (error) {
    return NextResponse.json({ error: "خطایی رخ داد، دوباره تلاش کنید" }, { status: 500 });
  }
}