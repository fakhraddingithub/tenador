// services/ruleLoader.js
import mongoose from "mongoose";
import DiscountRule from "base/models/DiscountRule";
import { ruleBrandFilterPasses } from "base/utils/discountMatch";
// import redis from "base/lib/redis";

const RULE_TTL = parseInt(process.env.PRICE_CACHE_TTL || "300", 10);

export async function loadRulesForProduct(product) {
  const key = `rules:product:${product._id}`;
  // const cached = await redis.get(key);
  // if (cached) return JSON.parse(cached);

  const now = new Date();
  // تبدیل به ObjectId برای اطمینان از تطابق
  const productId = product._id ? (product._id.toString ? product._id : new mongoose.Types.ObjectId(product._id)) : null;
  const brandId = product.brand ? (product.brand.toString ? product.brand : new mongoose.Types.ObjectId(product.brand)) : null;
  const categoryId = product.category ? (product.category.toString ? product.category : new mongoose.Types.ObjectId(product.category)) : null;
  
  const queries = [
    { type: "global" }
  ];
  
  if (productId) {
    queries.push({ type: "product", targets: { $in: [productId] } });
  }
  if (brandId) {
    queries.push({ type: "brand", targets: { $in: [brandId] } });
  }
  if (categoryId) {
    queries.push({ type: "category", targets: { $in: [categoryId] } });
  }

  const rules = await DiscountRule.find({
    $and: [
      { active: true },
      { startAt: { $lte: now } },
      { endAt: { $gte: now } },
      { $or: queries }
    ]
  }).sort({ priority: 1 }).lean();

  // زیرفیلتر برند برای قوانین category — منطقِ مشترک در utils/discountMatch
  const filtered = rules.filter((r) => ruleBrandFilterPasses(r, brandId));

  // await redis.set(key, JSON.stringify(filtered), "EX", RULE_TTL);
  return filtered;
}
