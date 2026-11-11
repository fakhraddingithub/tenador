import { load as baseLoad } from './mcpHooks.mjs';
export { resolve } from './mcpHooks.mjs';
export async function load(url, context, next) {
  const result = await baseLoad(url, context, next);
  const path = decodeURIComponent(url);
  if (path.endsWith('/src/lib/productJobs/service.js')) return { ...result, source: String(result.source)
    .replace('import { resolveAdminContextForUser } from "@/lib/adminContext";', 'const resolveAdminContextForUser = async () => globalThis.__jobContext;')
    .replace('import { generateJson, getAiProvider } from "@/lib/ai/index";', 'const generateJson = (...a) => globalThis.__jobAI(...a); const getAiProvider = () => ({ configured: true, name: "gemini", model: "test-product-model" });')
    .replace('import { uploadJobImage } from "./images.js";', 'const uploadJobImage = (...a) => globalThis.__jobUpload(...a);')
    .replace('import { downloadPublic, extractSource } from "@/lib/mcp/source";', 'import { extractSource } from "@/lib/mcp/source"; const downloadPublic = (...a) => globalThis.__jobDownload(...a);')
    .replace('import { revalidateContent } from "@/lib/revalidate";', 'const revalidateContent = () => {};')
    .replace('import { flushAuditScope } from "@/lib/adminAuditFlush";', 'const flushAuditScope = async () => {};') };
  if (path.endsWith('/src/app/api/internal/product-jobs/route.js')) return { ...result, source: String(result.source)
    .replace('import connectToDB from "base/configs/db";', 'const connectToDB = async () => {};') };
  return result;
}
