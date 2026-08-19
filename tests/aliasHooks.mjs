/**
 * tests/aliasHooks.mjs
 *
 * حلِ اسمِ مستعارِ `base/*` و `@/*` (که در jsconfig تعریف شده‌اند) برای
 * `node --test`. بدون این، هیچ تستی نمی‌تواند مستقیم services/ یا models/ را
 * ایمپورت کند، چون خودشان با همین اسم‌های مستعار به هم ارجاع می‌دهند.
 */
import { pathToFileURL } from "node:url";

const ROOT = pathToFileURL(`${process.cwd()}/`).href;
const withExtension = (url) => (/\.(js|jsx|mjs|cjs|json)$/i.test(url) ? url : `${url}.js`);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("base/")) return next(withExtension(ROOT + specifier.slice(5)), context);
  if (specifier.startsWith("@/")) return next(withExtension(`${ROOT}src/${specifier.slice(2)}`), context);
  return next(specifier, context);
}
