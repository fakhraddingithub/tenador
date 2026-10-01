// Exercise the actual component handlers through compiled JSX and a small hook
// harness. This does not claim to replace browser layout/accessibility testing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import swc from "next/dist/build/swc/index.js";
import * as traversal from "../src/lib/flowTraversal.js";
import * as conditions from "../src/lib/flowConditions.js";

await swc.loadBindings();
const modalSource = await readFile(new URL("../src/components/modules/orderFlow/OrderFlowModal.jsx", import.meta.url), "utf8");
const adminSource = await readFile(new URL("../src/components/admin/orders/AdminOrderDetailClient.jsx", import.meta.url), "utf8");
const adminComponent = adminSource.slice(adminSource.indexOf("function AddItemModal("), adminSource.indexOf("/* ─── Barcode Scanner Component"));
const compiled = await Promise.all([modalSource, `${adminComponent}\nexport default AddItemModal;`].map(async (source) => (await swc.transform(source, {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" },
})).code));

const jsx = (type, props) => ({ type, props: props || {} });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const text = (node) => Array.isArray(node) ? node.map(text).join("") : typeof node === "object" && node ? text(node.props?.children) : String(node ?? "");
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (!Array.isArray(node) && predicate(node)) return node;
  for (const child of Array.isArray(node) ? node : [node.props?.children]) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}
function harness(index, props, globals = {}) {
  const states = [], effects = [], refs = [];
  let cursor = 0, dirty = false, tree;
  const pending = [];
  const hooks = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = typeof initial === "function" ? initial() : initial;
      return [states[slot], (input) => {
        const next = typeof input === "function" ? input(states[slot]) : input;
        if (!Object.is(next, states[slot])) { states[slot] = next; dirty = true; }
      }];
    },
    useRef(initial) { const slot = cursor++; return refs[slot] ||= { current: initial }; },
    useMemo: (fn) => fn(), useCallback: (fn) => fn, useId: () => "modal-title",
    useEffect(fn, deps) {
      const slot = cursor++;
      if (!effects[slot] || deps.some((value, i) => !Object.is(value, effects[slot][i]))) { effects[slot] = deps; pending.push(fn); }
    },
  };
  const errors = [];
  const toast = { error: (message) => errors.push(message), success() {} };
  const icons = new Proxy({}, { get: (_, key) => key });
  const dependencies = {
    react: hooks, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "react-icons/fi": icons, "react-toastify": { toast },
    "@/lib/flowTraversal": traversal, "@/lib/flowConditions": conditions,
    "./ServiceNodeStep": { default: "service-step" }, "./CategoryNodeStep": { default: "category-step" },
  };
  const context = vm.createContext({
    exports: {}, require: (name) => { assert.ok(dependencies[name], name); return dependencies[name]; },
    console: { error() {} }, ...hooks, ...traversal, toast, AbortController,
    setTimeout, clearTimeout, motion: { div: "div" }, OrderFlowModal: "order-flow-modal",
    Plus: "plus", Minus: "minus", X: "x", Search: "search", Loader2: "loader", ...globals,
  });
  vm.runInContext(compiled[index], context);
  const render = () => {
    let count = 0;
    do {
      assert.ok(count++ < 20, "render loop");
      dirty = false; cursor = 0;
      tree = context.exports.default(props);
      for (const effect of pending.splice(0)) effect();
    } while (dirty);
    return tree;
  };
  render();
  return { render, errors, find: (predicate) => find(render(), predicate), button: (label) => find(render(), (node) => node.type === "button" && text(node).includes(label)) };
}

const service = (id, extra = {}) => ({ id, type: "service", label: id, required: false, ...extra });
const selected = (id) => ({ nodeId: id, nodeType: "service", serviceConfig: [{ optionKey: "x", choiceKey: "yes" }] });
const current = (ui) => ui.find((node) => node.type?.name === "StepBody");
const settle = async () => { await new Promise((resolve) => setImmediate(resolve)); };

test("admin label and back action; skipping the last selected step excludes it from confirmation", async () => {
  const confirmed = [];
  let backed = false;
  const ui = harness(0, { isOpen: true, flow: { nodes: [service("one")] }, confirmLabel: "تأیید و افزودن به سفارش", onBackToProduct: () => { backed = true; }, onConfirm: (items) => confirmed.push(items) });
  ui.button("بازگشت به محصول").props.onClick();
  assert.equal(backed, true);
  current(ui).props.onChange(selected("one"));
  assert.ok(ui.button("تأیید و افزودن به سفارش"));
  ui.button("رد کردن").props.onClick();
  await settle();
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].length, 0);
});

test("skipping a selection recalculates dependent visibility before moving forward", () => {
  const ui = harness(0, { isOpen: true, flow: { nodes: [service("one"), service("dependent", { visibleWhen: { conditions: [{ type: "answered", nodeId: "one" }] } }), service("last")] } });
  current(ui).props.onChange(selected("one"));
  ui.button("رد کردن").props.onClick();
  assert.equal(current(ui).props.node.id, "last");
});

test("failed save preserves choices and allows retry; duplicate confirmation and close are blocked while saving", async () => {
  let calls = 0, closes = 0;
  const pending = deferred();
  const ui = harness(0, { isOpen: true, flow: { nodes: [service("one")] }, onConfirm: () => { calls++; return pending.promise; }, onClose: () => { closes++; } });
  current(ui).props.onChange(selected("one"));
  const button = ui.button("تایید و افزودن به سبد");
  button.props.onClick(); button.props.onClick();
  assert.equal(calls, 1);
  ui.render().props.onClick();
  assert.equal(closes, 0);
  assert.equal(ui.button("در حال افزودن").props.disabled, true);
  pending.reject(new Error("ثبت ناموفق"));
  await settle();
  assert.deepEqual(ui.errors, ["ثبت ناموفق"]);
  assert.equal(current(ui).props.value.nodeId, "one");
  assert.equal(ui.button("تایید و افزودن به سبد").props.disabled, false);
});

test("all-hidden flow can be confirmed without trapping the admin on an empty step", async () => {
  let confirmed;
  const ui = harness(0, { isOpen: true, flow: { nodes: [service("hidden", { visibleWhen: { conditions: [{ type: "answered", nodeId: "absent" }] } })] }, onConfirm: (items) => { confirmed = items; } });
  ui.button("تایید و افزودن به سبد").props.onClick();
  await settle();
  assert.equal(confirmed.length, 0);
});

async function chooseProduct(ui) {
  const input = ui.find((node) => node.type === "input" && node.props.type === "text");
  input.props.onChange({ target: { value: "راکت" } });
  await new Promise((resolve) => setTimeout(resolve, 320));
  const item = ui.find((node) => node.type === "li");
  assert.ok(item);
  return find(item, (node) => node.type === "button").props.onClick();
}

test("admin completes variant first, enters shared modal and posts selections only on confirmation", async () => {
  const requests = [];
  let closed = 0;
  const ui = harness(1, { orderId: "order", onSuccess() {}, onClose() { closed++; } }, { fetch: async (url, options) => {
    if (options?.method === "POST") { requests.push(JSON.parse(options.body)); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => url.includes("productId=")
      ? { product: { _id: "p", name: "راکت" }, items: [{ _id: "v", label: "L2" }], flow: { nodes: [service("one")] } }
      : { items: [{ _id: "p", label: "راکت" }] } };
  } });
  await chooseProduct(ui);
  assert.equal(ui.button("ادامه و تکمیل").props.disabled, true);
  ui.find((node) => node.type === "input" && node.props.type === "radio").props.onChange();
  await ui.button("ادامه و تکمیل").props.onClick();
  const modal = ui.find((node) => node.type === "order-flow-modal");
  assert.equal(requests.length, 0);
  assert.equal(modal.props.variantId, "v");
  modal.props.onBackToProduct();
  assert.equal(ui.find((node) => node.type === "input" && node.props.type === "radio").props.checked, true);
  await ui.button("ادامه و تکمیل").props.onClick();
  await ui.find((node) => node.type === "order-flow-modal").props.onConfirm([selected("one")]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].flowSelections[0].nodeId, "one");
  assert.equal(requests[0].variantId, "v");
  assert.equal(closed, 1);
});

test("failed product details blocks saving until a successful retry; no-flow item saves directly", async () => {
  let fail = true, saved = 0;
  const ui = harness(1, { orderId: "order", onSuccess() {}, onClose() {} }, { fetch: async (url, options) => {
    if (options?.method === "POST") { saved++; return { ok: true, json: async () => ({}) }; }
    if (!url.includes("productId=")) return { ok: true, json: async () => ({ items: [{ _id: "p", label: "راکت" }] }) };
    return { ok: !fail, json: async () => fail ? { message: "بارگذاری ناموفق" } : { product: { _id: "p" }, items: [], flow: null } };
  } });
  await chooseProduct(ui);
  assert.equal(ui.button("افزودن به سفارش").props.disabled, true);
  fail = false;
  await ui.button("تلاش دوباره").props.onClick();
  await ui.button("افزودن به سفارش").props.onClick();
  assert.equal(saved, 1);
});

test("loading blocks submission and a late response for the previous product cannot replace the new choice", async () => {
  const oldDetails = deferred();
  let searches = 0, saved;
  const ui = harness(1, { orderId: "order", onSuccess() {}, onClose() {} }, { fetch: async (url, options) => {
    if (options?.method === "POST") { saved = JSON.parse(options.body); return { ok: true, json: async () => ({}) }; }
    if (url.includes("productId=old")) return oldDetails.promise;
    if (url.includes("productId=new")) return { ok: true, json: async () => ({ product: { _id: "new", name: "محصول جدید" }, items: [], flow: null }) };
    searches++;
    return { ok: true, json: async () => ({ items: [{ _id: searches === 1 ? "old" : "new", label: "راکت" }] }) };
  } });
  ui.find((node) => node.type === "input" && node.props.type === "text").props.onChange({ target: { value: "راکت" } });
  await new Promise((resolve) => setTimeout(resolve, 320));
  const selection = find(ui.find((node) => node.type === "li"), (node) => node.type === "button").props.onClick();
  assert.equal(ui.button("افزودن به سفارش").props.disabled, true);
  ui.button("تغییر").props.onClick();
  await chooseProduct(ui);
  oldDetails.resolve({ ok: true, json: async () => ({ product: { _id: "old" }, items: [{ _id: "old-variant" }], flow: { nodes: [service("old-flow")] } }) });
  await selection;
  assert.equal(ui.button("افزودن به سفارش").props.disabled, false);
  await ui.button("افزودن به سفارش").props.onClick();
  assert.equal(saved.productId, "new");
  assert.equal(saved.variantId, null);
  assert.equal(saved.flowSelections.length, 0);
});
