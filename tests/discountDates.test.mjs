// Run: node --test --test-timeout=180000 tests/discountDates.test.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { validateDiscountDates } from "../src/lib/discountDateValidation.js";
import { discountWindowFilter } from "../utils/discountWindow.js";

// Only framework/auth/cache boundaries are stubbed. Routes, models, MongoDB
// queries and the pricing engine below execute their production code.
const stubs = {
  "base/configs/db": "export default async function() {}",
  "@/lib/requireAdminPermission": "export default async function() { return {}; }",
  "@/lib/revalidate": "export function revalidateContent() {}",
  "next/server": "export const NextResponse = Response;",
  "@/lib/Exchangerate": "export async function getCachedRate(){return 1;} export function eurToToman(v,r){return v*r;}",
};
registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    // Next handles this legacy side-effect require; plain Node ESM does not.
    // Sport is already imported by registerModels in this test.
    if (url.endsWith("/models/Athlete.js")) {
      return { ...loaded, source: String(loaded.source).replace('require("./Sport")', '') };
    }
    if (url.includes("/models/") && String(loaded.source).includes('require("mongoose")') && String(loaded.source).includes("export default")) {
      return { ...loaded, source: String(loaded.source).replace(/const (?:mongoose|\{ default: mongoose \}) = require\("mongoose"\);/, 'import mongoose from "mongoose";') };
    }
    return loaded;
  },
  resolve(specifier, context, nextResolve) {
    if (stubs[specifier]) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
    if (specifier.startsWith("base/") || specifier.startsWith("@/")) {
      const relative = specifier.startsWith("base/") ? specifier.slice(5) : `src/${specifier.slice(2)}`;
      const url = new URL(`../${relative}`, import.meta.url);
      if (!existsSync(fileURLToPath(url))) url.pathname += ".js";
      return nextResolve(url.href, context);
    }
    return nextResolve(specifier, context);
  },
});
await import("../models/registerModels.js");
const { default: DiscountRule } = await import("../models/DiscountRule.js");
const { default: Coupon } = await import("../models/Coupon.js");
const rulesRoute = await import("../src/app/api/admin/discounts/route.js");
const ruleRoute = await import("../src/app/api/admin/discounts/[id]/route.js");
const couponsRoute = await import("../src/app/api/admin/coupons/route.js");
const couponRoute = await import("../src/app/api/admin/coupons/[id]/route.js");
const { loadActiveRules, validateCoupon, attachListingPrices, computeProductPrice } = await import("../services/priceEngine.js");
let server;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "discount-dates-test" });
});
after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});
const request = (body) => ({ json: async () => body });
const params = (id) => ({ params: Promise.resolve({ id: String(id) }) });

test("optional dates retain Iran time, reject invalid values and validate partial edits", () => {
  for (const value of [undefined, null, "", "   "]) {
    assert.deepEqual(validateDiscountDates({ startAt: value, endAt: value }), { startAt: null, endAt: null });
  }
  for (const value of ["invalid", false, 123, {}, []]) {
    assert.ok(validateDiscountDates({ startAt: value }).error);
    assert.ok(validateDiscountDates({ endAt: value }).error);
  }
  const current = validateDiscountDates({ startAt: "2026-09-01T12:00", endAt: "2026-09-10T12:00" });
  assert.equal(current.startAt.toISOString(), "2026-09-01T08:30:00.000Z");
  assert.deepEqual(validateDiscountDates({}, current), current);
  assert.ok(validateDiscountDates({ startAt: "2026-09-11T12:00" }, current).error);
  assert.ok(validateDiscountDates({ endAt: "2026-09-01T12:00" }, current).error);
  assert.equal(validateDiscountDates({ endAt: "" }, current).endAt, null);
});

for (const [name, Model, collectionRoute, itemRoute, base] of [
  ["rule", DiscountRule, rulesRoute, ruleRoute, { title: "Test", type: "global", discount: { kind: "percent", value: 10 } }],
  ["coupon", Coupon, couponsRoute, couponRoute, { code: "OPTIONAL", discount: { kind: "percent", value: 10 } }],
]) {
  test(`${name}: create all window shapes, clear dates, preserve omitted dates and reject invalid edits`, async () => {
    const windows = [
      {}, { startAt: "", endAt: "" }, { startAt: null, endAt: null },
      { startAt: "2020-01-01T12:00" }, { endAt: "2099-01-01T12:00" },
      { startAt: "2020-01-01T12:00", endAt: "2099-01-01T12:00" },
    ];
    for (const [i, window] of windows.entries()) {
      const res = await collectionRoute.POST(request({ ...base, ...(name === "coupon" ? { code: `OPTIONAL_${i}` } : {}), ...window }));
      assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
      const body = await res.json();
      const doc = body.coupon || body;
      assert.equal(doc.startAt ?? null, window.startAt ? "2020-01-01T08:30:00.000Z" : null);
      assert.equal(doc.endAt ?? null, window.endAt ? "2099-01-01T08:30:00.000Z" : null);
      assert.equal((await itemRoute.PATCH(request({ active: false }), params(doc._id))).status, 200);
      assert.equal((await Model.findById(doc._id)).endAt?.toISOString() ?? null, doc.endAt);
      assert.equal((await itemRoute.PATCH(request({ startAt: "", endAt: null, active: true }), params(doc._id))).status, 200);
      const cleared = await Model.findById(doc._id);
      assert.equal(cleared.startAt, null);
      assert.equal(cleared.endAt, null);
    }
    const doc = await Model.create({ ...base, startAt: new Date("2026-01-01"), endAt: new Date("2026-02-01") });
    for (const patch of [{ startAt: "2026-03-01T12:00" }, { endAt: "2025-12-01T12:00" }, { endAt: "broken" }]) {
      const res = await itemRoute.PATCH(request(patch), params(doc._id));
      assert.ok([400, 422].includes(res.status));
      assert.equal((await Model.findById(doc._id)).endAt.toISOString(), "2026-02-01T00:00:00.000Z");
    }
    for (const window of [{ startAt: "broken" }, { startAt: "2026-02-01T12:00", endAt: "2026-01-01T12:00" }]) {
      const res = await collectionRoute.POST(request({ ...base, ...window }));
      assert.ok([400, 422].includes(res.status));
    }
    await Model.deleteMany({});
  });
}

test("Mongo window filter includes missing/null/one-sided dates and respects both inclusive bounds and targets", async () => {
  const now = new Date("2026-09-10T00:00:00Z");
  const past = new Date(now.getTime() - 1);
  const future = new Date(now.getTime() + 1);
  const windows = [{}, { startAt: null, endAt: null }, { startAt: past }, { endAt: future }, { startAt: now, endAt: now }, { startAt: future }, { endAt: past }, { active: false }, { type: "brand" }];
  await DiscountRule.collection.insertMany(windows.map((w, i) => ({ title: String(i), type: "global", active: true, ...w })));
  const found = await DiscountRule.find({ active: true, ...discountWindowFilter(now), $or: [{ type: "global" }] }).sort({ title: 1 });
  assert.deepEqual(found.map((d) => d.title), ["0", "1", "2", "3", "4"]);
  await DiscountRule.deleteMany({});
});

test("pricing applies timeless rules/coupons and still enforces schedule, minimum cart, target and usage limits", async () => {
  const product = { _id: new mongoose.Types.ObjectId(), basePrice: 1000 };
  const rule = await DiscountRule.create({ title: "Always", type: "global", discount: { kind: "percent", value: 10 } });
  assert.deepEqual((await loadActiveRules(product)).map(r => String(r._id)), [String(rule._id)]);
  assert.equal((await computeProductPrice(product, 1)).finalPriceToman, 900);
  assert.equal((await attachListingPrices([product], 1))[0].finalPriceToman, 900);
  rule.startAt = new Date("2099-01-01"); await rule.save();
  assert.equal((await loadActiveRules(product)).length, 0);
  assert.equal((await attachListingPrices([product], 1))[0].finalPriceToman, 1000);
  const coupon = await Coupon.create({ code: "ALWAYS", discount: { kind: "percent", value: 10 }, perUserLimit: null });
  assert.equal((await validateCoupon("always", null, 1000)).discount, 100);
  coupon.minCartValue = 2000; await coupon.save();
  assert.equal((await validateCoupon("always", null, 1000)).valid, false);
  coupon.minCartValue = 0; coupon.usageLimit = 0; await coupon.save();
  assert.equal((await validateCoupon("always", null, 1000)).valid, false);
  coupon.usageLimit = null; coupon.perUserLimit = 1; await coupon.save();
  const userId = new mongoose.Types.ObjectId();
  await mongoose.models.Order.collection.insertOne({ user: userId, coupon: { code: "ALWAYS" } });
  assert.equal((await validateCoupon("always", userId, 1000)).valid, false);
  coupon.usageLimit = null; coupon.applicableTo = "product"; coupon.targets = [product._id]; await coupon.save();
  assert.equal((await validateCoupon("always", null, 1000)).valid, false);
  assert.equal((await validateCoupon("always", null, 1000, [{ productId: product._id, lineTotalToman: 1000 }])).discount, 100);
  coupon.applicableTo = "all"; coupon.endAt = new Date("2020-01-01"); await coupon.save();
  assert.equal((await validateCoupon("always", null, 1000)).valid, false);
  coupon.endAt = null; coupon.startAt = new Date("2099-01-01"); await coupon.save();
  assert.equal((await validateCoupon("always", null, 1000)).valid, false);
  coupon.startAt = null; coupon.active = false; await coupon.save();
  assert.equal((await validateCoupon("always", null, 1000)).valid, false);
});
