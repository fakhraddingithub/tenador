import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { readFile } from "node:fs/promises";

register("./aliasHooks.mjs", import.meta.url);
register("./walletOrderHooks.mjs", import.meta.url);
let server, computeAnalytics;
const from = new Date("2026-09-01T00:00:00Z");
const to = new Date("2026-09-16T23:59:59Z");
const oid = () => new mongoose.Types.ObjectId();

before(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI_TENADOR = server.getUri("euro-analytics-test");
  await mongoose.connect(process.env.MONGODB_URI_TENADOR);
  global._mongooseCache = { conn: mongoose, promise: null };
  ({ computeAnalytics } = await import("../services/analyticsService.js"));
  const db = mongoose.connection.db;
  const user = oid(), product = oid(), category = oid(), brand = oid();
  await db.collection("users").insertOne({ _id: user, name: "Test", lastName: "Customer" });
  await db.collection("products").insertOne({ _id: product, name: "Test product", priceEUR: 999999, category, brand });
  await db.collection("categories").insertOne({ _id: category, name: "Test category" });
  await db.collection("brands").insertOne({ _id: brand, name: "Test brand" });
  const order = (extra) => ({ _id: oid(), trackingCode: String(oid()), user, createdAt: new Date("2026-09-10T12:00:00Z"), totalPrice: 1000000, fulfillmentStatus: "PROCESSING", items: [{ product, unitPrice: 500000, quantity: 2 }], ...extra });
  const paid = oid();
  const mixed = order({ priceEUR: 100.75, payments: [paid], paymentsEUR: [{ amount: 20.1 }, { amount: 10.15 }], items: [{ product, unitPrice: 888888, priceEUR: 25.25, quantity: 2 }, { product, unitPrice: 999999, quantity: 1 }] });
  await db.collection("orders").insertMany([
    mixed,
    order({ priceEUR: 10.25, paymentsEUR: [{ amount: 50 }] }),
    order({ priceEUR: 0, paymentsEUR: [] }),
    order({ priceEUR: null, paymentsEUR: [{ amount: 77777 }] }),
    order({}),
    order({ priceEUR: 50000, fulfillmentStatus: "CANCELED" }),
    order({ priceEUR: 40.25, createdAt: new Date("2026-08-25T12:00:00Z"), paymentsEUR: [] }),
  ]);
  await db.collection("payments").insertOne({ _id: paid, amount: 200000, status: "PAID" });
  await db.collection("installments").insertOne({ order: mixed._id, checks: [{ amount: 300000, status: "CLEARED" }, { amount: 123456, status: "PENDING", dueDate: new Date("2026-01-01") }] });
}, { timeout: 120000 });

after(async () => { await mongoose.disconnect(); await server?.stop(); });

test("EUR uses admin order amounts/payments, excludes absent and cancelled prices, and preserves cents", async () => {
  const d = await computeAnalytics({ from, to, currency: "EUR" });
  assert.equal(d.meta.currency, "EUR");
  assert.equal(d.kpis.orders.value, 3);
  assert.equal(d.kpis.revenue.value, 111);
  assert.equal(d.kpis.revenue.prev, 40.25);
  assert.equal(d.kpis.collected.value, 40.5);
  assert.equal(d.kpis.outstanding.value, 70.5);
  assert.equal(d.kpis.aov.value, 37);
  assert.equal(d.revenue.daily[0].revenue, 111);
  assert.equal(d.heatmap.weekday.reduce((n, r) => n + r.revenue, 0), 111);
  assert.equal(d.customers.topByRevenue[0].rangeRevenue, 111);
  assert.equal(d.customers.clv.average, 151.25);
  assert.equal(d.products.top[0].revenue, 50.5);
  assert.equal(d.products.top[0].avgPrice, 25.25);
  assert.equal(d.products.top[0].units, 2);
  assert.equal(d.categories[0].revenue, 50.5);
  assert.equal(d.brands[0].revenue, 50.5);
  assert.equal(d.receivables.outstanding, 110.75);
  assert.equal(d.receivables.overdue, null);
  assert.deepEqual(d.receivables.aging, []);
  assert.ok(d.insights.every((i) => !i.text.includes("تومان")));
});

test("Toman default remains independent during concurrent EUR requests", async () => {
  const [toman, euro] = await Promise.all([computeAnalytics({ from, to }), computeAnalytics({ from, to, currency: "EUR" })]);
  assert.equal(toman.kpis.orders.value, 5);
  assert.equal(toman.kpis.revenue.value, 5000000);
  assert.equal(toman.kpis.collected.value, 500000);
  assert.equal(toman.receivables.overdue, 123456);
  assert.equal(euro.kpis.revenue.value, 111);
});

test("Empty EUR range returns empty charts and zero KPIs", async () => {
  const d = await computeAnalytics({ from: new Date("2020-01-01"), to: new Date("2020-01-02"), currency: "EUR" });
  assert.equal(d.kpis.orders.value, 0);
  assert.equal(d.kpis.revenue.value, 0);
  assert.equal(d.kpis.aov.value, 0);
  assert.deepEqual(d.revenue.daily, []);
  assert.deepEqual(d.products.list, []);
});

test("Export datasets preserve EUR cents and labels without changing Toman rounding", async () => {
  const source = (await readFile(new URL("../src/components/admin/analytics/exporter.js", import.meta.url), "utf8"))
    .replace('"./format"', JSON.stringify(new URL("../src/components/admin/analytics/format.js", import.meta.url).href));
  const { buildDatasets } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const data = await computeAnalytics({ from, to, currency: "EUR" });
  const euro = buildDatasets(data);
  assert.equal(euro.products.rows[0].revenue, 50.5);
  assert.equal(euro.products.rows[0].avgPrice, 25.25);
  assert.equal(euro.receivables.rows[0].amount, 70.5);
  assert.equal(euro.receivables.rows[0].overdue, "—");
  assert.ok(euro.products.columns.find((c) => c.key === "revenue").label.includes("یورو"));
  assert.ok(euro.revenue.columns[1].label.includes("یورو"));
  const toman = buildDatasets({ ...data, meta: { currency: "IRT" } });
  assert.equal(toman.products.rows[0].revenue, 51);
  assert.ok(toman.revenue.columns[1].label.includes("تومان"));
});
