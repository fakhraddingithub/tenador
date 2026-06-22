import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * پراکسی نمایش PDF.
 *
 * چرا لازم است: اکانت Cloudinary به‌صورت پیش‌فرض «تحویل فایل‌های PDF» را روی CDN
 * مسدود می‌کند (پاسخ 401 با x-cld-error: "deny or ACL failure")، بنابراین لینک مستقیم
 * مدرک، خطای «Failed to load PDF document» می‌دهد.
 * این روت با private_download_url (اندپوینت دانلودِ احرازهویت‌شده‌ی Cloudinary که با
 * api_secret امضا می‌شود) بایت‌های فایل را سمت سرور می‌گیرد و با Content-Type صحیح و
 * به‌صورت inline به مرورگر می‌دهد. هم برای فایل‌های قدیمی و هم جدید کار می‌کند و نیازی
 * به تغییر تنظیمات داشبورد Cloudinary ندارد.
 */

// استخراج public_id / resource_type / format از secure_url کلودیناری
function parseCloudinaryUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.hostname !== "res.cloudinary.com") return null;

  const parts = u.pathname.split("/").filter(Boolean);
  // الگو: /<cloud>/<resourceType>/<deliveryType>/[transforms]/[vNNN]/<public_id>.<ext>
  if (parts.length < 4) return null;

  const cloud = parts[0];
  const resourceType = parts[1]; // image | raw | video
  const deliveryType = parts[2]; // upload | authenticated | private ...

  // فقط cloud خودمان (جلوگیری از SSRF و امضای public_id غیرمجاز)
  if (cloud !== process.env.CLOUDINARY_CLOUD_NAME) return null;

  // باقی‌مانده: سگمنت نسخه (vNNN) و سگمنت‌های ترنسفورم (شامل , یا =) را حذف کن
  const rest = parts
    .slice(3)
    .filter((seg) => !/^v\d+$/.test(seg) && !/[,=]/.test(seg));
  if (rest.length === 0) return null;

  const last = rest[rest.length - 1];
  const dot = last.lastIndexOf(".");
  const format = dot >= 0 ? last.slice(dot + 1).toLowerCase() : "";
  rest[rest.length - 1] = dot >= 0 ? last.slice(0, dot) : last;
  const publicId = rest.join("/");

  return { resourceType, deliveryType, publicId, format };
}

export async function GET(req) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "پارامتر url الزامی است" }, { status: 400 });
  }

  const parsed = parseCloudinaryUrl(rawUrl);
  if (!parsed) {
    return NextResponse.json({ error: "آدرس نامعتبر است" }, { status: 400 });
  }
  // این روت فقط برای PDF است
  if (parsed.format !== "pdf") {
    return NextResponse.json({ error: "این روت فقط برای فایل PDF است" }, { status: 415 });
  }

  try {
    // URL دانلودِ احرازهویت‌شده و امضاشده (سمت سرور) که محدودیت تحویل CDN را دور می‌زند
    const signedUrl = cloudinary.utils.private_download_url(parsed.publicId, "pdf", {
      resource_type: parsed.resourceType,
      type: parsed.deliveryType,
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
        "Content-Disposition": "inline; filename=\"document.pdf\"",
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
