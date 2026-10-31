/**
 * خطای استانداردِ لایه‌ی AI — مستقل از provider.
 *
 * `message` همیشه فارسی و امن برای نمایش است: پیامِ خامِ provider هرگز
 * فوروارد نمی‌شود (ممکن است کلید، پرامپت یا اسکیما را بازتاب دهد).
 *
 * کدهای مشترک:
 *   AI_NOT_CONFIGURED · AI_UNKNOWN_PROVIDER · AI_TIMEOUT · AI_UNREACHABLE
 *   AI_INCOMPLETE (پاسخ نیمه‌کاره / max tokens / فیلتر) · AI_EMPTY · AI_INVALID_JSON
 *   <PROVIDER>_<REASON> برای ردِ درخواست از سمتِ provider (مثلاً GEMINI_QUOTA)
 */
export class AiError extends Error {
  constructor(message, status = 502, code = 'AI_ERROR') {
    super(message);
    this.name = 'AiError';
    this.status = status;
    this.code = code;
  }
}

/** بدنه‌ی خطای provider را با سقفِ حجم می‌خواند؛ HTML یا بدنه‌ی بزرگ → null. */
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

/** شکستِ fetch (شبکه، timeout، لغوِ درخواست) → AiError. */
export function transportError(error, provider) {
  if (error?.name === 'TimeoutError') {
    return new AiError(`زمانِ پاسخِ ${provider} تمام شد؛ کمی بعد دوباره تلاش کنید.`, 504, 'AI_TIMEOUT');
  }
  return new AiError(`اتصال به ${provider} برقرار نشد یا زمان پاسخ تمام شد. تنظیمات شبکهٔ سرور را بررسی کنید.`, 503, 'AI_UNREACHABLE');
}

/** اسکیمای JSON را برای provider بازنویسی می‌کند: فقط حالتِ حروفِ `type` فرق دارد. */
export function mapSchemaTypes(schema, transform) {
  if (Array.isArray(schema)) return schema.map((s) => mapSchemaTypes(s, transform));
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(Object.entries(schema).map(([key, value]) => [
    key,
    key === 'type' && typeof value === 'string' ? transform(value)
      : key === 'properties' && value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapSchemaTypes(v, transform)]))
        : mapSchemaTypes(value, transform),
  ]));
}
