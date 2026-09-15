import { load as loadProductCreation } from './productCreationHooks.mjs';
export { resolve } from './productCreationHooks.mjs';

export async function load(url, context, next) {
  const result = await loadProductCreation(url, context, next);
  if (url.endsWith('/src/app/api/ai/product-draft/route.js')) {
    // Keep the real route, query, population and prompt builder; only replace
    // request authentication and the production DB connection in this test.
    return { ...result, source: String(result.source)
      .replace('import connectToDB from "base/configs/db";',
        'const connectToDB = async () => {};')
      .replace('import requireAdminPermission from "@/lib/requireAdminPermission";',
        'const requireAdminPermission = async () => ({ denied: null });') };
  }
  return result;
}
