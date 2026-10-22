// Execute the actual component and event handlers; requests resolve in controlled order.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import swc from "next/dist/build/swc/index.js";

const source = await readFile(new URL("../src/components/admin/orders/AdminOrdersClient.jsx", import.meta.url), "utf8");
await swc.loadBindings();
const { code } = await swc.transform(source, {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } },
  module: { type: "commonjs" },
});
const jsx = (type, props) => ({ type, props: props || {} });
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (!Array.isArray(node) && predicate(node)) return node;
  for (const child of Array.isArray(node) ? node : [node.props?.children]) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}
function harness() {
  const states = [], effects = [], pending = [], requests = [], errors = [];
  let cursor = 0, dirty = false, tree;
  const hooks = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = initial;
      return [states[slot], (value) => {
        const next = typeof value === "function" ? value(states[slot]) : value;
        if (!Object.is(next, states[slot])) { states[slot] = next; dirty = true; }
      }];
    },
    useEffect(fn, deps) {
      const slot = cursor++;
      if (!effects[slot] || deps.some((v, i) => !Object.is(v, effects[slot].deps[i]))) {
        pending.push(() => {
          effects[slot]?.cleanup?.();
          effects[slot] = { deps, cleanup: fn() };
        });
      }
    },
  };
  const deps = {
    react: hooks, "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "react-toastify": { toast: { error: (e) => errors.push(e) } },
    "framer-motion": { motion: { div: "div" }, AnimatePresence: "presence" },
    "lucide-react": new Proxy({}, { get: (_, key) => key }),
    "@/lib/couponLabel": {}, "@/components/order/OrderFlowSelectionsView": {},
    "base/utils/userName": {},
  };
  const context = vm.createContext({
    exports: {}, URLSearchParams, AbortController,
    require(name) { assert.ok(deps[name], name); return deps[name]; },
    fetch(url, options) {
      return new Promise((resolve, reject) => requests.push({ url, ...options, resolve, reject }));
    },
  });
  vm.runInContext(code, context);
  function render() {
    do {
      dirty = false; cursor = 0;
      tree = context.exports.default();
      for (const fn of pending.splice(0)) fn();
    } while (dirty);
  }
  render();
  find(tree, (n) => n.type === "button" && n.props.type === "button").props.onClick();
  render();
  return {
    requests, errors,
    filter(label, value) { find(tree, (n) => n.props.label === label).props.onChange(value); render(); },
    draft(value) { find(tree, (n) => n.type === "input").props.onChange({ target: { value } }); render(); },
    submit() { find(tree, (n) => n.type === "form").props.onSubmit({ preventDefault() {} }); render(); },
    page(value) { find(tree, (n) => n.type === "button" && n.props.children === new Intl.NumberFormat("fa-IR").format(value)).props.onClick(); render(); },
    async respond(index, trackingCode) {
      requests[index].resolve({ ok: true, json: async () => ({ orders: [{ _id: trackingCode, trackingCode }], stats: null, pagination: { page: 1, totalPages: 3, total: 50 } }) });
      await new Promise(setImmediate); render();
    },
    order() { return find(tree, (n) => n.props.order)?.props.order.trackingCode; },
    loading() { return !!find(tree, (n) => n.type === "Loader2"); },
    unmount() { for (const e of effects) e?.cleanup?.(); },
  };
}
const params = (request) => new URL(request.url, "http://localhost").searchParams;

test("each filter immediately sends its new value and retains other filters", () => {
  const h = harness();
  for (const [label, field, value] of [["وضعیت پرداخت", "paymentStatus", "PAID"], ["وضعیت ارسال", "fulfillmentStatus", "SENT"], ["روش پرداخت", "paymentMethod", "WALLET"]]) {
    const before = h.requests.length;
    h.filter(label, value);
    assert.equal(h.requests.length, before + 1);
    assert.equal(params(h.requests.at(-1)).get(field), value);
    assert.equal(params(h.requests.at(-1)).get("page"), "1");
  }
  assert.equal(params(h.requests.at(-1)).get("paymentStatus"), "PAID");
  assert.equal(params(h.requests.at(-1)).get("fulfillmentStatus"), "SENT");
  h.filter("وضعیت پرداخت", "all");
  assert.equal(params(h.requests.at(-1)).get("paymentStatus"), "all");
  h.unmount();
});

test("filter changes reset page and preserve submitted search, not unsubmitted draft", async () => {
  const h = harness();
  h.draft("علی");
  assert.equal(h.requests.length, 1);
  h.submit();
  await h.respond(1, "matching");
  h.page(2);
  assert.equal(params(h.requests.at(-1)).get("page"), "2");
  h.draft("other");
  h.filter("وضعیت ارسال", "DELIVERED");
  assert.equal(params(h.requests.at(-1)).get("page"), "1");
  assert.equal(params(h.requests.at(-1)).get("search"), "علی");
  h.draft(""); h.submit();
  assert.equal(params(h.requests.at(-1)).get("search"), "");
  h.unmount();
});

test("late responses and errors cannot replace the latest results or loading state", async () => {
  const h = harness();
  h.filter("وضعیت پرداخت", "PAID");
  assert.equal(h.requests[0].signal.aborted, true);
  await h.respond(0, "old");
  assert.equal(h.loading(), true);
  await h.respond(1, "paid");
  assert.equal(h.order(), "paid");
  h.filter("وضعیت پرداخت", "UNPAID");
  h.filter("وضعیت پرداخت", "PARTIALLY_PAID");
  await h.respond(3, "partial");
  h.requests[2].reject(new Error("stale failure"));
  await new Promise(setImmediate);
  assert.equal(h.order(), "partial");
  assert.equal(h.errors.length, 0);
  h.filter("وضعیت ارسال", "SENT");
  h.filter("وضعیت ارسال", "DELIVERED");
  await h.respond(5, "delivered");
  await h.respond(4, "sent");
  assert.equal(h.order(), "delivered");
  h.unmount();
});
