import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../src/components/common/InitialLoadLoader.jsx", import.meta.url), "utf8");
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];

function boot(readyState) {
  const attributes = new Map();
  const documentEvents = new Map();
  const windowEvents = new Map();
  const timers = new Map();
  const target = (events) => ({
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
  });
  runInNewContext(script, {
    document: {
      ...target(documentEvents), readyState,
      getElementById: () => ({}),
      documentElement: { setAttribute: (name, value) => attributes.set(name, value) },
    },
    window: target(windowEvents),
    setTimeout: (fn) => { timers.set(1, fn); return 1; },
    clearTimeout: (id) => timers.delete(id),
  });
  return { attributes, documentEvents, windowEvents, timers };
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
