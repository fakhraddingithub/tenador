import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import swc from "next/dist/build/swc/index.js";
import { reviewRequest } from "../src/lib/reviewRequest.js";

test("request deadline aborts a stalled fetch", async (t) => {
  let signal;
  t.mock.method(globalThis, "fetch", async (_, options) => {
    signal = options.signal;
    return new Promise(() => {});
  });
  await assert.rejects(reviewRequest("/upload", {}, {
    timeoutMs: 10, timeoutMessage: "upload timed out",
  }), /upload timed out/);
  assert.equal(signal.aborted, true);
});

test("deadline includes a stalled response body", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ json: () => new Promise(() => {}) }));
  await assert.rejects(reviewRequest("/comments", {}, {
    timeoutMs: 10, timeoutMessage: "unknown result",
  }), /unknown result/);
});

test("non-JSON errors retain HTTP status and network errors propagate", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ status: 413, json: async () => { throw new Error(); } }));
  const result = await reviewRequest("/upload", {}, { timeoutMs: 100 });
  assert.equal(result.response.status, 413);
  assert.deepEqual(result.data, {});
  globalThis.fetch = async () => { throw new TypeError("offline"); };
  await assert.rejects(reviewRequest("/upload", {}, { timeoutMs: 100 }), /offline/);
});

await swc.loadBindings();
const source = await readFile(new URL("../src/components/modules/orders/ReviewModal.jsx", import.meta.url), "utf8");
const { code } = await swc.transform(source, {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } },
  module: { type: "commonjs" },
});
const jsx = (type, props) => ({ type, props: props || {} });
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (!Array.isArray(node) && predicate(node)) return node;
  for (const child of Array.isArray(node) ? node : [node.props?.children]) {
    const result = find(child, predicate);
    if (result) return result;
  }
  return null;
}
function harness(request, used = false) {
  const slots = [];
  let cursor = 0, tree, done = [], closed = 0;
  const hooks = {
    useState(value) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = value;
      return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }];
    },
    useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
    useEffect() {},
  };
  const dependencies = {
    react: hooks,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "framer-motion": { motion: { div: "div" }, AnimatePresence: "presence" },
    "react-icons/fa": { FaTimes: "icon", FaCheckCircle: "icon", FaCamera: "icon", FaTrash: "icon" },
    "react-toastify": { toast: { error() {}, success() {}, info() {} } },
    "@/components/reviews/RatingStars": { default: "stars" },
    "@/lib/reviewRequest": { reviewRequest: request },
  };
  const context = vm.createContext({ exports: {}, require: (name) => dependencies[name],
    URL: { createObjectURL: () => "blob:preview", revokeObjectURL() {} },
    FormData, TypeError,
  });
  vm.runInContext(code, context);
  const props = { order: { _id: "order" }, product: {
    _id: "product", name: "Racket", reviewType: used ? "used_product" : "product",
    reviewKey: used ? "used_product:product" : "product:product",
  }, onDone: (id) => done.push(id), onClose: () => closed++ };
  function render() { cursor = 0; tree = context.exports.default(props); }
  const get = (type) => find(tree, (n) => n.type === type);
  render();
  return {
    render, get, done, closed: () => closed,
    text(value) { get("textarea").props.onChange({ target: { value } }); render(); },
    photo() { get("input").props.onChange({ target: { files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })] } }); render(); },
    submit() { return get("form").props.onSubmit({ preventDefault() {} }); },
    alert() { return find(tree, (n) => n.props.role === "alert")?.props.children; },
  };
}
const ok = (data) => ({ response: { ok: true, status: 201 }, data });

test("upload timeout keeps draft, releases submit and never creates a comment", async () => {
  const calls = [];
  const h = harness(async (url) => { calls.push(url); throw new Error("upload timeout"); });
  h.text("عالی"); h.photo();
  await h.submit(); h.render();
  assert.deepEqual(calls, ["/api/upload"]);
  assert.equal(h.get("textarea").props.value, "عالی");
  assert.equal(h.get("input").props.disabled, false);
  assert.equal(h.alert(), "upload timeout");
  assert.equal(h.closed(), 0);
});

test("retry reuses uploaded image after unknown comment result; duplicate response completes", async () => {
  const calls = [];
  let attempts = 0;
  const h = harness(async (url, options) => {
    calls.push(url);
    if (url === "/api/upload") return ok({ url: "https://ik.imagekit.io/review.jpg" });
    assert.deepEqual(JSON.parse(options.body).images, ["https://ik.imagekit.io/review.jpg"]);
    if (++attempts === 1) throw new Error("unknown result");
    return { response: { ok: false, status: 409 }, data: { code: "DUPLICATE" } };
  });
  h.text("عالی"); h.photo();
  await h.submit(); h.render();
  assert.equal(h.alert(), "unknown result");
  await h.submit(); h.render();
  assert.deepEqual(calls, ["/api/upload", "/api/comments", "/api/comments"]);
  assert.equal(h.closed(), 1);
  assert.deepEqual(h.done, ["product:product"]);
});

for (const used of [false, true]) {
  test(`successful ${used ? "used" : "new"} product review preserves payload and prevents double submit`, async () => {
    let release, count = 0, body;
    const h = harness(async (_, options) => {
      count++; body = JSON.parse(options.body);
      await new Promise((resolve) => { release = resolve; });
      return ok({ comment: { id: "saved" } });
    }, used);
    h.text("عالی");
    const first = h.submit();
    await h.submit();
    assert.equal(count, 1);
    assert.equal(body[used ? "usedProduct" : "product"], "product");
    assert.equal(body.orderId, "order");
    assert.deepEqual(body.images, []);
    release(); await first; h.render();
    assert.equal(h.closed(), 1);
  });
}

test("non-JSON upload rejection is visible and never submits the review", async () => {
  const calls = [];
  const h = harness(async (url) => {
    calls.push(url);
    return { response: { ok: false, status: 413 }, data: {} };
  });
  h.text("عالی"); h.photo();
  await h.submit(); h.render();
  assert.match(h.alert(), /حجم تصویر/);
  assert.deepEqual(calls, ["/api/upload"]);
  assert.equal(h.closed(), 0);
});

test("an unexpected success body cannot silently discard the draft", async () => {
  const h = harness(async () => ok({}));
  h.text("عالی");
  await h.submit(); h.render();
  assert.match(h.alert(), /پاسخ معتبر/);
  assert.equal(h.closed(), 0);
  assert.equal(h.get("textarea").props.value, "عالی");
});
