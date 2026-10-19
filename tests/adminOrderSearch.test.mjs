// Exercise the actual route's MongoDB pipelines against an isolated database.
// Auth and connection setup are stubbed; no project database is accessed.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import * as search from "../src/lib/search.js";

let server, route, buyer, product;
let denied = null;
const User = mongoose.model("User", new mongoose.Schema({ name: String, lastName: String, phone: String, email: String, password: String }));
const Product = mongoose.model("Product", new mongoose.Schema({ name: String, mainImage: String, sku: String }));
mongoose.model("Payment", new mongoose.Schema({}, { strict: false }));
const { default: Order } = await import("../models/Order.js");

async function get(searchTerm, extra = {}) {
  return route.GET({ url: `http://localhost/api/admin/orders?${new URLSearchParams({ search: searchTerm, ...extra })}` });
}

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  const context = vm.createContext({ console, URL });
  const deps = {
    "base/models/registerModels": {},
    "base/models/Order": { default: Order },
    "base/configs/db": { default: async () => {} },
    "@/lib/search": search,
    "@/lib/requireAdminPermission": { default: async () => ({ denied }) },
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
  };
  const mod = new vm.SourceTextModule(await readFile(new URL("../src/app/api/admin/orders/route.js", import.meta.url), "utf8"), { context });
  await mod.link((name) => {
    assert.ok(deps[name], `Missing dependency: ${name}`);
    return new vm.SyntheticModule(Object.keys(deps[name]), function () {
      for (const [key, value] of Object.entries(deps[name])) this.setExport(key, value);
    }, { context });
  });
  await mod.evaluate();
  route = mod.namespace;
  buyer = await User.create({ name: "علی", lastName: "کریمی", phone: "09123456789", email: "ali.karimi+shop@example.com", password: "private" });
  product = await Product.create({ name: "راکت تست", sku: "RACKET-1" });
  const base = { user: buyer._id, items: [{ product: product._id, quantity: 1, unitPrice: 1000 }], subtotalPrice: 1000, totalPrice: 1000, paymentMethod: "BANK_RECEIPT", fulfillmentStatus: "WAITING" };
  await Order.create({ ...base, trackingCode: "123456789", paymentStatus: "PAID" });
  await Order.create({ ...base, user: new mongoose.Types.ObjectId(), trackingCode: "987654321" });
  for (let i = 0; i < 6; i++) {
    await Order.create({ ...base, trackingCode: `55500000${i}`, paymentStatus: "UNPAID" });
  }
}, { timeout: 180000 });

after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

test("tracking code, buyer name, phone and email return matching orders", async (t) => {
  for (const term of ["123456789", "۱۲۳۴۵۶۷۸۹", "١٢٣٤٥٦٧٨٩", "علی کریمی", "كريمي علي", "09123456789", "۰۹۱۲۳۴۵۶۷۸۹", "ali.karimi+shop@example.com", "ALI.KARIMI", "علی ۱۲۳۴۵۶۷۸۹"]) {
    await t.test(term, async () => {
      const result = await get(term, { paymentStatus: "PAID" });
      assert.equal(result.status, 200);
      assert.equal(result.body.pagination.total, 1);
      const [order] = result.body.orders;
      assert.equal(order.trackingCode, "123456789");
      assert.equal(order.user.name, "علی");
      assert.equal(order.user.password, undefined);
      assert.equal(order.items[0].product.name, product.name);
    });
  }
});

test("tracking searches preserve orders whose buyer no longer exists", async () => {
  const result = await get("987654321");
  assert.equal(result.status, 200);
  assert.equal(result.body.pagination.total, 1);
  assert.equal(result.body.orders[0].user, null);
});

test("search combines status filters and paginates with accurate totals", async () => {
  const result = await get("کریمی", { paymentStatus: "UNPAID", fulfillmentStatus: "WAITING", paymentMethod: "BANK_RECEIPT", limit: "5", page: "2" });
  assert.equal(result.status, 200);
  assert.equal(result.body.pagination.total, 6);
  assert.equal(result.body.pagination.totalPages, 2);
  assert.equal(result.body.orders.length, 1);
  const first = await get("کریمی", { paymentStatus: "UNPAID", limit: "5" });
  assert.equal(first.body.orders.length, 5);
  assert.ok(!first.body.orders.some((o) => String(o._id) === String(result.body.orders[0]._id)));
});

test("nonmatching and special-character queries do not fail", async () => {
  for (const term of ["missing@example.net", "[.*]نام‌ناموجود"]) {
    const result = await get(term);
    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 0);
    assert.equal(result.body.orders.length, 0);
  }
});

test("empty search still populates the ordinary order list", async () => {
  const result = await get("", { paymentStatus: "PAID" });
  assert.equal(result.status, 200);
  assert.equal(result.body.pagination.total, 1);
  assert.equal(result.body.orders[0].user.name, "علی");
  assert.equal(result.body.orders[0].items[0].product.name, product.name);
});

test("search respects admin authorization", async () => {
  denied = { status: 403 };
  try {
    assert.equal((await get("123456789")).status, 403);
  } finally {
    denied = null;
  }
});
