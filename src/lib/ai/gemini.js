/**
 * Google Gemini — پیاده‌سازیِ provider برای لایه‌ی مشترکِ AI (src/lib/ai/index.js).
 * همان یکپارچه‌سازی‌ای که دستیارِ ادمین از ابتدا داشت (GEMINI_API_KEY،
 * GEMINI_MODEL، GEMINI_PROXY_URL)؛ حالا یک‌جا و برای همه‌ی مصرف‌کننده‌ها.
 */
import { fetch as undiciFetch, ProxyAgent } from 'undici';
import { AiError, mapSchemaTypes, readProviderError, transportError } from './errors.js';

const FINISH = { STOP: 'stop', MAX_TOKENS: 'length', SAFETY: 'filtered', RECITATION: 'filtered', PROHIBITED_CONTENT: 'filtered', BLOCKLIST: 'filtered', SPII: 'filtered' };

let proxyAgent;
let proxyUrl;
function proxyDispatcher(proxy) {
  if (!proxy) return undefined;
  // Scoped to this provider only. Never change the application's global dispatcher.
  if (proxy !== proxyUrl) {
    if (proxyAgent) void proxyAgent.close();
    proxyAgent = new ProxyAgent(proxy);
    proxyUrl = proxy;
  }
  return proxyAgent;
}

export function createGeminiProvider({ env = process.env, fetchImpl = undiciFetch } = {}) {
  const key = env.GEMINI_API_KEY?.trim();
  const model = env.GEMINI_MODEL?.trim() || 'gemini-flash-lite-latest';
  return {
    name: 'gemini',
    model,
    configured: !!key,
    async generate({ system, prompt, json = true, schema, maxTokens = 1000, temperature = 0.1, timeoutMs = 25000, signal }) {
      if (!key) throw new AiError('کلید Gemini روی سرور تنظیم نشده است (GEMINI_API_KEY).', 503, 'AI_NOT_CONFIGURED');
      if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new AiError('نام مدل در تنظیمات سرور نامعتبر است.', 503, 'AI_NOT_CONFIGURED');
      const dispatcher = proxyDispatcher(env.GEMINI_PROXY_URL);
      const generationConfig = { maxOutputTokens: maxTokens, temperature };
      if (json) generationConfig.responseMimeType = 'application/json';
      if (json && schema) generationConfig.responseSchema = mapSchemaTypes(schema, (t) => t.toUpperCase());

      let response;
      try {
        response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig,
          }),
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
          ...(dispatcher ? { dispatcher } : {}),
        });
      } catch (error) {
        throw transportError(error, 'Gemini');
      }
      if (!response.ok) {
        const error = classifyGeminiError(response.status, await readProviderError(response));
        console.warn('[ai] Gemini rejected request', { code: error.code, httpStatus: response.status, model });
        throw error;
      }
      const result = await response.json().catch(() => null);
      const candidate = result?.candidates?.[0];
      return {
        text: (candidate?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join(''),
        finishReason: FINISH[candidate?.finishReason] || 'other',
        tokens: result?.usageMetadata?.totalTokenCount || 0,
      };
    },
  };
}

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
    code = 'REQUEST_SCHEMA'; explanation = 'Gemini ساختار درخواست یا قالب پاسخِ خواسته‌شده را نپذیرفته است. این خطا به بررسی سازگاری کد با مدل نیاز دارد؛ تعویض کلید لزوماً آن را رفع نمی‌کند.';
  } else if (status === 400) {
    code = 'BAD_REQUEST'; explanation = 'Gemini درخواست را نامعتبر تشخیص داد (400). تنظیمات درخواست و سازگاری مدل باید بررسی شود.';
  } else {
    code = 'SERVICE_UNAVAILABLE'; explanation = 'سرویس Gemini موقتاً در دسترس نیست؛ کمی بعد دوباره تلاش کنید.';
  }
  const error = new AiError(`${explanation} [GEMINI_${code}]`, status === 429 ? 429 : 503, `GEMINI_${code}`);
  error.providerStatus = status;
  return error;
}
