export async function load(url, context, next) {
  if (url.endsWith('/models/registerModels.js')) return {
    format: 'module', shortCircuit: true,
    source: ['User', 'Order', 'Payment', 'Installment', 'UsedProduct', 'WalletTransaction', 'WalletCheckout', 'Comment', 'ReviewCreditTransaction', 'SiteSetting']
      .map((name) => `import "base/models/${name}";`).join('\n'),
  };
  return next(url, context);
}
