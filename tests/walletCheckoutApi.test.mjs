import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/app/api/checkout/route.js', import.meta.url), 'utf8');
const requestBody = (patch = {}) => ({ items: [{ productId: 'product', quantity: 1 }], addressId: 'address', paymentMethod: 'BANK_RECEIPT',
  walletAmount: 200, expectedTotal: 1000, checkoutKey: 'unique-checkout-key-1', receiptImageUrls: ['receipt'], ...patch });

async function checkout(body, { auth = { userId: 'user' }, replay = null, price = 1000, coupon = null, debitError = null, legacy = false } = {}) {
  const calls = [];
  const context = vm.createContext({ console: { error() {}, warn() {} } });
  const query = (value) => ({ select() { return this; }, populate() { return this; }, lean: async () => value });
  const deps = {
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'token' }) }) },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options.status }) } },
    'base/configs/db': { default: async () => {} },
    'base/models/registerModels': {},
    'base/utils/auth': { verifyToken: () => auth },
    'base/models/Address': { default: { findOne: async (filter) => { calls.push(['address-owner', filter.user]); return { fullName: 'test' }; } } },
    'base/models/Order': { default: { findById: () => query({ items: [] }), create: async (draft) => { if (!legacy) throw new Error('Legacy create must not run for wallet orders'); calls.push(['legacy-order', draft]); return { ...draft, _id: 'legacy-order', trackingCode: 'LEGACY', payments: [], save: async () => {} }; } } },
    'base/models/UsedProduct': { default: {} },
    'base/models/Product': { default: {} },
    'base/models/Variant': { default: {} },
    'base/models/Payment': { default: { create: async (payment) => { calls.push(['legacy-payment', payment]); return { ...payment, _id: 'legacy-payment' }; } } },
    'base/models/Installment': { default: {} },
    'base/models/User': { default: { findById: () => query({}) } },
    'base/services/priceEngine': { computeCartPrice: async () => {
      calls.push('price'); return { items: [{ productId: 'product', quantity: 1, unitPrice: price }], subtotalToman: price + 100,
        discountToman: 50, couponDiscountToman: 50, finalTotalToman: price, coupon };
    } },
    'base/services/notificationService': { notifyNewOrder: async () => {}, notifyCoachStudentOrder: async () => {} },
    '@/lib/usedTrackingAuto': { autoAssignUsedProductTracking: async () => {} },
    '@/lib/emailService': { sendOrderConfirmationEmail: async () => {} },
    '@/lib/installmentRateService': { getMonthlyInstallmentRate: async () => 10 },
    '@/lib/installmentFinance': { buildInstallmentTerms: (terms) => { calls.push(['terms', terms.principal]); return { ...terms, totalPayable: terms.principal * 1.1 }; } },
    '@/lib/variantImages': { buildVariantSnapshot: () => [] },
    '@/lib/addressForm.mjs': { firstAddressError: () => '', normalizePhoneInput: (p) => p, validateAddressPayload: () => ({}) },
    'base/services/walletOrder.service': {
      validateWalletAmount: (amount) => { if (!Number.isSafeInteger(amount) || amount < 0) throw Object.assign(new Error('Invalid wallet amount'), { code: 'WALLET_CHECKOUT_ERROR', status: 400 }); },
      walletCheckoutIdentity: (user, key) => { calls.push(['identity', user, key]); return { _id: key }; },
      findWalletCheckout: async () => replay,
      createWalletOrder: async (args) => {
        calls.push(['create', args]); if (debitError) throw debitError;
        return { order: { ...args.draft, _id: 'order', trackingCode: 'TRACK', walletPaid: args.amount }, payment: {}, installment: null };
      },
    },
  };
  const loaded = new vm.SourceTextModule(source, { context });
  await loaded.link((name) => new vm.SyntheticModule(Object.keys(deps[name]), function () {
    for (const [key, value] of Object.entries(deps[name])) this.setExport(key, value);
  }, { context }));
  await loaded.evaluate();
  return { response: await loaded.namespace.POST({ json: async () => body }), calls };
}

test('checkout forwards authoritative gross total and requested wallet debit to atomic service', async () => {
  const { response, calls } = await checkout(requestBody());
  assert.equal(response.status, 201);
  const args = calls.find((c) => c[0] === 'create')[1];
  assert.equal(args.draft.totalPrice, 1000); assert.equal(args.amount, 200);
  assert.equal(args.draft.user, 'user');
  assert.equal(response.body.walletPaid, 200);
});
test('full wallet payment skips bank receipt and installment prerequisites', async () => {
  for (const paymentMethod of ['BANK_RECEIPT', 'INSTALLMENT']) {
    const { response } = await checkout(requestBody({ walletAmount: 1000, paymentMethod, receiptImageUrls: [] }));
    assert.equal(response.status, 201);
  }
});
test('installment principal excludes wallet and bank downpayment exactly once', async () => {
  const { response, calls } = await checkout(requestBody({ paymentMethod: 'INSTALLMENT', installment: {
    downPaymentAmount: 300, downPaymentReceiptUrls: ['receipt'], numberOfChecks: 1, checks: [{ amount: 550, dueDate: '2027-01-01' }],
  } }));
  assert.equal(response.status, 201);
  assert.deepEqual(calls.find((c) => c[0] === 'terms'), ['terms', 500]);
});
test('retry returns committed order before revalidating changed inventory or coupon', async () => {
  const { response, calls } = await checkout(requestBody(), { replay: { orderId: 'original', trackingCode: 'T' }, price: 0 });
  assert.equal(response.status, 200); assert.equal(response.body.orderId, 'original');
  assert.ok(!calls.includes('price'));
});
test('invalid amount, excess debit, changed price and invalid coupon cannot debit', async () => {
  for (const [patch, options] of [
    [{ walletAmount: -1 }, {}], [{ walletAmount: '200' }, {}], [{ walletAmount: 1001 }, {}],
    [{ expectedTotal: 999 }, {}], [{ couponCode: 'EXPIRED' }, {}],
  ]) {
    const { response, calls } = await checkout(requestBody(patch), options);
    assert.ok(response.status >= 400); assert.ok(!calls.some((c) => c[0] === 'create'));
  }
});
test('debit rejection is visible and unauthenticated caller cannot create an order', async () => {
  const { response } = await checkout(requestBody(), { debitError: Object.assign(new Error('Insufficient balance'), { code: 'WALLET_CHECKOUT_ERROR', status: 409 }) });
  assert.equal(response.status, 409);
  const noAuth = await checkout(requestBody(), { auth: null });
  assert.equal(noAuth.response.status, 401);
  assert.equal(noAuth.calls.length, 0);
});


test('zero-wallet checkout retains ordinary bank receipt totals and does not call wallet service', async () => {
  const { response, calls } = await checkout(requestBody({ walletAmount: 0 }), { legacy: true });
  assert.equal(response.status, 201);
  assert.equal(response.body.walletPaid, 0);
  assert.equal(calls.find(c => c[0] === 'legacy-order')[1].totalPrice, 1000);
  assert.equal(calls.find(c => c[0] === 'legacy-payment')[1].amount, 1000);
  assert.ok(!calls.some(c => ['identity', 'create'].includes(c[0])));
});


test('coach coupon checkout uses atomic persistence even when wallet debit is zero', async () => {
  const coupon = { _id: 'gift', code: 'GIFT', createdByCoach: 'coach', coachName: 'Coach Name' };
  const { response, calls } = await checkout(requestBody({ walletAmount: 0, couponCode: 'GIFT' }), { coupon });
  assert.equal(response.status, 201);
  const args = calls.find(c => c[0] === 'create')[1];
  assert.equal(args.amount, 0);
  assert.equal(args.draft.coupon.createdByCoach, 'coach');
  assert.equal(args.draft.coupon.coachName, 'Coach Name');
});

test('full coach coupon permits zero payable without receipt or installment data', async () => {
  const coupon = { _id: 'gift', code: 'GIFT', createdByCoach: 'coach', coachName: 'Coach Name' };
  for (const paymentMethod of ['BANK_RECEIPT', 'INSTALLMENT']) {
    const { response, calls } = await checkout(requestBody({ walletAmount: 0, couponCode: 'GIFT', paymentMethod, expectedTotal: 0, receiptImageUrls: [] }), { coupon, price: 0 });
    assert.equal(response.status, 201);
    assert.equal(calls.find(c => c[0] === 'create')[1].draft.totalPrice, 0);
  }
});
