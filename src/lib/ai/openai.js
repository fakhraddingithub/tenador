/**
 * OpenAI (Chat Completions) — provider برای لایه‌ی مشترکِ AI. با AI_PROVIDER=openai
 * فعال می‌شود؛ OPENAI_API_KEY، OPENAI_MODEL و (اختیاری) OPENAI_BASE_URL.
 */
import { AiError, mapSchemaTypes, readProviderError, transportError } from './errors.js';

const FINISH = { stop: 'stop', length: 'length', content_filter: 'filtered' };

export function createOpenAiProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const key = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
  const baseUrl = (env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  return {
    name: 'openai',
    model,
    configured: !!key,
    async generate({ system, prompt, json = true, schema, maxTokens = 1000, temperature = 0.1, timeoutMs = 25000, signal }) {
      if (!key) throw new AiError('کلید OpenAI روی سرور تنظیم نشده است (OPENAI_API_KEY).', 503, 'AI_NOT_CONFIGURED');
      const body = {
        model,
        messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
        max_completion_tokens: maxTokens,
        temperature,
      };
      if (json) {
        body.response_format = schema
          ? { type: 'json_schema', json_schema: { name: 'response', strict: false, schema: mapSchemaTypes(schema, (t) => t.toLowerCase()) } }
          : { type: 'json_object' };
      }

      let response;
      try {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw transportError(error, 'OpenAI');
      }
      if (!response.ok) {
        const error = classifyOpenAiError(response.status, await readProviderError(response));
        console.warn('[ai] OpenAI rejected request', { code: error.code, httpStatus: response.status, model });
        throw error;
      }
      const result = await response.json().catch(() => null);
      const choice = result?.choices?.[0];
      return {
        text: typeof choice?.message?.content === 'string' ? choice.message.content : '',
        finishReason: FINISH[choice?.finish_reason] || 'other',
        tokens: result?.usage?.total_tokens || 0,
      };
    },
  };
}

// Same rule as Gemini: classify, never echo the provider's message.
export function classifyOpenAiError(status, payload) {
  const code = String(payload?.error?.code || payload?.error?.type || '');
  let reason, explanation;
  if (status === 401 || /invalid_api_key/.test(code)) {
    reason = 'KEY_INVALID'; explanation = 'کلید OpenAI نامعتبر یا منقضی است. مقدار OPENAI_API_KEY را بررسی کنید.';
  } else if (/insufficient_quota|billing/.test(code)) {
    reason = 'BILLING'; explanation = 'اعتبار یا صورتحساب حساب OpenAI کافی نیست.';
  } else if (status === 429) {
    reason = 'QUOTA'; explanation = 'محدودیت درخواست OpenAI پر شده است؛ کمی بعد دوباره تلاش کنید.';
  } else if (status === 404 || /model_not_found/.test(code)) {
    reason = 'MODEL_UNAVAILABLE'; explanation = 'مدل تنظیم‌شدهٔ OpenAI در دسترس نیست. مقدار OPENAI_MODEL را بررسی کنید.';
  } else if (status === 403) {
    reason = 'PERMISSION_DENIED'; explanation = 'OpenAI دسترسی این کلید یا منطقه را رد کرده است.';
  } else if (status === 400) {
    reason = 'BAD_REQUEST'; explanation = 'OpenAI درخواست را نامعتبر تشخیص داد (400).';
  } else {
    reason = 'SERVICE_UNAVAILABLE'; explanation = 'سرویس OpenAI موقتاً در دسترس نیست؛ کمی بعد دوباره تلاش کنید.';
  }
  const error = new AiError(`${explanation} [OPENAI_${reason}]`, status === 429 && reason === 'QUOTA' ? 429 : 503, `OPENAI_${reason}`);
  error.providerStatus = status;
  return error;
}
