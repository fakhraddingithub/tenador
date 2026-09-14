export async function load(url, context, next) {
  if (url.endsWith('/src/lib/emailService.js')) return { format: 'module', shortCircuit: true,
    source: 'export async function sendWalletTransactionEmail(tx, email) { return globalThis.walletTestEmail(tx, email); }' };
  if (url.endsWith('/src/lib/push.js')) return { format: 'module', shortCircuit: true,
    source: 'export async function sendPushToUser(user, payload) { return globalThis.walletTestPush(user, payload); }' };
  return next(url, context);
}
