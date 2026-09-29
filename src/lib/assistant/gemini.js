import { fetch, ProxyAgent } from 'undici';
import { AssistantError } from './validation.js';

let proxyAgent;
let proxyUrl;
export function getAssistantConfig() {
  return { configured: !!process.env.GEMINI_API_KEY?.trim(), enabled: process.env.ADMIN_ASSISTANT_ENABLED !== 'false', model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest' };
}

export async function generateJson({ system, input, schema, maxTokens = 1000, signal }) {
  const config = getAssistantConfig();
  if (!config.enabled || !config.configured) throw new AssistantError('دستیار هنوز روی سرور فعال نشده است.', 503);
  if (!/^[a-zA-Z0-9._-]+$/.test(config.model)) throw new AssistantError('نام مدل در تنظیمات سرور نامعتبر است.', 503);
  // Optional, scoped to this service only. Never change the application's global dispatcher.
  const proxy = process.env.GEMINI_PROXY_URL;
  if (proxy && proxy !== proxyUrl) {
    if (proxyAgent) void proxyAgent.close();
    proxyAgent = new ProxyAgent(proxy);
    proxyUrl = proxy;
  }
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY.trim() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: maxTokens, temperature: 0.1 },
      }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
      ...(proxy ? { dispatcher: proxyAgent } : {}),
    });
  } catch {
    throw new AssistantError('اتصال به Gemini برقرار نشد یا زمان پاسخ تمام شد. تنظیمات شبکهٔ سرور را بررسی کنید.', 503);
  }
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 429) throw new AssistantError('سهمیه یا محدودیت درخواست Gemini پر شده است؛ کمی بعد دوباره تلاش کنید.', 429);
    if ([400, 401, 403, 404].includes(response.status)) throw new AssistantError('کلید، مدل یا دسترسی منطقه‌ای Gemini را در تنظیمات سرور بررسی کنید.', 503);
    throw new AssistantError('سرویس هوش مصنوعی موقتاً در دسترس نیست.', 502);
  }
  const result = await response.json();
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new AssistantError('پاسخ مدل کامل نشد؛ سؤال را کوتاه‌تر یا دقیق‌تر مطرح کنید.', 502);
  const raw = candidate.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('');
  try {
    return { value: JSON.parse(raw), tokens: result.usageMetadata?.totalTokenCount || 0 };
  } catch { throw new AssistantError('پاسخ مدل قابل پردازش نبود؛ دوباره تلاش کنید.', 502); }
}
