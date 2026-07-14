import { NextResponse } from "next/server";
import ImageKit from "imagekit";

export const runtime = "nodejs";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const IMAGEKIT_ENDPOINT = (process.env.IMAGEKIT_URL_ENDPOINT || "").replace(/\/$/, "");

/**
 * پراکسی نمایش PDF.
 *
 * چرا لازم است: مدارک/احکامِ مربیگری روی ImageKit به‌صورت private آپلود می‌شوند
 * (isPrivateFile: true در روتِ آپلود)، پس آدرسِ مستقیمشان بدون امضا قابلِ دسترسی
 * نیست. این روت یک URL امضاشده‌ی موقت (signed URL) با کلیدِ خصوصیِ ImageKit
 * می‌سازد، بایت‌های فایل را سمت سرور می‌گیرد و با Content-Type صحیح و به‌صورت
 * inline به مرورگر می‌دهد — دقیقاً همان الگویی که قبلاً برای Cloudinary
 * private_download_url استفاده می‌شد.
 */

// استخراجِ مسیرِ فایل (path) از آدرسِ کاملِ ImageKit
function parseImagekitPath(rawUrl) {
  if (!IMAGEKIT_ENDPOINT || !rawUrl.startsWith(IMAGEKIT_ENDPOINT)) return null;
  let path = rawUrl.slice(IMAGEKIT_ENDPOINT.length);
  // حذفِ کوئری‌استرینگِ احتمالی (مثلاً پارامترهای ترنسفورمِ قدیمی)
  path = path.split("?")[0];
  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}

export async function GET(req) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "پارامتر url الزامی است" }, { status: 400 });
  }

  if (!rawUrl.toLowerCase().includes(".pdf")) {
    return NextResponse.json({ error: "این روت فقط برای فایل PDF است" }, { status: 415 });
  }

  const path = parseImagekitPath(rawUrl);
  if (!path) {
    return NextResponse.json({ error: "آدرس نامعتبر است" }, { status: 400 });
  }

  try {
    // URL امضاشده و موقت (منقضی‌شونده بعد از ۱ ساعت) که محدودیتِ فایلِ private را دور می‌زند
    const signedUrl = imagekit.url({
      path,
      signed: true,
      expireSeconds: 3600,
    });

    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `خطا در دریافت فایل از سرویس ذخیره‌سازی (${upstream.status})` },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="document.pdf"',
        // کش خصوصی کوتاه‌مدت تا بازکردن مجدد سریع باشد
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("PDF PROXY ERROR:", error);
    return NextResponse.json({ error: "خطا در نمایش فایل PDF" }, { status: 500 });
  }
}
