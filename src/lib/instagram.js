/**
 * src/lib/instagram.js
 *
 * پوشش (wrapper) نازک روی Meta Graph API برای دایرکتِ اینستاگرام.
 * همه‌ی اعتبارنامه‌ها فقط از متغیرهای محیطی خوانده می‌شوند — هیچ مقداری
 * در کد هاردکد نشده است.
 *
 * مسیرِ مورد استفاده: «Instagram API with Instagram Login» روی graph.instagram.com
 *   - ارسال:   POST https://graph.instagram.com/<version>/<IG_ID>/messages
 *   - سرصفحه:  Authorization: Bearer <INSTAGRAM_ACCESS_TOKEN>
 *
 * محدودیتِ مهمِ پلتفرم: فقط تا ۲۴ ساعت پس از آخرین پیامِ کاربر می‌توان به او
 * پیام فرستاد (پنجره‌ی استانداردِ پیام‌رسانی). خارج از این پنجره، Send API خطا
 * برمی‌گرداند و ما آن خطا را به ادمین نمایش می‌دهیم.
 */

import crypto from "crypto";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

function getAccessToken() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN تعریف نشده است");
  return token;
}

function getBusinessAccountId() {
  const id = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!id) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID تعریف نشده است");
  return id;
}

/**
 * اعتبارسنجیِ امضای وبهوک (X-Hub-Signature-256) با APP SECRET.
 * متا بدنه‌ی خام را با HMAC-SHA256 امضا می‌کند؛ ما همان را بازمحاسبه و مقایسه
 * می‌کنیم. اگر APP_SECRET تنظیم نشده باشد، اعتبارسنجی را رد نمی‌کنیم (برای
 * تستِ محلی) ولی در پروداکشن باید تنظیم شود.
 */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  // trim تا فاصله/خطِ جدیدِ احتمالی از .env باعثِ عدمِ تطبیقِ HMAC نشود
  const appSecret = (process.env.INSTAGRAM_APP_SECRET || "").trim();

  // بدون secret نمی‌توان تأیید کرد → اجازه‌ی عبور می‌دهیم تا تستِ محلی ممکن باشد
  if (!appSecret) {
    return { ok: true, reason: "no-app-secret-skipped" };
  }
  if (!signatureHeader) {
    return { ok: false, reason: "missing-signature-header" };
  }
  if (!signatureHeader.startsWith("sha256=")) {
    return { ok: false, reason: "unexpected-format(not-sha256=)" };
  }

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  let ok = false;
  try {
    // timingSafeEqual روی طولِ نابرابر throw می‌کند؛ اول طول را چک کن
    ok =
      signatureHeader.length === expected.length &&
      crypto.timingSafeEqual(
        Buffer.from(signatureHeader),
        Buffer.from(expected)
      );
  } catch {
    ok = false;
  }

  return {
    ok,
    reason: ok ? "valid" : "hmac-mismatch",
    // فقط ۱۴ کاراکترِ اولِ هش لاگ می‌شود (نه راز، نه امضای کامل) برای مقایسه‌ی دیداری
    receivedPrefix: signatureHeader.slice(0, 14),
    expectedPrefix: expected.slice(0, 14),
  };
}

/**
 * بررسیِ handshake وریفای وبهوک (متد GET از سمت متا).
 * بازگشت: مقدارِ challenge برای پاسخ ۲۰۰، یا null اگر توکن نخواند.
 */
export function verifyWebhookChallenge(searchParams) {
  const mode = searchParams.get("hub.mode");
  const token = (searchParams.get("hub.verify_token") || "").trim();
  const challenge = searchParams.get("hub.challenge");
  const expected = (process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "").trim();

  if (mode === "subscribe" && token && token === expected) {
    return challenge;
  }
  return null;
}

async function callSendApi(payload) {
  const igId = getBusinessAccountId();
  const res = await fetch(`${GRAPH_BASE}/${igId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      `ارسال ناموفق بود (HTTP ${res.status})`;
    const err = new Error(msg);
    err.igError = data?.error || null;
    throw err;
  }

  return data; // { recipient_id, message_id }
}

/**
 * ارسال پیامِ متنی به یک کاربر اینستاگرام.
 * @param {string} igsid IGSID گیرنده
 * @param {string} text متنِ پیام
 * @returns {Promise<{message_id?:string, recipient_id?:string}>}
 */
export async function sendTextMessage(igsid, text) {
  return callSendApi({
    recipient: { id: igsid },
    message: { text },
  });
}

/**
 * ارسال پیامِ تصویری به یک کاربر اینستاگرام.
 * تصویر باید با URL عمومی در دسترس باشد (ما از Cloudinary استفاده می‌کنیم).
 * @param {string} igsid IGSID گیرنده
 * @param {string} imageUrl URL عمومیِ تصویر
 */
export async function sendImageMessage(igsid, imageUrl) {
  return callSendApi({
    recipient: { id: igsid },
    message: {
      attachment: {
        type: "image",
        payload: { url: imageUrl },
      },
    },
  });
}

/**
 * واکشیِ هویتِ خودِ حسابِ متصل (توکن) از Graph API:
 *   GET /me?fields=user_id,username,account_type
 * برای تأییدِ اینکه INSTAGRAM_BUSINESS_ACCOUNT_ID با حسابِ واقعیِ پشتِ توکن
 * یکی است و حساب از نوعِ BUSINESS است. در صورتِ خطا، {error} برمی‌گرداند.
 */
export async function fetchOwnAccount() {
  try {
    const url =
      `${GRAPH_BASE}/me` +
      `?fields=user_id,username,account_type` +
      `&access_token=${encodeURIComponent(getAccessToken())}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data?.error?.message || `HTTP ${res.status}`, raw: data };
    }
    return {
      user_id: data?.user_id ? String(data.user_id) : "",
      username: data?.username || "",
      account_type: data?.account_type || "",
    };
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}

/**
 * تلاش برای واکشیِ پروفایلِ کاربرِ اینستاگرام (نام/یوزرنیم/عکس).
 * این روی همه‌ی توکن‌ها/دسترسی‌ها در دسترس نیست؛ در صورتِ خطا، {} برمی‌گرداند
 * تا جریان اصلی (ذخیره‌ی پیام) متوقف نشود.
 */
export async function fetchUserProfile(igsid) {
  try {
    const url =
      `${GRAPH_BASE}/${igsid}` +
      `?fields=name,username,profile_pic` +
      `&access_token=${encodeURIComponent(getAccessToken())}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return {
      name: data?.name || "",
      username: data?.username || "",
      profilePic: data?.profile_pic || "",
    };
  } catch {
    return {};
  }
}
