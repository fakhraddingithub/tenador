import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getCategoryLabel } from "../utils/categoryLabel.js";

register("./categoryLabelHooks.mjs", import.meta.url);
let server, tennis, padel, racket, shared, parent;
const id = () => new mongoose.Types.ObjectId();
const request = (path) => new Request(`http://localhost${path}`);
async function get(module, path) {
  const { GET } = await import(module);
  const response = await GET(request(path));
  assert.equal(response.status, 200);
  return response.json();
}

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  await import("../models/registerModels.js");
  const models = mongoose.models;
  tennis = { _id: id(), title: "تنیس", name: "Tennis", slug: "tennis" };
  padel = { _id: id(), title: "پدل", name: "Padel", slug: "padel" };
  await models.Sport.collection.insertMany([tennis, padel]);
  parent = { _id: id(), title: "تجهیزات", name: "Equipment", slug: "equipment", sport: tennis._id, additionalSports: [padel._id] };
  racket = { _id: id(), title: "راکت", name: "Racket", slug: "racket", sport: tennis._id, parent: parent._id };
  shared = { _id: id(), title: "کفش", name: "Shoes", slug: "shoes", sport: tennis._id, additionalSports: [padel._id], parent: parent._id };
  const padelRacket = { ...racket, _id: id(), sport: padel._id, parent: null };
  await models.Category.collection.insertMany([parent, racket, shared, padelRacket]);
  const brand = { _id: id(), title: "برند", slug: "brand", name: "Brand" };
  await models.Brand.collection.insertOne(brand);
  const products = [racket, shared, padelRacket].map((category) => ({
    _id: id(), name: category.title, slug: `${category.slug}-${category.sport}`, category: category._id,
    sport: category.sport, brand: brand._id, isActive: true, variants: [], targetAudience: ["unisex"],
  }));
  await models.Product.collection.insertMany(products);
  await models.HealthCard.collection.insertOne({ category: shared._id, fields: [] });
  await models.UsedProduct.collection.insertOne({ baseProduct: products[1]._id, status: "available" });
  await models.OrderFlow.collection.insertOne({ name: "جریان", rootCategory: shared._id, nodes: [], edges: [] });
  await models.Order.collection.insertOne({
    createdAt: new Date(), totalPrice: 300, fulfillmentStatus: "PENDING", paymentStatus: "UNPAID",
    items: products.map((product) => ({ product: product._id, quantity: 1, unitPrice: 100, itemType: "product" })),
  });
});
after(async () => { await mongoose.disconnect(); await server?.stop(); });

test("navbar includes owner labels, shared labels in both sports, and structural parents", async () => {
  const { getCachedNavbar } = await import("../src/lib/navbarService.js");
  const sports = await getCachedNavbar();
  for (const sport of sports) {
    const shoes = sport.categories.find((category) => category.slug === "shoes");
    assert.equal(getCategoryLabel(shoes, { navbar: true }), "کفش");
    assert.equal(getCategoryLabel(shoes), "کفش تنیس");
    const structural = sport.categories.find((category) => category.slug === "equipment");
    assert.equal(getCategoryLabel(structural, { navbar: true }), "تجهیزات");
    assert.equal(structural.hasProducts, false);
    const ownRacket = sport.categories.find((category) => category.slug === "racket");
    assert.equal(getCategoryLabel(ownRacket, { navbar: true }), `راکت ${sport.title}`);
  }
});

test("admin lists preserve raw titles and return populated owner sports including parent categories", async () => {
  const data = await get("../src/app/api/categories/route.js", `/api/categories?sportId=${padel._id}`);
  const shoes = data.categories.find((category) => category.slug === "shoes");
  assert.equal(shoes.title, "کفش");
  assert.equal(getCategoryLabel(shoes), "کفش تنیس");
  assert.equal(getCategoryLabel(shoes.parent), "تجهیزات تنیس");
  const { products } = await get("../src/app/api/product/route.js", "/api/product?isAdmin=true");
  assert.deepEqual(products.map((product) => getCategoryLabel(product.category)).sort(), ["راکت تنیس", "راکت پدل", "کفش تنیس"].sort());
});

test("discount and campaign picker search and saved selections use the same labels", async () => {
  for (const query of ["راکت تنیس", "تنیس راکت"]) {
    const { items } = await get("../src/app/api/admin/discounts/search/route.js", `/api/admin/discounts/search?type=category&q=${encodeURIComponent(query)}`);
    assert.deepEqual(items.map((item) => item.label), ["راکت تنیس"]);
  }
  const { items } = await get("../src/app/api/admin/discounts/search/route.js", `/api/admin/discounts/search?type=category&ids=${shared._id}`);
  assert.equal(items[0].label, "کفش تنیس");
});

test("navbar search, health cards, used products and order flows carry the category owner", async () => {
  const { products } = await get("../src/app/api/compare/search/route.js", `/api/compare/search?q=${encodeURIComponent("کفش")}`);
  assert.equal(getCategoryLabel(products[0].category, { navbar: true }), "کفش");
  assert.equal(getCategoryLabel(products[0].category), "کفش تنیس");
  const { cards } = await get("../src/app/api/admin/healthcards/route.js", "/api/admin/healthcards");
  assert.equal(getCategoryLabel(cards[0].category), "کفش تنیس");
  const { items } = await get("../src/app/api/admin/used-products/route.js", "/api/admin/used-products");
  assert.equal(getCategoryLabel(items[0].baseProduct.category), "کفش تنیس");
  const { flows } = await get("../src/app/api/admin/order-flows/route.js", "/api/admin/order-flows");
  assert.equal(getCategoryLabel(flows[0].rootCategory), "کفش تنیس");
});

test("analytics uses Persian category/sport labels and preserves amounts and units", async () => {
  const { computeAnalytics } = await import("../services/analyticsService.js");
  const data = await computeAnalytics({ from: new Date(Date.now() - 60000), to: new Date(Date.now() + 60000) });
  assert.deepEqual(data.categories.map((category) => category.name).sort(), ["راکت تنیس", "راکت پدل", "کفش تنیس"].sort());
  assert.equal(data.categories.reduce((sum, category) => sum + category.revenue, 0), 300);
  assert.equal(data.categories.reduce((sum, category) => sum + category.units, 0), 3);
});
