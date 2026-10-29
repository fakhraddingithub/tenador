import { load as loadProductCreation } from './productCreationHooks.mjs';
export { resolve } from './productCreationHooks.mjs';

// Routes whose real handler, queries, validation and prompt builder run against the
// temporary replica set; only request authentication, the production DB connection
// and cache revalidation are replaced.
const STUBBED_ROUTES = [
  '/src/app/api/ai/product-draft/route.js',
  '/src/app/api/admin/product-prompts/route.js',
  '/src/app/api/admin/product-prompts/preview/route.js',
  '/src/app/api/admin/product-prompts/category-rule/route.js',
  '/src/app/api/categories/[categoryId]/route.js',
];

export async function load(url, context, next) {
  const result = await loadProductCreation(url, context, next);
  const path = decodeURIComponent(url);
  if (STUBBED_ROUTES.some((route) => path.endsWith(route))) {
    return { ...result, source: String(result.source)
      .replace('import connectToDB from "base/configs/db";',
        'const connectToDB = async () => {};')
      .replace('import requireAdminPermission from "@/lib/requireAdminPermission";',
        'const requireAdminPermission = async () => ({ denied: null });')
      .replace(/import \{[^}]*\} from "@\/lib\/revalidate";/,
        'const purgeSportPagesCdn = async () => {}, revalidateCategoryVisibilityPaths = () => {}, revalidateContent = () => {};') };
  }
  return result;
}
