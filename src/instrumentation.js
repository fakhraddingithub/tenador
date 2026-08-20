/**
 * src/instrumentation.js
 *
 * `register()` را Next پیش از هر کدِ دیگری در یک نمونه‌ی سرور اجرا می‌کند.
 *
 * تنها کاری که اینجا انجام می‌شود نشاندنِ پلاگینِ ممیزیِ Mongoose است، و دلیلش
 * ترتیب است: `mongoose.plugin()` فقط روی اسکیماهایی اثر دارد که *بعد از* آن
 * کامپایل شوند. models/registerModels.js این تضمین را برای هر مسیری که از
 * connectToDB شروع شود می‌دهد، ولی روتی که یک مدل را مستقیم و پیش از
 * configs/db ایمپورت کند از آن جلو می‌زند. اینجا آن حفره بسته می‌شود.
 */

export async function register() {
  // در رانتایمِ edge نه mongoose هست و نه async_hooks.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { registerAuditPlugin } = await import("../models/auditPlugin.js");
  registerAuditPlugin();
}
