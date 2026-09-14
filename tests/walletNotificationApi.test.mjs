import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function load(path, deps, env = {}) {
  const context = vm.createContext({ process: { env }, console: { warn() {}, error() {}, log() {} }, Intl });
  const module = new vm.SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'), { context });
  await module.link(name => new vm.SyntheticModule(Object.keys(deps[name]), function () {
    for (const [key, value] of Object.entries(deps[name])) this.setExport(key, value);
  }, { context }));
  await module.evaluate();
  return module.namespace;
}

for (const [secret, auth, status] of [[undefined, undefined, 401], ['secret', 'Bearer wrong', 401], ['secret', 'Bearer secret', 200]]) {
  test(`notification retry endpoint requires the configured secret: ${status}`, async () => {
    const calls = [];
    const route = await load('../src/app/api/cron/wallet-notifications/route.js', {
      'next/server': { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status || 200 }) } },
      'base/configs/db': { default: async () => calls.push('connect') },
      'base/services/walletNotificationDelivery': { deliverPendingWalletNotifications: async () => { calls.push('deliver'); return 3; } },
    }, { CRON_SECRET: secret });
    const result = await route.GET({ headers: { get: () => auth } });
    assert.equal(result.status, status);
    assert.deepEqual(calls, status === 200 ? ['connect', 'deliver'] : []);
  });
}

async function emailService({ fail = false, configured = true } = {}) {
  const calls = [];
  const module = await load('../src/lib/emailService.js', {
    '@/lib/couponLabel': { couponDisplayCode: () => '' },
    'base/utils/ticketMeta': { DEPARTMENT_LABELS: {} },
    nodemailer: { default: { createTransport: options => ({ sendMail: async payload => {
      calls.push({ payload, options });
      if (fail) throw new Error('SMTP failure');
      return { accepted: [payload.to] };
    } }) } },
  }, configured ? { EMAIL_HOST: 'smtp.example.invalid', EMAIL_USER: 'sender@example.invalid' } : {});
  return { send: module.sendWalletTransactionEmail, calls };
}

test('wallet emails describe debit/credit accurately, escape administrator input and link to wallet', async () => {
  const { send, calls } = await emailService();
  for (const type of ['credit', 'debit']) await send({ _id: 'wallet:123', type, amount: 12345, description: '<script>alert(1)</script>', trackingCode: '<ORDER>' }, 'recipient@example.invalid');
  assert.ok(calls[0].payload.subject.includes('واریز'));
  assert.ok(calls[1].payload.subject.includes('برداشت'));
  for (const { payload, options } of calls) {
    assert.equal(payload.to, 'recipient@example.invalid');
    assert.ok(payload.html.includes('&lt;script&gt;'));
    assert.ok(!payload.html.includes('<script>'));
    assert.ok(payload.html.includes('/p-user/wallet'));
    assert.equal(payload.messageId, '<wallet-wallet-123@tenador.ir>');
    assert.equal(options.socketTimeout, 20000);
  }
});

test('wallet email transport errors propagate to retry instead of falsely recording success', async () => {
  const broken = await emailService({ fail: true });
  await assert.rejects(broken.send({ type: 'debit', amount: 10, description: 'reason' }, 'user@example.invalid'), /SMTP failure/);
  const missing = await emailService({ configured: false });
  await assert.rejects(missing.send({}, 'user@example.invalid'), /not configured/);
  assert.equal(missing.calls.length, 0);
});
