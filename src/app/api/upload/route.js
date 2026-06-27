import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          // auto تا هم تصویر و هم PDF به‌درستی شناسایی و ذخیره شود
          resource_type: "auto",
          allowed_formats: ["jpg", "jpeg", "png", "webp", "svg", "pdf"],
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(buffer);
    });

    // تأییدِ موفقیتِ واقعیِ آپلود: گاهی Cloudinary بدونِ پرتابِ خطا پاسخی برمی‌گرداند
    // که secure_url یا public_id ندارد (آپلودِ ناقص). در این حالت فایل واقعاً روی
    // Cloudinary ذخیره نشده؛ پس نباید آدرسِ ناقص را با وضعیتِ ۲۰۰ برگردانیم، وگرنه
    // یک URL خراب در دیتابیس ذخیره می‌شود در حالی که تصویری پشتِ آن وجود ندارد.
    if (!result || !result.secure_url || !result.public_id) {
      console.error("UPLOAD VERIFICATION FAILED:", { fileName: file.name, result });
      return NextResponse.json(
        {
          error: `آپلودِ فایل «${file.name || "نامشخص"}» ناموفق بود: پاسخِ Cloudinary فاقدِ آدرسِ معتبر بود. لطفاً دوباره تلاش کنید.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      folder,
    });

  } catch (error) {
    console.error("UPLOAD ERROR:", error);

    // پیام خطای Cloudinary (مثلاً فرمت غیرمجاز) در صورت وجود به کاربر برگردانده می‌شود
    const cloudinaryMsg = error?.message;
    return NextResponse.json(
      { error: cloudinaryMsg ? `خطا در آپلود فایل: ${cloudinaryMsg}` : "خطا در آپلود فایل" },
      { status: 500 }
    );
  }
}
