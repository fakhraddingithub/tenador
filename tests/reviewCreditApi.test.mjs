// Run: node --experimental-vm-modules --test tests/reviewCreditApi.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function load(relative, deps) {
  const source = await readFile(new URL(relative, import.meta.url), 'utf8');
  const context = vm.createContext({ console: { warn() {}, error() {} } });
  const loaded = new vm.SourceTextModule(source, { context });
  await loaded.link((name) => new vm.SyntheticModule(Object.keys(deps[name]), function () {
    for (const [key, value] of Object.entries(deps[name])) this.setExport(key, value);
  }, { context }));
  await loaded.evaluate();
  return loaded.namespace;
}

async function moderationRoute({ denied = null, result = { comment: { _id: 'c', status: 'approved' }, credit: { status: 'granted', amount: 200 } }, fail = null } = {}) {
  const calls = [];
  const route = await load('../src/app/api/admin/comments/[id]/route.js', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options.status }) } },
    'base/configs/db': { default: async () => { calls.push('connect'); } },
    'base/models/registerModels': {},
    'base/models/Comment': { default: {} },
    'base/models/Notification': { default: {} },
    '@/lib/revalidate': { revalidateContent: () => { calls.push('revalidate'); } },
    '@/lib/requireAdminPermission': { default: async (permission) => { calls.push(permission); return { denied }; } },
    '@/lib/reviewCreditGranting': { notifyReviewCreditGranted: async (credit) => { calls.push(['notify', credit.status]); } },
    'base/services/reviewCredit.service': { moderateCommentWithReviewCredit: async (id, status) => {
      calls.push(['moderate', id, status]);
      if (fail) throw fail;
      return result;
    } },
  });
  return { route, calls };
}

const params = { params: Promise.resolve({ id: 'c' }) };
const request = (status = 'approved') => ({ json: async () => ({ status }) });

test('unauthorized moderator cannot read or write financial state', async () => {
  const { route, calls } = await moderationRoute({ denied: { status: 403 } });
  assert.equal((await route.PATCH(request(), params)).status, 403);
  assert.deepEqual(calls, ['comments.moderate']);
});

test('approval/re-approval uses the atomic service before announcing success', async () => {
  const { route, calls } = await moderationRoute();
  const response = await route.PATCH(request(), params);
  assert.equal(response.status, 200);
  assert.equal(response.body.credit.amount, 200);
  assert.equal(response.body.credit.status, 'granted');
  assert.deepEqual(calls, ['comments.moderate', 'connect', ['moderate', 'c', 'approved'], 'revalidate', ['notify', 'granted']]);
});

test('repeat payment reports already-granted with no new amount', async () => {
  const { route } = await moderationRoute({ result: { comment: { _id: 'c' }, credit: { status: 'already_granted' } } });
  const response = await route.PATCH(request(), params);
  assert.equal(response.status, 200);
  assert.equal(response.body.credit.status, 'already_granted');
  assert.equal(response.body.credit.amount, 0);
});

test('transaction requirement is explicit and never reported as successful approval', async () => {
  const failure = Object.assign(new Error('atomic transaction required'), { code: 'REVIEW_CREDIT_TRANSACTION_REQUIRED' });
  const { route, calls } = await moderationRoute({ fail: failure });
  const response = await route.PATCH(request(), params);
  assert.equal(response.status, 503);
  assert.equal(response.body.code, failure.code);
  assert.ok(!calls.some((call) => Array.isArray(call) && call[0] === 'notify'));
});

test('failed payment returns a retryable error without sending success notices', async () => {
  const { route, calls } = await moderationRoute({ fail: new Error('private database failure') });
  const response = await route.PATCH(request(), params);
  assert.equal(response.status, 500);
  assert.equal(response.body.code, 'COMMENT_MODERATION_FAILED');
  assert.ok(!response.body.message.includes('private'));
  assert.ok(!calls.includes('revalidate'));
});

test('invalid status and missing comment do not run a payment', async () => {
  const { route, calls } = await moderationRoute({ result: null });
  assert.equal((await route.PATCH(request('invalid'), params)).status, 400);
  assert.ok(!calls.some((call) => Array.isArray(call) && call[0] === 'moderate'));
  assert.equal((await route.PATCH(request(), params)).status, 404);
});

test('all notification failures are contained after a committed reward', async () => {
  const calls = [];
  const notify = await load('../src/lib/reviewCreditGranting.js', {
    '@/lib/emailService': { sendWalletCreditEmail: () => { calls.push('email'); throw new Error('sync email failure'); } },
    'base/services/userNotificationService': { createUserNotification: async () => { calls.push('inbox'); throw new Error('inbox failure'); } },
    '@/lib/push': { sendPushToUser: async (_, payload) => { calls.push(payload.url); throw new Error('push failure'); } },
  });
  await notify.notifyReviewCreditGranted({ status: 'granted', userId: 'user', amount: 200, email: 'test@example.invalid', trackingCode: 'T1' });
  assert.deepEqual(calls, ['email', 'inbox', '/p-user/wallet']);
  await notify.notifyReviewCreditGranted({ status: 'already_granted' });
  await notify.notifyReviewCreditGranted({ status: 'disabled' });
  assert.equal(calls.length, 3);
});
