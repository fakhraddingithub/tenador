import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import ContactMessage from "base/models/ContactMessage";
import { verifyToken } from "base/utils/auth";

export const runtime = "nodejs";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toEnDigits = (s = "") =>
  String(s).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// شناسایی اختیاریِ کاربرِ واردشده (فرم برای ناشناس هم کار می‌کند)
async function getOptionalUserId() {
  try {
    const token = (await cookies()).get("accessToken")?.value;
    if (!token) return null;
    const decoded = verifyToken(token);
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const company = String(body.company || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = toEnDigits(body.phone || "").trim();
    const message = String(body.message || "").trim();
    const attachmentUrl = String(body.attachmentUrl || "").trim();
    const attachmentType = String(body.attachmentType || "").trim();

    // اعتبارسنجی سمت سرور (هم‌تراز با کلاینت)
    if (!firstName) return bad("نام الزامی است");
    if (!lastName) return bad("نام خانوادگی الزامی است");
    if (!email || !EMAIL_RE.test(email)) return bad("ایمیل معتبر نیست");
    if (!/^\d{10,15}$/.test(phone))
      return bad("شماره تلفن باید فقط شامل ارقام باشد");
    if (message.length < 10) return bad("متن پیام باید حداقل ۱۰ نویسه باشد");

    await connectToDB();
    const userId = await getOptionalUserId();

    await ContactMessage.create({
      firstName,
      lastName,
      company,
      email,
      phone,
      message,
      attachmentUrl,
      attachmentType: ["image", "pdf"].includes(attachmentType)
        ? attachmentType
        : "",
      status: "new",
      user: userId || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("CONTACT SUBMIT ERROR:", err);
    return NextResponse.json(
      { error: "خطا در ارسال پیام. لطفاً دوباره تلاش کنید" },
      { status: 500 }
    );
  }
}

function bad(error) {
  return NextResponse.json({ error }, { status: 400 });
}
