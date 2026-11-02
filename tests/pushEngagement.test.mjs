import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(
    id => id in mocks ? { __esModule: true, ...mocks[id] } : require(id), module, module.exports, ...Object.values(globals));
  return module.exports;
}
function gateHarness() {
  const events = new Map();
  const window = { scrollY: 0, addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
  let shown = 0;
  const { waitForPushEngagement } = load('src/lib/pushEngagement.js', {}, { window });
  const cleanup = waitForPushEngagement(() => shown++);
  const dispatch = (type, options = {}) => events.get(type)?.({ type, isTrusted: true, ...options });
  return { events, window, cleanup, dispatch, shown: () => shown };
}
test('scroll restoration and tiny scrolling do not trigger the prompt', () => {
  const h = gateHarness();
  h.window.scrollY = 300; h.dispatch('scroll');
  assert.equal(h.shown(), 0);
  h.window.scrollY = 0; h.dispatch('wheel');
  h.window.scrollY = 80; h.dispatch('scroll');
  assert.equal(h.shown(), 0);
  h.window.scrollY = 180; h.dispatch('scroll');
  assert.equal(h.shown(), 1);
  assert.equal(h.events.size, 0);
});
test('touch and keyboard scrolling are supported', () => {
  for (const input of ['touchmove', 'keydown']) {
    const h = gateHarness();
    h.dispatch(input, { key: 'PageDown' });
    h.window.scrollY = 200; h.dispatch('scroll');
    assert.equal(h.shown(), 1);
  }
});
test('click or Enter in main content counts; form typing and synthetic events do not', () => {
  const h = gateHarness();
  const main = { closest: selector => selector === 'main' ? {} : null };
  h.dispatch('click', { target: main, isTrusted: false });
  h.dispatch('keydown', { key: 'Enter', target: { closest: () => ({}) } });
  assert.equal(h.shown(), 0);
  h.dispatch('keydown', { key: 'Enter', target: main });
  assert.equal(h.shown(), 1);
  const click = gateHarness();
  click.dispatch('click', { target: main });
  assert.equal(click.shown(), 1);
});
test('unmount removes all engagement listeners', () => {
  const h = gateHarness(); h.cleanup();
  assert.equal(h.events.size, 0);
  h.dispatch('wheel');
  assert.equal(h.shown(), 0);
});

const tick = () => new Promise(resolve => setImmediate(resolve));
function bannerHarness({ existing = null, permission = 'default', dismissed = false, storageThrows = false } = {}) {
  const effects = [], visible = [], requests = [];
  let engage, stopped = 0, registrations = 0, resolveRegistration;
  const registrationPromise = new Promise(resolve => { resolveRegistration = resolve; });
  const registration = { pushManager: { getSubscription: async () => existing } };
  const Notification = { permission };
  const Component = load('src/components/features/push/PushOptInBanner.jsx', {
    react: { useEffect: fn => effects.push(fn), useState: initial => [initial, value => visible.push(value)] },
    '@/lib/pushEngagement': { waitForPushEngagement: fn => { engage = fn; return () => stopped++; } },
    'react-icons/fi': { FiBell: () => null, FiX: () => null },
  }, {
    window: { PushManager: {}, Notification }, Notification,
    navigator: { serviceWorker: { register: () => { registrations++; return registrationPromise; } } },
    sessionStorage: { getItem: () => { if (storageThrows) throw Error('Blocked storage'); return dismissed; } },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true }; },
    process: { env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'public-key' } },
  }).default;
  assert.equal(Component(), null);
  const cleanup = effects[0]();
  return { cleanup, visible, requests, engage: () => engage?.(), ready: () => resolveRegistration(registration),
    registrations: () => registrations, stopped: () => stopped, Notification };
}
test('banner waits for both interaction and eligibility in either completion order', async () => {
  for (const earlyInteraction of [false, true]) {
    const h = bannerHarness();
    if (earlyInteraction) h.engage();
    assert.deepEqual(h.visible, []);
    h.ready(); await tick();
    if (!earlyInteraction) {
      assert.deepEqual(h.visible, []);
      h.engage();
    }
    assert.deepEqual(h.visible, [true]);
    h.cleanup();
  }
});
test('existing subscriptions still sync without user interaction or a prompt', async () => {
  const h = bannerHarness({ existing: { toJSON: () => ({ endpoint: 'existing-subscription' }) } });
  h.ready(); await tick();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, '/api/push/subscribe');
  assert.equal(h.requests[0].options.method, 'POST');
  assert.deepEqual(h.visible, []);
  assert.ok(h.stopped() > 0);
});
test('denied or dismissed prompts do not register a worker', () => {
  for (const options of [{ permission: 'denied' }, { dismissed: true }]) {
    const h = bannerHarness(options);
    assert.equal(h.registrations(), 0);
    h.engage();
    assert.deepEqual(h.visible, []);
  }
});
test('blocked storage remains usable; unmount prevents late updates', async () => {
  const h = bannerHarness({ storageThrows: true });
  h.engage(); h.ready(); await tick();
  assert.deepEqual(h.visible, [true]);
  const leaving = bannerHarness();
  leaving.engage(); leaving.cleanup(); leaving.ready(); await tick();
  assert.deepEqual(leaving.visible, []);
  assert.deepEqual(leaving.requests, []);
});
test('permission revoked while waiting prevents the prompt', async () => {
  const h = bannerHarness();
  h.ready(); await tick();
  h.Notification.permission = 'denied'; h.engage();
  assert.deepEqual(h.visible, []);
});
