// base/models/UserNotificationState.js
import mongoose from "mongoose";

/**
 * UserNotificationState — وضعیتِ خواندنِ اعلان‌های کاربر، به‌صورت «watermark».
 *
 * برای هر کاربر فقط یک سند کوچک نگه می‌داریم که آخرین زمانی که کاربر همه‌ی
 * اعلان‌هایش را «خوانده» علامت زده در آن ذخیره شده است (lastReadAt).
 *
 * چرا watermark و نه آرایه‌ی readUserIds روی اعلان یا کالکشن join؟
 *  - آرایه روی اعلان: برای ارسال «به همه» می‌تواند ده‌ها هزار آیدی در یک سند
 *    جمع شود (سقف ۱۶ مگابایت مونگو + قفلِ نوشتن در هر مارک).
 *  - کالکشن join (یک ردیف به‌ازای هر کاربر×اعلان): N×M ردیف و anti-join برای شمارش.
 *  - watermark: یک سندِ ریز per-user؛ «خواندنِ همه» = یک upsert؛ شمارشِ نخوانده =
 *    یک countDocuments روی UserNotification با createdAt > lastReadAt. O(1) و دقیق،
 *    چون اعلان‌ها تغییرناپذیر و بر اساس createdAt مرتب‌اند و فقط «همه را خوانده» داریم.
 */

const UserNotificationStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    // همه‌ی اعلان‌های ساخته‌شده تا این لحظه برای این کاربر «خوانده‌شده» محسوب می‌شوند
    lastReadAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.UserNotificationState ||
  mongoose.model("UserNotificationState", UserNotificationStateSchema);
