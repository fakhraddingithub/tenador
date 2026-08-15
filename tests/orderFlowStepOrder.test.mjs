import test from "node:test";
import assert from "node:assert/strict";
import { buildStepSequence } from "../src/lib/flowTraversal.js";

/**
 * قراردادی که چیدمانِ گریدیِ پنل ادمین به آن تکیه می‌کند:
 * وقتی فرایند هیچ لبه‌ای ندارد، ترتیبِ آرایه‌ی nodes همان ترتیبِ مراحلی است
 * که مشتری در OrderFlowModal می‌بیند. پس جابه‌جاییِ کارت‌ها در گرید = تغییرِ
 * ترتیبِ مراحل، بدون هیچ تغییری در مدل یا API.
 */

const step = (id, extra = {}) => ({
  id,
  type: "service",
  label: id,
  required: false,
  serviceOptions: [],
  ...extra,
});

const ids = (nodes) => nodes.map((n) => n.id);

test("بدون لبه، ترتیبِ مراحل دقیقاً ترتیبِ آرایه است", () => {
  const flow = { nodes: [step("a"), step("b"), step("c")], edges: [] };
  assert.deepEqual(ids(buildStepSequence(flow)), ["a", "b", "c"]);
});

test("جابه‌جاییِ کارت‌ها ترتیبِ مراحلِ مشتری را عوض می‌کند", () => {
  const reordered = { nodes: [step("c"), step("a"), step("b")], edges: [] };
  assert.deepEqual(ids(buildStepSequence(reordered)), ["c", "a", "b"]);
});

test("فرایندِ خالی و تک‌مرحله‌ای هم درست کار می‌کنند", () => {
  assert.deepEqual(buildStepSequence({ nodes: [], edges: [] }), []);
  assert.deepEqual(buildStepSequence(null), []);
  assert.deepEqual(ids(buildStepSequence({ nodes: [step("only")], edges: [] })), ["only"]);
});

test("نبودِ فیلدِ edges (دادهٔ قدیمی) مثل آرایه‌ی خالی رفتار می‌کند", () => {
  const flow = { nodes: [step("x"), step("y")] };
  assert.deepEqual(ids(buildStepSequence(flow)), ["x", "y"]);
});

test("مهاجرتِ فرایندِ لبه‌دار به ترتیبِ آرایه‌ای، دنباله‌ی مشتری را تغییر نمی‌دهد", () => {
  // فرایندِ قدیمی: آرایه به یک ترتیب است ولی لبه‌ها ترتیبِ دیگری را دیکته می‌کنند
  const legacy = {
    nodes: [step("grip"), step("string"), step("racket")],
    edges: [
      { id: "e1", source: "racket", target: "string" },
      { id: "e2", source: "string", target: "grip" },
    ],
  };
  const before = buildStepSequence(legacy);
  assert.deepEqual(ids(before), ["racket", "string", "grip"]);

  // همان کاری که بیلدرِ جدید می‌کند: ترتیبِ اولیه از buildStepSequence خوانده
  // می‌شود و هنگام ذخیره لبه‌ها خالی می‌شوند.
  const migrated = { nodes: before, edges: [] };
  assert.deepEqual(ids(buildStepSequence(migrated)), ids(before));
});

test("مرحله‌ی جدا افتاده در فرایندِ لبه‌دار حذف نمی‌شود", () => {
  const flow = {
    nodes: [step("a"), step("b"), step("orphan")],
    edges: [{ id: "e1", source: "a", target: "b" }],
  };
  assert.deepEqual(ids(buildStepSequence(flow)), ["a", "orphan", "b"]);
});
