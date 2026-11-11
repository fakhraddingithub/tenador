import { load as baseLoad } from './productCreationHooks.mjs';
export { resolve } from './productCreationHooks.mjs';
export async function load(url, context, next) {
  const result = await baseLoad(url, context, next);
  const path = decodeURIComponent(url);
  if (path.endsWith('/src/app/api/mcp/oauth/authorize/route.js')) return { ...result, source: String(result.source)
    .replace('import { getAdminContext } from "@/lib/adminContext";', 'const getAdminContext = async () => globalThis.__mcpContext();') };
  if (path.endsWith('/src/lib/mcp/products.js')) return { ...result, source: String(result.source)
    .replace('import ImageKit from "imagekit";', 'class ImageKit { upload(args) { return globalThis.__mcpUpload(args); } }')
    .replace('import { downloadPublic, extractSource } from "./source.js";', 'import { downloadPublic as actualDownload, extractSource } from "./source.js"; const downloadPublic = (...args) => globalThis.__mcpDownload ? globalThis.__mcpDownload(...args) : actualDownload(...args);')
    .replace('import { revalidateContent } from "@/lib/revalidate";', 'const revalidateContent = () => {};')
    .replace('import { consumeAssistantQuota } from "@/lib/assistant/quota";', 'const consumeAssistantQuota = async (...a) => globalThis.__mcpQuota?.(...a);')
    .replace('import { flushAuditScope } from "@/lib/adminAuditFlush";', 'const flushAuditScope = async () => {};') };
  if (path.endsWith('/src/lib/mcp/oauth.js') || path.endsWith('/src/lib/mcp/auth.js')) return { ...result, source: String(result.source)
    .replace('import connectToDB from "base/configs/db";', 'const connectToDB = async () => {};')
    .replace('import { resolveAdminContextForUser } from "@/lib/adminContext";', 'const resolveAdminContextForUser = async id => globalThis.__mcpContext(id);') };
  return result;
}
