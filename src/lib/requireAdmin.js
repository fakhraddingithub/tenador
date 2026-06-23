import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import User from "base/models/User";

/**
 * احراز هویتِ ادمین برای روت‌های API.
 * نقش از طریق lookup در دیتابیس بررسی می‌شود (توکن به‌تنهایی قابل‌اعتماد نیست).
 * در صورت موفقیت سندِ کاربر (با role) و در غیر این صورت null برمی‌گرداند.
 */
export default async function requireAdmin() {
  const token = (await cookies()).get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  await connectToDB();
  const user = await User.findById(decoded.userId).select("role").lean();
  if (!user || user.role !== "admin") return null;
  return user;
}
