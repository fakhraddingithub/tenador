// Next transpiles legacy CommonJS statements in unrelated models; bare Node
// does not. Keep the production model registry intact and load only this
// integration suite's real schemas when Node evaluates the registry.
export async function load(url, context, next) {
  if (url.endsWith('/models/registerModels.js')) {
    return {
      format: 'module', shortCircuit: true,
      source: ['User', 'Order', 'Comment', 'ReviewCreditTransaction', 'SiteSetting']
        .map((name) => `import "base/models/${name}";`).join('\n'),
    };
  }
  return next(url, context);
}
