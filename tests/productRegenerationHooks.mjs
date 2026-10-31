import { load as loadProductCreation } from './productCreationHooks.mjs';
export { resolve } from './productCreationHooks.mjs';

const REGENERATE = '/src/app/api/product/[productId]/regenerate/route.js';
const GENERATE = '/src/app/api/product/[productId]/regenerate/generate/route.js';

// Both regeneration routes run for real against the temporary replica set; only request
// authentication, the production DB connection, cache revalidation, the AI provider and
// the per-user quota are replaced (the last two by test-controlled globals).
export async function load(url, context, next) {
  const result = await loadProductCreation(url, context, next);
  const path = decodeURIComponent(url);
  if (!path.endsWith(REGENERATE) && !path.endsWith(GENERATE)) return result;
  return { ...result, source: String(result.source)
    .replace('import connectToDB from "base/configs/db";', 'const connectToDB = async () => {};')
    .replace('import requireAdminPermission from "@/lib/requireAdminPermission";',
      'const requireAdminPermission = async () => ({ ctx: { userId: "tester" }, denied: null });')
    .replace('import { revalidateContent } from "@/lib/revalidate";', 'const revalidateContent = () => {};')
    .replace('import { generate, getAiConfig, AiError } from "@/lib/ai/index";',
      'import { AiError } from "@/lib/ai/index";\nconst generate = (...a) => globalThis.__ai.generate(...a), getAiConfig = () => globalThis.__ai.config();')
    .replace('import { consumeAssistantQuota } from "@/lib/assistant/quota";',
      'const consumeAssistantQuota = async (...a) => globalThis.__ai.quota?.(...a);') };
}
