import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import User from "base/models/User";

/**
 * احراز هویتِ ادمین برای روت‌های API.
 * نقش از طریق lookup در دیتابیس بررسی می‌شود (توکن به‌تنهایی قابل‌اعتماد نیست).
 * در صورت موفقیت سندِ کاربر (با role) و در غیر این صورت null برمی‌گرداند.
 *
 * فیلد `userId` (رشته‌ی هم‌ارزِ _id) صرفاً برای سازگاری با روت‌هایی افزوده شده
 * که پیش‌تر از پیلودِ توکن استفاده می‌کردند و برای ردپای ممیزی (reviewedBy /
 * confirmedBy / addedById) به همین نام تکیه دارند.
 */
export default async function requireAdmin() {
  const token = (await cookies()).get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  await connectToDB();
  const user = await User.findById(decoded.userId).select("role").lean();
  if (!user || user.role !== "admin") return null;
  return { ...user, userId: String(user._id) };
}

/**
 * پاسخ استانداردِ «دسترسی غیرمجاز» برای روت‌های ادمین.
 * ۴۰۱ = نشستِ معتبرِ ادمین وجود ندارد (چه توکن نباشد، چه نقش ادمین نباشد).
 */
export function unauthorized() {
  return Response.json({ message: "دسترسی غیرمجاز" }, { status: 401 });
}
