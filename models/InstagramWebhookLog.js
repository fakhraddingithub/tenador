import mongoose from "mongoose";

/**
 * InstagramWebhookLog — لاگِ تشخیصیِ هر فراخوانیِ وبهوک (موقت، برای دیباگ).
 *
 * هدف: بدون نیاز به دیدنِ لاگ‌های سرور، از داخلِ مرورگر ببینیم که آیا متا
 * واقعاً endpoint را صدا زده، امضا درست بوده، و چه ساختاری فرستاده است.
 *
 * هر درخواست (حتی ردشده به‌خاطرِ امضا) یک سند می‌سازد. با TTL پس از ۳ روز
 * خودکار پاک می‌شود تا کالکشن بزرگ نشود. پس از حلِ مشکل می‌توان این مدل و
 * endpointِ /api/admin/instagram/debug را حذف کرد.
 */

const InstagramWebhookLogSchema = new mongoose.Schema(
  {
    receivedAt: { type: Date, default: () => Date.now() },
    method: { type: String, default: "POST" },
    signaturePresent: { type: Boolean, default: false },
    signatureResult: { type: String, default: "" }, // PASS | FAIL | SKIPPED
    signatureReason: { type: String, default: "" },
    appSecretLoaded: { type: Boolean, default: false },
    objectType: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    stored: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    note: { type: String, default: "" },
    // ساختارِ امن (بدونِ متنِ پیام)؛ و یک پیش‌نمایشِ کوتاهِ بدنه برای دیباگ
    shape: { type: mongoose.Schema.Types.Mixed, default: null },
    rawPreview: { type: String, default: "" },
  },
  { timestamps: false }
);

// پاکسازیِ خودکار پس از ۳ روز
InstagramWebhookLogSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 259200 });

export default mongoose.models.InstagramWebhookLog ||
  mongoose.model("InstagramWebhookLog", InstagramWebhookLogSchema);
