import { resolve as resolveAlias } from './aliasHooks.mjs';

const NEXT_PACKAGES = new Set(['next/server', 'next/headers', 'next/cache']);

export async function resolve(specifier, context, next) {
  return resolveAlias(
    NEXT_PACKAGES.has(specifier) ? `${specifier}.js` : specifier,
    context,
    next,
  );
}

// Next bundles this legacy mixed-module model; native Node needs an ESM import.
export async function load(url, context, next) {
  const result = await next(url, context);
  // The edit route's path segment arrives percent-encoded as %5BproductId%5D
  const path = decodeURIComponent(url);

  // Only external request infrastructure is stubbed. Validation, models,
  // transactions and the routes themselves run against the temporary replica set.
  if (path.endsWith('/src/app/api/product/create/route.js')) {
    return { ...result, source: stubRequestInfrastructure(result.source) };
  }
  if (path.endsWith('/src/app/api/product/[productId]/route.js')) {
    return { ...result, source: stubRequestInfrastructure(result.source)
      .replace('import { resolveAdminContext } from "@/lib/adminContext";',
        'const resolveAdminContext = async () => null;') };
  }
  if (path.endsWith('/models/Athlete.js')) {
    return { ...result, source: String(result.source).replace('require("./Sport")', 'import "./Sport.js";') };
  }
  if (path.includes('/models/') && result.format === 'module') {
    return { ...result, source: String(result.source)
      .replace('const mongoose = require("mongoose");', 'import mongoose from "mongoose";')
      .replace('const { default: mongoose } = require("mongoose");', 'import mongoose from "mongoose";') };
  }
  return result;
}

function stubRequestInfrastructure(source) {
  return String(source)
    .replace('import connectToDB from "base/configs/db";', 'const connectToDB = async () => {};')
    .replace('import requireAdminPermission from "@/lib/requireAdminPermission";',
      'const requireAdminPermission = async () => ({ denied: null });')
    .replace('import { revalidateContent } from "@/lib/revalidate";', 'const revalidateContent = () => {};')
    .replace('import { resolveProductLimitedEdition } from "@/lib/limitedEditionRelations";',
      'const resolveProductLimitedEdition = async () => ({ value: null });');
}
