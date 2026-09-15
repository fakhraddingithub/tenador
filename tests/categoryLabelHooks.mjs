import { resolve, load as loadModels } from "./productCreationHooks.mjs";

export { resolve };

// Real queries/models; isolate request auth, Next cache and the production DB.
export async function load(url, context, next) {
  const result = await loadModels(url, context, next);
  const path = decodeURIComponent(url);
  if (path.endsWith("/configs/db.js")) {
    return { ...result, source: "export default async function connectToDB() {}" };
  }
  if (path.endsWith("/src/lib/requireAdminPermission.js")) {
    return { ...result, source: "export default async function requireAdminPermission() { return { denied: null }; }" };
  }
  if (path.endsWith("/src/lib/navbarService.js")) {
    return { ...result, source: String(result.source).replace(
      'import { unstable_cache } from "next/cache";',
      "const unstable_cache = (fn) => fn;",
    ) };
  }
  return result;
}
