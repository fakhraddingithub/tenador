// Thin adapter: the assistant talks to the model through the shared AI layer
// (src/lib/ai), so key/model/proxy config and provider errors live in one place.
// It keeps its own enable flag, message wording and AssistantError type.
import { AiError, generateJson as generateAiJson, getAiConfig } from '../ai/index.js';
import { AssistantError } from './validation.js';

const MESSAGES = {
  AI_INCOMPLETE: ['پاسخ مدل کامل نشد؛ سؤال را کوتاه‌تر یا دقیق‌تر مطرح کنید.', 502],
  AI_EMPTY: ['پاسخ مدل کامل نشد؛ سؤال را کوتاه‌تر یا دقیق‌تر مطرح کنید.', 502],
  AI_INVALID_JSON: ['پاسخ مدل قابل پردازش نبود؛ دوباره تلاش کنید.', 502],
  AI_TIMEOUT: ['اتصال به Gemini برقرار نشد یا زمان پاسخ تمام شد. تنظیمات شبکهٔ سرور را بررسی کنید.', 503],
  AI_UNREACHABLE: ['اتصال به Gemini برقرار نشد یا زمان پاسخ تمام شد. تنظیمات شبکهٔ سرور را بررسی کنید.', 503],
};

export function getAssistantConfig() {
  const { configured, model } = getAiConfig();
  return { configured, enabled: process.env.ADMIN_ASSISTANT_ENABLED !== 'false', model };
}

export async function generateJson({ system, input, schema, maxTokens = 1000, signal }) {
  const config = getAssistantConfig();
  if (!config.enabled || !config.configured) throw new AssistantError('دستیار هنوز روی سرور فعال نشده است.', 503);
  try {
    const { value, tokens } = await generateAiJson({ system, prompt: JSON.stringify(input), schema, maxTokens, signal });
    return { value, tokens };
  } catch (error) {
    if (!(error instanceof AiError)) throw error;
    const [message, status] = MESSAGES[error.code] || [error.message, error.status];
    const wrapped = new AssistantError(message, status);
    wrapped.code = error.code;
    throw wrapped;
  }
}
