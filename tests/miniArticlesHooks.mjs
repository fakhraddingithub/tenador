// Next transpiles legacy CommonJS statements in unrelated models; bare Node
// does not. Keep the production model registry intact and load only this
// suite's real schemas when Node evaluates the registry.
export async function resolve(specifier, context, next) {
  if (specifier === "next/cache") return { url: "test:next-cache", shortCircuit: true };
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url === "test:next-cache") {
    return { format: "module", shortCircuit: true, source: "export const unstable_cache = (fn) => fn;" };
  }
  if (url.endsWith('/models/registerModels.js')) {
    return {
      format: 'module', shortCircuit: true,
      source: ['Brand', 'Serie', 'Category']
        .map((name) => `import "base/models/${name}";`).join('\n'),
    };
  }
  return next(url, context);
}
