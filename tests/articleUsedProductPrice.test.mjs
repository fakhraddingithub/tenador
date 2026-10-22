/**
 * tests/articleUsedProductPrice.test.mjs
 *
 * قیمتِ کالای دست‌دوم به یورو ذخیره می‌شود؛ کارتِ مقاله آن را با برچسبِ «تومان»
 * نشان می‌دهد، پس resolveArticleEntities باید — مثلِ صفحه‌ی دست‌دوم — با نرخِ روز
 * به تومان ببرد. پیش از این عددِ یورو با برچسبِ تومان دیده می‌شد.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);
register("./listingFiltersHooks.mjs", import.meta.url);
// a known rate (registered last, so it runs before the shared stub, which returns 1)
register(`data:text/javascript,export async function load(url, context, next) {
  if (url.endsWith("/src/lib/Exchangerate.js")) return { format: "module", shortCircuit: true, source: "export const getCachedRate = async () => 98765;" };
  return next(url, context);
}`);
process.env.MONGODB_URI_TENADOR = "mongodb://127.0.0.1:1/unused-test-placeholder";

const { resolveArticleEntities } = await import("base/services/publicArticle.service");
const { default: UsedProduct } = await import("base/models/UsedProduct");

let server;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri("article-used-price"));
  global._mongooseCache.conn = mongoose;
});
after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

test("used-product cards in an article get their price in toman, not euro", async () => {
  const _id = new mongoose.Types.ObjectId();
  await UsedProduct.collection.insertOne({ _id, name: "Wilson Clash 100", price: 120, status: "available" });

  const entities = await resolveArticleEntities({ blocks: [{ id: "u", type: "usedProducts", data: { products: [String(_id)] } }] });

  // 120 × 98765 = 11,851,800 → rounded down to the thousand, exactly as on /second-hand
  assert.equal(entities.maps.usedProducts[String(_id)].price, 11851000);
});
