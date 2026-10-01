import { AssistantError } from './validation.js';

// Never forward provider messages: they can echo credentials, prompts or schema contents.
export function classifyGeminiError(status, payload) {
  const message = typeof payload?.error?.message === 'string' ? payload.error.message : '';
  const reasons = Array.isArray(payload?.error?.details) ? payload.error.details.map(d => typeof d?.reason === 'string' ? d.reason : '').join(' ') : '';
  const hint = `${message} ${reasons}`;
  let code, explanation;
  if (/leaked|compromised/i.test(hint)) {
    code = 'KEY_BLOCKED'; explanation = 'گوگل کلید Gemini را به‌دلیل افشاشدن مسدود کرده است. کلید جدید را در GEMINI_API_KEY محیط Production قرار دهید و دوباره Deploy کنید.';
  } else if (/API_KEY_INVALID|API_KEY_EXPIRED|api key (?:not valid|is invalid|expired)|invalid api key/i.test(hint) || status === 401) {
    code = 'KEY_INVALID'; explanation = 'کلید Gemini نامعتبر، منقضی یا پذیرفته‌نشده است. مقدار GEMINI_API_KEY در محیط Production و دیپلوی فعال را بررسی کنید.';
  } else if (/location.*not supported|unsupported.*location|not available.*(?:country|region)|region.*not supported/i.test(hint)) {
    code = 'REGION_UNSUPPORTED'; explanation = 'Gemini موقعیت سرور ارسال‌کنندهٔ درخواست را پشتیبانی نمی‌کند. منطقهٔ اجرای سرور را بررسی کنید.';
  } else if (status === 429) {
    code = 'QUOTA'; explanation = 'سهمیه یا محدودیت درخواست Gemini پر شده است؛ کمی بعد دوباره تلاش کنید.';
  } else if (status === 404) {
    code = 'MODEL_UNAVAILABLE'; explanation = 'مدل تنظیم‌شدهٔ Gemini پیدا نشد یا برای این کلید در دسترس نیست. مقدار GEMINI_MODEL روی سرور را بررسی کنید.';
  } else if (/billing|prepay|payment required/i.test(hint) || status === 402) {
    code = 'BILLING'; explanation = 'Gemini برای این پروژه یا مدل، فعال‌سازی صورتحساب یا اعتبار لازم را درخواست کرده است. تنظیمات پروژه در AI Studio را بررسی کنید.';
  } else if (/SERVICE_DISABLED|API_KEY_SERVICE_BLOCKED|accessNotConfigured|has not been used.*project|service.*disabled/i.test(hint)) {
    code = 'API_DISABLED'; explanation = 'دسترسی پروژه یا کلید به Gemini API فعال نیست یا محدود شده است. دسترسی Generative Language API را بررسی کنید.';
  } else if (status === 403) {
    code = payload?.error ? 'PERMISSION_DENIED' : 'ACCESS_DENIED';
    explanation = payload?.error ? 'گوگل دسترسی این کلید یا پروژه به Gemini را رد کرده است. محدودیت‌های کلید و دسترسی پروژه را در AI Studio بررسی کنید.' : 'سرور Google درخواست را با خطای 403 رد کرده است؛ پاسخ استاندارد API دریافت نشد. دسترسی شبکه و منطقهٔ سرور باید بررسی شود.';
  } else if (status === 400 && /schema|generation.?config|invalid json payload|unknown name|too many states/i.test(hint)) {
    code = 'REQUEST_SCHEMA'; explanation = 'Gemini ساختار درخواست یا قالب پاسخ دستیار را نپذیرفته است. این خطا به بررسی سازگاری کد دستیار با مدل نیاز دارد؛ تعویض کلید لزوماً آن را رفع نمی‌کند.';
  } else if (status === 400) {
    code = 'BAD_REQUEST'; explanation = 'Gemini درخواست دستیار را نامعتبر تشخیص داد (400). تنظیمات درخواست و سازگاری مدل باید بررسی شود.';
  } else {
    code = 'SERVICE_UNAVAILABLE'; explanation = 'سرویس Gemini موقتاً در دسترس نیست؛ کمی بعد دوباره تلاش کنید.';
  }
  const error = new AssistantError(`${explanation} [GEMINI_${code}]`, status === 429 ? 429 : 503);
  error.code = `GEMINI_${code}`;
  error.providerStatus = status;
  return error;
}

export async function readProviderError(response) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); return null; }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return null; }
  finally { reader.releaseLock(); }
}
