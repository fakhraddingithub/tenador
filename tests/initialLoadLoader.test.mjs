import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../src/components/common/InitialLoadLoader.jsx", import.meta.url), "utf8");
// Execute the actual template literal, including its escape processing, just
// as the component does before injecting the script into the document.
const html = runInNewContext(source.match(/const OVERLAY_HTML = (`[\s\S]*?`);/)[1]);
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function boot(readyState, contentState) {
  const attributes = new Map();
  const documentEvents = new Map();
  const windowEvents = new Map();
  const timers = new Map();
  const frames = new Map();
  let disconnected = false, mutation;
  const target = (events) => ({
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
  });
  runInNewContext(script, {
    document: {
      ...target(documentEvents), readyState,
      getElementById: () => ({}),
      querySelector: () => contentState?.present ? {
        querySelector: () => contentState.complete ? {} : null,
        getClientRects: () => contentState.visible ? [{}] : [],
      } : null,
      querySelectorAll: () => contentState?.styles || [],
      documentElement: { setAttribute: (name, value) => attributes.set(name, value) },
    },
    window: { ...target(windowEvents), location: { pathname: '/products/test' }, matchMedia: () => ({ matches: true }) },
    getComputedStyle: () => ({ display: contentState?.display || 'grid' }),
    MutationObserver: contentState ? class {
      constructor(fn) { mutation = fn; }
      observe() {}
      disconnect() { disconnected = true; }
    } : undefined,
    requestAnimationFrame: fn => { frames.set(1, fn); return 1; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn) => { timers.set(1, fn); return 1; },
    clearTimeout: (id) => timers.delete(id),
  });
  return { attributes, documentEvents, windowEvents, timers, frames,
    mutation: () => mutation(), disconnected: () => disconnected,
    paint: () => { const fn = frames.get(1); frames.delete(1); fn?.(); } };
}

test("dismisses at DOMContentLoaded without waiting for image/window load", () => {
  const state = boot("loading");
  assert.equal(state.attributes.has("data-tnd-il-done"), false);
  assert.equal(state.windowEvents.has("load"), false);
  state.documentEvents.get("DOMContentLoaded")();
  assert.equal(state.attributes.has("data-tnd-il-done"), true);
  assert.equal(state.timers.size, 0);
  assert.equal(state.documentEvents.size, 0);
  assert.equal(state.windowEvents.size, 0);
});

test('fully priced, visible and styled content dismisses before DOMContentLoaded', () => {
  const state = boot('loading', { present: true, complete: true, visible: true });
  state.paint();
  assert.equal(state.attributes.has('data-tnd-il-done'), true);
  assert.equal(state.disconnected(), true);
  assert.equal(state.timers.size, 0);
  assert.equal(state.documentEvents.size, 0);
});

test('partial HTML, hidden stream segments and missing grid CSS keep the overlay', () => {
  for (const change of [{ present: false }, { complete: false }, { visible: false }, { display: 'block' }]) {
    const content = { present: true, complete: true, visible: true, ...change };
    const state = boot('loading', content);
    state.paint();
    assert.equal(state.attributes.has('data-tnd-il-done'), false);
    Object.assign(content, { present: true, complete: true, visible: true, display: 'grid' });
    state.mutation(); state.paint();
    assert.equal(state.attributes.has('data-tnd-il-done'), true);
  }
});

test('pending CSS must finish loading; mutation checks are coalesced per frame', () => {
  const stylesheet = { sheet: null };
  const state = boot('loading', { present: true, complete: true, visible: true, styles: [stylesheet] });
  state.mutation(); state.mutation();
  assert.equal(state.frames.size, 1);
  state.paint();
  assert.equal(state.attributes.has('data-tnd-il-done'), false);
  stylesheet.sheet = {};
  state.documentEvents.get('load')(); state.paint();
  assert.equal(state.attributes.has('data-tnd-il-done'), true);
});

test('fallback dismissal also cancels the observer and scheduled frame', () => {
  const state = boot('loading', { present: false });
  state.documentEvents.get('DOMContentLoaded')();
  assert.equal(state.disconnected(), true);
  assert.equal(state.frames.size, 0);
});

for (const readyState of ["interactive", "complete"]) {
  test(`dismisses immediately when inserted into a ${readyState} document`, () => {
    const state = boot(readyState);
    assert.equal(state.attributes.has("data-tnd-il-done"), true);
    assert.equal(state.timers.size, 0);
  });
}

test("pageshow and the safety timeout each recover a stalled loader", () => {
  for (const event of ["pageshow", "timeout"]) {
    const state = boot("loading");
    (event === "pageshow" ? state.windowEvents.get("pageshow") : state.timers.get(1))();
    assert.equal(state.attributes.has("data-tnd-il-done"), true);
    assert.equal(state.documentEvents.size, 0);
    assert.equal(state.timers.size, 0);
  }
});
