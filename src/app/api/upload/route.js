import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import ImageKit from "imagekit";

import { verifyToken } from "base/utils/auth";

export const runtime = "nodejs";

/**
 * این روت تا پیش از این هیچ احراز هویتی نداشت: هر کسی روی اینترنت می‌توانست
 * فایل در حسابِ ImageKit آپلود کند (و چون SVG مجاز است، عملاً HTML دلخواه روی
 * دامنهٔ ImageKit میزبانی کند). گیت عمداً «کاربرِ واردشده» است و نه «ادمین»:
 * آپلودِ مدرکِ مربیگری، رسیدِ پرداخت، پیوستِ تیکت و تصویرِ نظر همگی از همین
 * روت و توسط کاربرِ عادی انجام می‌شوند.
 */
async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// فرمت‌های مجاز: تصاویر + PDF (برای حکم/مدرک مربیگری)
const ALLOWED_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
];
const MAX_SIZE = 5 * 1024 * 1024; // ۵ مگابایت

export async function POST(req) {
  const user = await getUserFromToken();
  if (!user) {
    return NextResponse.json({ error: "برای بارگذاری فایل باید وارد حساب خود شوید" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const folderInput = formData.get("folder");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "فایلی ارسال نشده است" },
        { status: 400 }
      );
    }

    // اعتبارسنجی نوع فایل (هم تصویر و هم PDF). برخی مرورگرها type را خالی می‌فرستند،
    // در این حالت به پسوند نام فایل اتکا می‌کنیم.
    const isAllowedType =
      ALLOWED_MIME.includes(file.type) ||
      /\.(jpe?g|png|webp|svg|pdf)$/i.test(file.name || "");
    if (!isAllowedType) {
      return NextResponse.json(
        { error: "فرمت فایل نامعتبر است. فقط تصویر (JPG/PNG/WebP) یا PDF مجاز است" },
        { status: 415 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "حجم فایل نباید بیشتر از ۵ مگابایت باشد" },
        { status: 413 }
      );
    }

    // فولدر پیش‌فرض
    let folder = "product";

    if (folderInput && typeof folderInput === "string") {
      // فقط اجازه حروف، عدد، اسلش و dash
      const sanitized = folderInput.replace(/[^a-zA-Z0-9/_-]/g, "");
      if (sanitized.trim() !== "") {
        folder = sanitized;
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");

    // مدارک/احکامِ مربیگری (PDF) به‌صورت private آپلود می‌شوند تا مستقیم و
    // بدون امضا قابلِ دسترسی نباشند — نمایش‌شان از طریق روتِ پراکسیِ
    // src/app/api/files/pdf/route.js (که یک URL امضاشده‌ی موقت می‌سازد) انجام می‌شود.
    const result = await imagekit.upload({
      file: buffer,
      fileName: file.name || (isPdf ? "document.pdf" : "image"),
      folder: `/${folder}`,
      useUniqueFileName: true,
      isPrivateFile: isPdf,
    });

    // تأییدِ نهایی: اگر آدرس یا شناسه‌ی معتبر برنگشت، یعنی آپلود واقعاً کامل نشده
    if (!result || !result.url || !result.fileId) {
      console.error("UPLOAD VERIFICATION FAILED:", { fileName: file.name, result });
      return NextResponse.json(
        {
          error: `آپلودِ فایل «${file.name || "نامشخص"}» ناموفق بود: پاسخِ ImageKit فاقدِ آدرسِ معتبر بود. لطفاً دوباره تلاش کنید.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      url: result.url,
      publicId: result.fileId, // برای سازگاری با کدهای قبلی که publicId چک می‌کنند
      folder,
    });
  } catch (error) {
    // جزئیاتِ خام (پیامِ SDK، کلید، مسیر) فقط در لاگِ سرور می‌ماند و به کلاینت
    // درز نمی‌کند — همان قراردادی که src/lib/apiError.js در بقیهٔ روت‌ها دارد.
    console.error("UPLOAD ERROR:", error);
    return NextResponse.json(
      { error: "خطا در آپلود فایل؛ لطفاً دوباره تلاش کنید" },
      { status: 500 }
    );
  }
}
