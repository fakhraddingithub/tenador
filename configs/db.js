import mongoose from "mongoose";
// ثبت همه‌ی اسکیماها به صورت side-effect تا populate دچار MissingSchemaError نشود
import "base/models/registerModels";

const url = process.env.MONGODB_URI_TENADOR;

if (!url) {
  throw new Error("MONGODB_URI_TENADOR تعریف نشده است");
}

/**
 * کش اتصال در سطح ماژول (global) — در محیط serverless مثل Vercel هر invocation
 * ماژول‌ها را دوباره ارزیابی می‌کند؛ بدون این کش، هر درخواست یک کانکشن جدید باز می‌کند
 * و خیلی زود به سقف اتصال M0 می‌خوریم (همان alert اتلس + خطای SSL/buffering timeout).
 */
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

const connectToDB = async () => {
  // اتصال آماده است → همان را برگردان (هیچ کانکشن جدیدی باز نمی‌شود)
  if (cached.conn) return cached.conn;

  // اتصال در حال برقراری است → همان promise را share کن (جلوگیری از اتصال موازی هنگام cold start)
  if (!cached.promise) {
    const opts = {
      // اگر اتصال برقرار نیست، کوئری‌ها را صف نکن و بلافاصله خطا بده
      // (به‌جای بافر کردن و timeout شدن بعد از ۱۰ ثانیه)
      bufferCommands: false,
      // سقف کانکشن‌ها در هر instance. روی M0 (سقف ۵۰۰ کانکشن) و معماری serverless
      // که هر invocation یک pool جدا می‌سازد، عمداً کوچک نگه داشته می‌شود تا
      // total = instances × maxPoolSize زیر حد کلاستر بماند.
      maxPoolSize: 5,
      minPoolSize: 0,
      // اگر کانکشن idle بماند بسته شود تا اتصال‌ها آزاد شوند
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose
      .connect(url, opts)
      .then((m) => {
        console.log("<<<🎇 MongoDB Connected Successfully 🎇>>>");
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // اتصال شکست خورد → promise را پاک کن تا دفعه بعد دوباره تلاش شود
    cached.promise = null;
    // خطا را بالا بده تا caller به‌اشتباه فکر نکند متصل است و کوئری‌ها بافر/timeout نشوند
    console.error("MongoDB Error:", err.message);
    throw err;
  }

  return cached.conn;
};

export default connectToDB;
