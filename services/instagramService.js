/**
 * services/instagramService.js
 *
 * منطقِ مشترکِ پشتیبانیِ دایرکتِ اینستاگرام: ذخیره‌ی پیامِ ورودی (از وبهوک)،
 * ثبتِ پیامِ خروجیِ ادمین، فهرستِ گفتگوها، واکشیِ ترِد و علامتِ خوانده‌شدن.
 *
 * همه‌ی هندلرها باید پیش از فراخوانی، connectToDB را صدا زده باشند.
 */

import "base/models/registerModels";
import InstagramConversation from "base/models/InstagramConversation";
import InstagramMessage from "base/models/InstagramMessage";
import { fetchUserProfile } from "@/lib/instagram";

// پنجره‌ی مجازِ پاسخ‌دهی (۲۴ ساعت) بر اساس آخرین پیامِ ورودیِ کاربر
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * یافتن یا ساختنِ گفتگو برای یک IGSID. در صورت ساختِ تازه، تلاش می‌شود
 * پروفایلِ کاربر از Graph API واکشی شود (بی‌صدا در صورت شکست).
 */
async function findOrCreateConversation(igsid) {
  let convo = await InstagramConversation.findOne({ igsid });
  if (convo) return convo;

  const profile = await fetchUserProfile(igsid);
  convo = await InstagramConversation.create({
    igsid,
    name: profile.name || "",
    username: profile.username || "",
    profilePic: profile.profilePic || "",
  });
  return convo;
}

/**
 * ذخیره‌ی یک پیامِ ورودی از وبهوک.
 * - گفتگو را در صورت نبود می‌سازد
 * - dedupe بر اساس mid (وبهوک‌های تکراریِ متا)
 * - شمارشِ نخوانده و متادیتای ترِد را به‌روزرسانی می‌کند
 *
 * @returns {Promise<{created:boolean}>}
 */
export async function ingestIncomingMessage({ igsid, mid, text, imageUrl, timestamp }) {
  if (!igsid) return { created: false };

  // dedupe: اگر این mid قبلاً ذخیره شده، کاری نکن
  if (mid) {
    const exists = await InstagramMessage.findOne({ mid }).select("_id").lean();
    if (exists) return { created: false };
  }

  const convo = await findOrCreateConversation(igsid);
  const when = timestamp ? new Date(timestamp) : new Date();

  await InstagramMessage.create({
    conversation: convo._id,
    igsid,
    sender: "user",
    text: text || "",
    imageUrl: imageUrl || "",
    mid: mid || null,
    status: "received",
    read: false,
    createdAt: when,
  });

  const preview = text || (imageUrl ? "📷 تصویر" : "");
  await InstagramConversation.updateOne(
    { _id: convo._id },
    {
      $set: {
        lastMessageText: preview,
        lastMessageAt: when,
        lastMessageFrom: "user",
        lastInboundAt: when,
      },
      $inc: { unreadCount: 1 },
    }
  );

  return { created: true };
}

/**
 * ثبتِ یک پیامِ خروجیِ ادمین پس از ارسالِ موفق (یا ناموفق) با Send API.
 */
export async function recordOutgoingMessage({
  igsid,
  text = "",
  imageUrl = "",
  mid = null,
  status = "sent",
  error = "",
}) {
  const convo = await findOrCreateConversation(igsid);
  const now = new Date();

  const msg = await InstagramMessage.create({
    conversation: convo._id,
    igsid,
    sender: "admin",
    text,
    imageUrl,
    mid: mid || null,
    status,
    error,
    read: true,
  });

  // فقط در صورتِ موفقیت، پیش‌نمایشِ ترِد را با پیامِ ادمین به‌روز کن
  if (status === "sent") {
    const preview = text || (imageUrl ? "📷 تصویر" : "");
    await InstagramConversation.updateOne(
      { _id: convo._id },
      {
        $set: {
          lastMessageText: preview,
          lastMessageAt: now,
          lastMessageFrom: "admin",
        },
      }
    );
  }

  return msg;
}

/**
 * فهرستِ گفتگوها، جدیدترین فعالیت اول.
 */
export async function listConversations({ limit = 50 } = {}) {
  const items = await InstagramConversation.find({})
    .sort({ lastMessageAt: -1 })
    .limit(Math.min(Number(limit) || 50, 200))
    .lean();

  return items.map((c) => ({
    ...c,
    withinReplyWindow: c.lastInboundAt
      ? Date.now() - new Date(c.lastInboundAt).getTime() < REPLY_WINDOW_MS
      : false,
  }));
}

/**
 * واکشیِ پیام‌های یک گفتگو به‌ترتیبِ زمانی.
 */
export async function getThread(conversationId, { limit = 200 } = {}) {
  const convo = await InstagramConversation.findById(conversationId).lean();
  if (!convo) return null;

  const messages = await InstagramMessage.find({ conversation: conversationId })
    .sort({ createdAt: 1 })
    .limit(Math.min(Number(limit) || 200, 500))
    .lean();

  return {
    conversation: {
      ...convo,
      withinReplyWindow: convo.lastInboundAt
        ? Date.now() - new Date(convo.lastInboundAt).getTime() < REPLY_WINDOW_MS
        : false,
    },
    messages,
  };
}

/**
 * علامت‌گذاریِ همه‌ی پیام‌های ورودیِ یک گفتگو به‌عنوان خوانده‌شده و صفرکردنِ شمارش.
 */
export async function markConversationRead(conversationId) {
  await InstagramMessage.updateMany(
    { conversation: conversationId, sender: "user", read: false },
    { $set: { read: true } }
  );
  await InstagramConversation.updateOne(
    { _id: conversationId },
    { $set: { unreadCount: 0 } }
  );
}

/**
 * مجموعِ پیام‌های خوانده‌نشده در همه‌ی گفتگوها (برای بَجِ سایدبار/سرصفحه).
 */
export async function getTotalUnread() {
  const rows = await InstagramConversation.aggregate([
    { $group: { _id: null, total: { $sum: "$unreadCount" } } },
  ]);
  return rows?.[0]?.total || 0;
}
