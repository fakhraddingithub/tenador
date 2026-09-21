export async function resolve(specifier, context, next) {
  if (specifier === "next/cache") return { url: "test:next-cache", shortCircuit: true };
  if (specifier.startsWith("./") && context.parentURL?.includes("/src/lib/") && !/\.[a-z]+$/i.test(specifier)) {
    return next(`${specifier}.js`, context);
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith("/models/Athlete.js")) {
    const result = await next(url, context);
    return { ...result, source: String(result.source).replace('require("./Sport")', 'import "base/models/Sport";') };
  }
  let source;
  if (url === "test:next-cache") source = "export const unstable_cache = (fn) => fn;";
  if (url.endsWith("/models/registerModels.js")) {
    source = ["Brand", "Serie", "Category", "Product", "Variant", "Sport", "Athlete", "LimitedEdition"]
      .map((name) => `import "base/models/${name}";`).join("\n");
  }
  // Pricing/network integrations are unrelated to selection and grouping.
  if (url.endsWith("/services/priceEngine.js")) source = "export const attachListingPrices = async (ps) => ps.map(p => ({...p, finalPriceToman: p.basePrice || 100}));";
  if (url.endsWith("/src/lib/Exchangerate.js")) source = "export const getCachedRate = async () => 1;";
  if (source !== undefined) return { format: "module", shortCircuit: true, source };
  return next(url, context);
}
