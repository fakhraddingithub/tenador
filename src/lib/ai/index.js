/**
 * لایه‌ی مشترکِ AI — تنها نقطه‌ای که بقیه‌ی کد با مدل‌ها حرف می‌زند.
 *
 * قراردادِ provider (هر فایل در همین پوشه):
 *   { name, model, configured, generate(request) → { text, finishReason, tokens } }
 *   request = { system?, prompt, json?, schema?, maxTokens?, temperature?, timeoutMs?, signal? }
 *   finishReason ∈ 'stop' | 'length' | 'filtered' | 'other'
 *   خطاها همیشه AiError با پیامِ فارسیِ امن (errors.js).
 *
 * `schema` (اختیاری) اسکیمای JSON است؛ هر provider شکلِ بومیِ خودش را می‌سازد.
 * provider با AI_PROVIDER انتخاب می‌شود (پیش‌فرض: gemini). منطقِ کسب‌وکار
 * (پرامپت، اعتبارسنجی، دیتابیس) هیچ‌وقت به provider وابسته نیست.
 */
import { AiError } from './errors.js';
import { createGeminiProvider } from './gemini.js';
import { createOpenAiProvider } from './openai.js';

export { AiError };

const PROVIDERS = { gemini: createGeminiProvider, openai: createOpenAiProvider };

export function getAiProvider({ env = process.env, fetchImpl } = {}) {
  const name = (env.AI_PROVIDER?.trim() || 'gemini').toLowerCase();
  const create = PROVIDERS[name];
  if (!create) throw new AiError(`ارائه‌دهنده‌ی هوش مصنوعیِ «${name}» پشتیبانی نمی‌شود (AI_PROVIDER).`, 503, 'AI_UNKNOWN_PROVIDER');
  return create({ env, ...(fetchImpl ? { fetchImpl } : {}) });
}

/** وضعیتِ قابل‌نمایش (بدونِ کلید). */
export function getAiConfig(options) {
  try {
    const { name, model, configured } = getAiProvider(options);
    return { provider: name, model, configured };
  } catch {
    return { provider: null, model: null, configured: false };
  }
}

/** متنِ کاملِ پاسخ؛ پاسخِ نیمه‌کاره یا خالی خطاست، نه داده. */
export async function generate(request, options) {
  const provider = getAiProvider(options);
  const result = await provider.generate(request);
  if (result.finishReason !== 'stop') {
    throw new AiError(
      result.finishReason === 'length'
        ? 'پاسخ مدل به سقفِ طول رسید و کامل نشد.'
        : 'پاسخ مدل کامل نشد یا توسط فیلترِ محتوا متوقف شد.',
      502, 'AI_INCOMPLETE',
    );
  }
  if (!result.text.trim()) throw new AiError('مدل پاسخی برنگرداند؛ دوباره تلاش کنید.', 502, 'AI_EMPTY');
  return { ...result, provider: provider.name, model: provider.model };
}

/** مثلِ generate با json: true، به‌علاوه‌ی parse. حصارِ ```json``` پذیرفته می‌شود. */
export async function generateJson(request, options) {
  const result = await generate({ ...request, json: true }, options);
  const source = result.text.trim().replace(/^```[a-z]*\s*\n?([\s\S]*?)\n?\s*```$/i, '$1');
  try {
    return { ...result, value: JSON.parse(source) };
  } catch {
    throw new AiError('پاسخ مدل JSON معتبر نبود؛ دوباره تلاش کنید.', 502, 'AI_INVALID_JSON');
  }
}
