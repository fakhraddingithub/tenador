import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(file, mocks) {
  const code = ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    assert.ok(id in mocks, `Unexpected dependency ${id}`);
    return { __esModule: true, ...mocks[id] };
  }, module, module.exports);
  return module.exports;
}

function profileHarness(token, decoded, account) {
  let connections = 0;
  const { readAuthProfile } = load('src/lib/authProfile.js', {
    'base/models/registerModels': {},
    'next/headers': { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    'base/configs/db': { default: async () => { connections++; } },
    'base/utils/auth': { verifyToken: () => decoded },
    'base/models/User': { default: { findById: id => {
      assert.equal(id, decoded.userId);
      return { select: fields => { assert.equal(fields, '-password'); return { populate: async () => account }; } };
    } } },
  });
  return { readAuthProfile, connections: () => connections };
}
for (const [name, token, decoded] of [['guest', null, null], ['expired token', 'expired', false], ['invalid claims', 'bad', {}]]) {
  test(`${name} does not connect to the database or return private data`, async () => {
    const h = profileHarness(token, decoded);
    assert.deepEqual(await h.readAuthProfile('https://tenador.com'), { status: 401, user: null });
    assert.equal(h.connections(), 0);
  });
}
test('verified user retains profile fields and coach referral without exposing password', async () => {
  const h = profileHarness('valid', { userId: 'a' }, {
    _id: 'a', name: 'Name', role: 'coach', coachCode: 'CODE', password: 'secret',
    walletBalance: 123, coachApplication: { certificateImage: 'cert', status: 'approved' },
  });
  const { user, status } = await h.readAuthProfile('https://tenador.com');
  assert.equal(status, 200);
  assert.equal(user.id, 'a');
  assert.equal(user.coachCertificate, 'cert');
  assert.equal(user.walletBalance, 123);
  assert.equal(user.referralLink, 'https://tenador.com/register?ref=CODE');
  assert.equal(user.password, undefined);
});
test('deleted account is a missing profile', async () => {
  const h = profileHarness('valid', { userId: 'deleted' }, null);
  assert.deepEqual(await h.readAuthProfile('https://tenador.com'), { status: 404, user: null });
});

const nextServer = { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) } };
for (const status of [401, 404, 200]) {
  test(`session normalizes status ${status} while the private profile preserves it`, async () => {
    const user = status === 200 ? { id: 'a' } : null;
    const mocks = {
      'next/server': nextServer,
      '@/lib/authProfile': { readAuthProfile: async () => ({ user, status }) },
      'next/headers': {}, 'base/configs/db': {}, 'base/models/User': {}, 'base/utils/auth': {},
    };
    const req = { nextUrl: { origin: 'https://tenador.com' } };
    const session = await load('src/app/api/auth/session/route.js', mocks).GET(req);
    const profile = await load('src/app/api/auth/profile/route.js', mocks).GET(req);
    assert.equal(session.status, 200);
    assert.deepEqual(session.body, { user });
    assert.equal(session.headers['Cache-Control'], 'private, no-store');
    assert.equal(profile.status, status);
  });
}

function wishlistHarness(initialSession, initialWishlist = {}) {
  let session = initialSession, wishlist = initialWishlist;
  const keys = [], redirects = [], messages = [], writes = [];
  const useWishlist = load('src/hooks/useWishlist.js', {
    react: { useMemo: fn => fn() },
    'next/navigation': { useRouter: () => ({ push: path => redirects.push(path) }), usePathname: () => '/products/test' },
    swr: { default: (key, fetcher) => { keys.push(key); return { ...wishlist, mutate: async value => { writes.push(value); } }; } },
    'react-toastify': { toast: { info: value => messages.push(value), error: value => messages.push(value), success: value => messages.push(value) } },
    './useAuthSession': { default: () => ({ mutate: async () => session.data, ...session }) },
  }).default;
  return { render: () => useWishlist({ _id: 'p' }), keys, redirects, writes,
    setSession: value => { session = value; }, setWishlist: value => { wishlist = value; } };
}
test('guest skips wishlist fetch and clicking favorite redirects without a mutation', async () => {
  const h = wishlistHarness({ data: { user: null }, isLoading: false });
  assert.equal(await h.render().toggle(), false);
  assert.equal(h.keys[0], null);
  assert.deepEqual(h.writes, []);
  assert.match(h.redirects[0], /^\/login-register\?callbackUrl=/);
});
test('pending or failed session never starts private requests or mutations', async () => {
  for (const state of [{ isLoading: true }, { error: new Error('offline'), data: { user: { id: 'stale' } } }]) {
    const h = wishlistHarness(state);
    assert.equal(await h.render().toggle(), false);
    assert.equal(h.keys[0], null);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.redirects, []);
  }
});
test('account switches use separate cache keys and logout hides previous favorites', () => {
  const h = wishlistHarness({ data: { user: { id: 'a' } } }, { data: { wishlist: [{ _id: 'p' }], authenticated: true } });
  assert.equal(h.render().isWishlisted, true);
  assert.deepEqual(h.keys.at(-1), ['/api/wishlist', 'a']);
  h.setSession({ data: { user: { id: 'b' } } });
  h.setWishlist({ isLoading: true });
  assert.deepEqual(h.render().items, []);
  assert.deepEqual(h.keys.at(-1), ['/api/wishlist', 'b']);
  h.setSession({ data: { user: null } });
  h.setWishlist({ data: { wishlist: [{ _id: 'p' }] } });
  assert.deepEqual(h.render().items, []);
  assert.equal(h.keys.at(-1), null);
});
test('refresh after switching accounts never revalidates the old wishlist key', async () => {
  const h = wishlistHarness({ data: { user: { id: 'a' } }, mutate: async () => ({ user: { id: 'b' } }) });
  await h.render().refresh();
  assert.deepEqual(h.writes, []);
});

test('verified users can still add and remove favorites', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, ...options });
    return { ok: true, status: 200, json: async () => ({}) };
  });
  for (const [items, method] of [[[], 'POST'], [[{ _id: 'p' }], 'DELETE']]) {
    const h = wishlistHarness({ data: { user: { id: 'a' } } }, { data: { wishlist: items, authenticated: true } });
    assert.equal(await h.render().toggle(), true);
    assert.equal(requests.at(-1).url, '/api/wishlist');
    assert.equal(requests.at(-1).method, method);
    assert.deepEqual(JSON.parse(requests.at(-1).body), { productId: 'p' });
    assert.equal(h.writes[0].wishlist.length, method === 'POST' ? 1 : 0);
  }
});

test('failed mutations roll back and an expired session redirects without keeping optimistic data', async t => {
  for (const status of [500, 401]) {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status, json: async () => ({ error: 'failed' }) }));
    const original = { wishlist: [], authenticated: true };
    const h = wishlistHarness({ data: { user: { id: 'a' } } }, { data: original });
    assert.equal(await h.render().toggle(), false);
    assert.deepEqual(h.writes.at(-1).wishlist, []);
    if (status === 401) {
      assert.equal(h.writes.at(-1).authenticated, false);
      assert.equal(h.redirects.length, 1);
    } else assert.deepEqual(h.writes.at(-1), original);
    t.mock.restoreAll();
  }
});

test('session server failures stay errors instead of being reported as a guest', async t => {
  t.mock.method(console, 'error', () => {});
  const { GET } = load('src/app/api/auth/session/route.js', {
    'next/server': nextServer,
    '@/lib/authProfile': { readAuthProfile: async () => { throw new Error('Database offline'); } },
  });
  const response = await GET({ nextUrl: { origin: 'https://tenador.com' } });
  assert.equal(response.status, 500);
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
});

test('private profile edits still reject guests', async () => {
  const { PATCH } = load('src/app/api/auth/profile/route.js', {
    'next/server': nextServer, '@/lib/authProfile': {},
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    'base/configs/db': { default: async () => {} },
    'base/models/User': { default: { findById: () => { throw new Error('Unauthorized read'); } } },
    'base/utils/auth': {},
  });
  assert.equal((await PATCH({})).status, 401);
});
