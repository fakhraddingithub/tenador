/**
 * services/analyticsService.js
 *
 * موتور تحلیل مالی و هوش فروش — همه‌ی محاسبات از داده‌ی واقعیِ سیستم با
 * aggregation pipeline انجام می‌شود (بدون N+1).
 *
 * تعریف‌های مالیِ مورد استفاده (برای سازگاری درونی):
 *   درآمد (revenue)        = مجموع totalPrice سفارش‌های غیرلغوشده در بازه
 *   وصول‌شده (collected)   = برای هر سفارش، min(totalPrice, پرداخت‌های PAID + چک‌های CLEARED)
 *   مانده (outstanding)    = مجموع max(0, totalPrice − collected)
 *   نرخ وصول (collectRate) = collected / revenue
 *
 * مانده‌ی معوق و سررسیدها از چک‌های اقساطی (با dueDate) محاسبه می‌شود.
 */

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Order from "base/models/Order";
import Installment from "base/models/Installment";
import User from "base/models/User";

const DAY_MS = 24 * 60 * 60 * 1000;

const USER_FULL_NAME_EXPR = {
  $let: {
    vars: {
      fullName: {
        $trim: {
          input: {
            $concat: [
              { $ifNull: ["$user.name", ""] },
              " ",
              { $ifNull: ["$user.lastName", ""] },
            ],
          },
        },
      },
    },
    in: { $cond: [{ $ne: ["$$fullName", ""] }, "$$fullName", "\u2014"] },
  },
};

// سفارش‌های معتبر برای محاسبه‌ی درآمد (لغوشده‌ها کنار گذاشته می‌شوند)
const NON_CANCELED = { fulfillmentStatus: { $ne: "CANCELED" } };

// زیرعبارتِ «وصول‌شده‌ی هر سفارش» — برای استفاده‌ی مشترک در pipelineها.
// نیازمند فیلدهای الحاقیِ paidPayments و clearedChecks است.
const COLLECTED_EXPR = {
  $min: ["$totalPrice", { $add: ["$paidPayments", "$clearedChecks"] }],
};

// مراحل الحاقِ پرداخت‌ها و چک‌های اقساط به هر سفارش
function lookupPaymentsAndChecks() {
  return [
    {
      $lookup: {
        from: "payments",
        localField: "payments",
        foreignField: "_id",
        as: "pmts",
      },
    },
    {
      $lookup: {
        from: "installments",
        localField: "_id",
        foreignField: "order",
        as: "inst",
      },
    },
    {
      $addFields: {
        paidPayments: {
          $sum: {
            $map: {
              input: { $filter: { input: "$pmts", as: "p", cond: { $eq: ["$$p.status", "PAID"] } } },
              as: "p",
              in: "$$p.amount",
            },
          },
        },
        clearedChecks: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: { $ifNull: [{ $arrayElemAt: ["$inst.checks", 0] }, []] },
                  as: "c",
                  cond: { $eq: ["$$c.status", "CLEARED"] },
                },
              },
              as: "c",
              in: "$$c.amount",
            },
          },
        },
      },
    },
  ];
}

/* ─────────────────────────────────────────────────────────────────────────
 *  بخش‌های محاسباتی
 * ───────────────────────────────────────────────────────────────────────── */

// KPIهای هسته‌ای برای یک بازه‌ی دلخواه
async function coreMetrics(from, to) {
  const match = { createdAt: { $gte: from, $lte: to }, ...NON_CANCELED };
  const res = await Order.aggregate([
    { $match: match },
    ...lookupPaymentsAndChecks(),
    { $addFields: { collected: COLLECTED_EXPR } },
    { $addFields: { outstanding: { $max: [0, { $subtract: ["$totalPrice", "$collected"] }] } } },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$totalPrice" },
        orders: { $sum: 1 },
        collected: { $sum: "$collected" },
        outstanding: { $sum: "$outstanding" },
        customers: { $addToSet: "$user" },
        units: { $sum: { $sum: "$items.quantity" } },
      },
    },
    {
      $project: {
        _id: 0,
        revenue: 1,
        orders: 1,
        collected: 1,
        outstanding: 1,
        units: 1,
        customers: { $size: "$customers" },
      },
    },
  ]);

  const m = res[0] || { revenue: 0, orders: 0, collected: 0, outstanding: 0, units: 0, customers: 0 };
  m.aov = m.orders > 0 ? Math.round(m.revenue / m.orders) : 0;
  m.collectionRate = m.revenue > 0 ? +((m.collected / m.revenue) * 100).toFixed(1) : 0;
  return m;
}

// مشتری‌های جدید/بازگشتی در بازه (بر اساس اولین سفارشِ تاریخی)
async function customerMix(from, to) {
  const res = await Order.aggregate([
    { $match: NON_CANCELED },
    {
      $group: {
        _id: "$user",
        firstOrder: { $min: "$createdAt" },
        ordersInRange: {
          $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", from] }, { $lte: ["$createdAt", to] }] }, 1, 0] },
        },
      },
    },
    { $match: { ordersInRange: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        active: { $sum: 1 },
        newCustomers: { $sum: { $cond: [{ $gte: ["$firstOrder", from] }, 1, 0] } },
      },
    },
  ]);
  const r = res[0] || { active: 0, newCustomers: 0 };
  return { active: r.active, newCustomers: r.newCustomers, returning: r.active - r.newCustomers };
}

// سری زمانیِ روزانه‌ی درآمد و تعداد سفارش در بازه
async function dailySeries(from, to) {
  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to }, ...NON_CANCELED } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Tehran" } },
        revenue: { $sum: "$totalPrice" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", revenue: 1, orders: 1 } },
  ]);
  return rows;
}

// سری ماهانه‌ی ۱۲ ماه گذشته (مستقل از فیلتر) برای نمودار روند بلندمدت
async function monthlySeries(to) {
  const start = new Date(to.getTime());
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lte: to }, ...NON_CANCELED } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Tehran" } },
        revenue: { $sum: "$totalPrice" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, month: "$_id", revenue: 1, orders: 1 } },
  ]);
  return rows;
}

// هیت‌مپ: درآمد بر اساس روز هفته و روز ماه
async function heatmaps(from, to) {
  const match = { createdAt: { $gte: from, $lte: to }, ...NON_CANCELED };
  const [weekday, dayOfMonth] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dayOfWeek: { date: "$createdAt", timezone: "Asia/Tehran" } }, // 1=یکشنبه ... 7=شنبه
          revenue: { $sum: "$totalPrice" },
          orders: { $sum: 1 },
        },
      },
      { $project: { _id: 0, dow: "$_id", revenue: 1, orders: 1 } },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dayOfMonth: { date: "$createdAt", timezone: "Asia/Tehran" } },
          revenue: { $sum: "$totalPrice" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, day: "$_id", revenue: 1, orders: 1 } },
    ]),
  ]);
  return { weekday, dayOfMonth };
}

// تحلیل مطالبات: سطل‌بندیِ سنیِ چک‌های پرداخت‌نشده + بدهیِ هر مشتری
async function receivables(now = new Date()) {
  const rows = await Installment.aggregate([
    { $unwind: "$checks" },
    { $match: { "checks.status": { $in: ["PENDING", "BOUNCED"] } } },
    {
      $addFields: {
        ageDays: { $divide: [{ $subtract: [now, "$checks.dueDate"] }, DAY_MS] },
      },
    },
    {
      $addFields: {
        bucket: {
          $switch: {
            branches: [
              { case: { $lt: ["$ageDays", 0] }, then: "current" },
              { case: { $lte: ["$ageDays", 30] }, then: "d0_30" },
              { case: { $lte: ["$ageDays", 60] }, then: "d31_60" },
              { case: { $lte: ["$ageDays", 90] }, then: "d61_90" },
            ],
            default: "d90_plus",
          },
        },
      },
    },
    {
      $facet: {
        buckets: [
          { $group: { _id: "$bucket", amount: { $sum: "$checks.amount" }, count: { $sum: 1 } } },
        ],
        byCustomer: [
          { $group: { _id: "$order", amount: { $sum: "$checks.amount" }, overdue: { $sum: { $cond: [{ $gt: ["$ageDays", 0] }, "$checks.amount", 0] } }, checks: { $sum: 1 }, nextDue: { $min: "$checks.dueDate" } } },
          {
            $lookup: { from: "orders", localField: "_id", foreignField: "_id", as: "order" },
          },
          { $addFields: { order: { $arrayElemAt: ["$order", 0] } } },
          {
            $lookup: { from: "users", localField: "order.user", foreignField: "_id", as: "user" },
          },
          { $addFields: { user: { $arrayElemAt: ["$user", 0] } } },
          {
            $project: {
              _id: 0,
              orderId: "$_id",
              trackingCode: "$order.trackingCode",
              customer: USER_FULL_NAME_EXPR,
              phone: { $ifNull: ["$user.phone", ""] },
              amount: 1,
              overdue: 1,
              checks: 1,
              nextDue: 1,
            },
          },
          { $sort: { amount: -1 } },
          { $limit: 50 },
        ],
        totals: [
          {
            $group: {
              _id: null,
              outstanding: { $sum: "$checks.amount" },
              overdue: { $sum: { $cond: [{ $gt: ["$ageDays", 0] }, "$checks.amount", 0] } },
            },
          },
        ],
      },
    },
  ]);

  const f = rows[0] || { buckets: [], byCustomer: [], totals: [] };
  const bucketMap = Object.fromEntries(f.buckets.map((b) => [b._id, { amount: b.amount, count: b.count }]));
  const aging = ["current", "d0_30", "d31_60", "d61_90", "d90_plus"].map((key) => ({
    key,
    amount: bucketMap[key]?.amount || 0,
    count: bucketMap[key]?.count || 0,
  }));

  return {
    aging,
    byCustomer: f.byCustomer,
    outstanding: f.totals[0]?.outstanding || 0,
    overdue: f.totals[0]?.overdue || 0,
  };
}

// رتبه‌بندیِ مشتری‌ها (درآمد، تعداد سفارش) + بخش‌بندی + CLV
async function customerAnalytics(from, to) {
  // همه‌ی سفارش‌ها (برای CLV/segmentation تاریخی) + درآمد در بازه
  const rows = await Order.aggregate([
    { $match: NON_CANCELED },
    {
      $group: {
        _id: "$user",
        lifetimeRevenue: { $sum: "$totalPrice" },
        lifetimeOrders: { $sum: 1 },
        lastOrder: { $max: "$createdAt" },
        firstOrder: { $min: "$createdAt" },
        rangeRevenue: {
          $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", from] }, { $lte: ["$createdAt", to] }] }, "$totalPrice", 0] },
        },
        rangeOrders: {
          $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", from] }, { $lte: ["$createdAt", to] }] }, 1, 0] },
        },
      },
    },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $addFields: { user: { $arrayElemAt: ["$user", 0] } } },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: USER_FULL_NAME_EXPR,
        phone: { $ifNull: ["$user.phone", ""] },
        lifetimeRevenue: 1,
        lifetimeOrders: 1,
        lastOrder: 1,
        firstOrder: 1,
        rangeRevenue: 1,
        rangeOrders: 1,
        aov: { $cond: [{ $gt: ["$lifetimeOrders", 0] }, { $divide: ["$lifetimeRevenue", "$lifetimeOrders"] }, 0] },
      },
    },
  ]);

  const now = to.getTime();
  const atRiskThreshold = 90 * DAY_MS; // بیش از ۹۰ روز بدون خرید
  let vip = 0, repeat = 0, oneTime = 0, atRisk = 0, highValue = 0;
  const clvValues = [];

  // آستانه‌ی مشتریِ پرارزش = میانگین + انحراف ساده (اینجا: ۲ برابر میانگین CLV)
  const totalCustomers = rows.length;
  const avgClv =
    totalCustomers > 0 ? rows.reduce((s, r) => s + r.lifetimeRevenue, 0) / totalCustomers : 0;

  for (const r of rows) {
    clvValues.push(r.lifetimeRevenue);
    if (r.lifetimeOrders >= 3 && r.lifetimeRevenue >= avgClv * 2) vip++;
    else if (r.lifetimeOrders >= 2) repeat++;
    else oneTime++;
    if (r.lifetimeRevenue >= avgClv * 2) highValue++;
    if (now - new Date(r.lastOrder).getTime() > atRiskThreshold && r.lifetimeOrders >= 2) atRisk++;
  }

  const topByRevenue = [...rows].sort((a, b) => b.rangeRevenue - a.rangeRevenue).filter((r) => r.rangeRevenue > 0).slice(0, 10);
  const topByOrders = [...rows].sort((a, b) => b.rangeOrders - a.rangeOrders).filter((r) => r.rangeOrders > 0).slice(0, 10);
  const topByAov = [...rows].filter((r) => r.lifetimeOrders > 0).sort((a, b) => b.aov - a.aov).slice(0, 10);

  return {
    segmentation: { vip, repeat, oneTime, atRisk, highValue, total: totalCustomers },
    clv: { average: Math.round(avgClv), perCustomer: totalCustomers > 0 ? Math.round(avgClv) : 0 },
    topByRevenue,
    topByOrders,
    topByAov,
  };
}

// عملکرد محصول/دسته/برند — با unwind آیتم‌ها و join محصول (یک‌بار)
async function productCategoryBrand(from, to) {
  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to }, ...NON_CANCELED } },
    { $unwind: "$items" },
    { $match: { "items.itemType": { $ne: "used_product" }, "items.product": { $ne: null } } },
    {
      $group: {
        _id: "$items.product",
        revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
        units: { $sum: "$items.quantity" },
        orders: { $addToSet: "$_id" },
      },
    },
    { $addFields: { orderCount: { $size: "$orders" } } },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
        pipeline: [{ $project: { name: 1, mainImage: 1, category: 1, brand: 1, sku: 1 } }],
      },
    },
    { $addFields: { product: { $arrayElemAt: ["$product", 0] } } },
    {
      $lookup: { from: "categories", localField: "product.category", foreignField: "_id", as: "cat", pipeline: [{ $project: { name: 1 } }] },
    },
    {
      $lookup: { from: "brands", localField: "product.brand", foreignField: "_id", as: "brand", pipeline: [{ $project: { name: 1 } }] },
    },
    {
      $project: {
        _id: 0,
        productId: "$_id",
        name: { $ifNull: ["$product.name", "—"] },
        image: "$product.mainImage",
        sku: "$product.sku",
        categoryId: { $arrayElemAt: ["$cat._id", 0] },
        categoryName: { $ifNull: [{ $arrayElemAt: ["$cat.name", 0] }, "بدون دسته"] },
        brandId: { $arrayElemAt: ["$brand._id", 0] },
        brandName: { $ifNull: [{ $arrayElemAt: ["$brand.name", 0] }, "بدون برند"] },
        revenue: 1,
        units: 1,
        orderCount: 1,
        avgPrice: { $cond: [{ $gt: ["$units", 0] }, { $divide: ["$revenue", "$units"] }, 0] },
      },
    },
  ]);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0) || 1;
  const products = rows.map((r) => ({ ...r, avgPrice: Math.round(r.avgPrice), contribution: +((r.revenue / totalRevenue) * 100).toFixed(1) }));

  const topProducts = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const topByUnits = [...products].sort((a, b) => b.units - a.units).slice(0, 10);
  const underperformers = [...products].sort((a, b) => a.revenue - b.revenue).slice(0, 8);

  // تجمیع دسته‌بندی
  const catMap = new Map();
  const brandMap = new Map();
  for (const p of products) {
    const c = catMap.get(p.categoryName) || { name: p.categoryName, revenue: 0, units: 0, orders: 0 };
    c.revenue += p.revenue; c.units += p.units; c.orders += p.orderCount;
    catMap.set(p.categoryName, c);
    const b = brandMap.get(p.brandName) || { name: p.brandName, revenue: 0, units: 0, orders: 0 };
    b.revenue += p.revenue; b.units += p.units; b.orders += p.orderCount;
    brandMap.set(p.brandName, b);
  }
  const categories = [...catMap.values()].map((c) => ({ ...c, share: +((c.revenue / totalRevenue) * 100).toFixed(1) })).sort((a, b) => b.revenue - a.revenue);
  const brands = [...brandMap.values()].map((b) => ({ ...b, share: +((b.revenue / totalRevenue) * 100).toFixed(1) })).sort((a, b) => b.revenue - a.revenue);

  return { products, topProducts, topByUnits, underperformers, categories, brands, productTotalRevenue: rows.length ? totalRevenue : 0 };
}

/* ─────────────────────────────────────────────────────────────────────────
 *  تابع اصلی
 * ───────────────────────────────────────────────────────────────────────── */

function pctChange(curr, prev) {
  if (!prev) return curr > 0 ? 100 : 0;
  return +(((curr - prev) / prev) * 100).toFixed(1);
}

// رشدِ یک معیار بین دو بازه‌ی مطلق (برای رشد ماهانه/فصلی/سالانه)
async function periodRevenue(from, to) {
  const r = await Order.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to }, ...NON_CANCELED } },
    { $group: { _id: null, revenue: { $sum: "$totalPrice" } } },
  ]);
  return r[0]?.revenue || 0;
}

async function growthBlocks(now) {
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const startOfQuarter = (d) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  const startOfYear = (d) => new Date(d.getFullYear(), 0, 1);

  const mStart = startOfMonth(now);
  const mPrevStart = new Date(mStart.getFullYear(), mStart.getMonth() - 1, 1);
  const qStart = startOfQuarter(now);
  const qPrevStart = new Date(qStart.getFullYear(), qStart.getMonth() - 3, 1);
  const yStart = startOfYear(now);
  const yPrevStart = new Date(yStart.getFullYear() - 1, 0, 1);

  const [mCurr, mPrev, qCurr, qPrev, yCurr, yPrev] = await Promise.all([
    periodRevenue(mStart, now),
    periodRevenue(mPrevStart, new Date(mStart.getTime() - 1)),
    periodRevenue(qStart, now),
    periodRevenue(qPrevStart, new Date(qStart.getTime() - 1)),
    periodRevenue(yStart, now),
    periodRevenue(yPrevStart, new Date(yStart.getTime() - 1)),
  ]);

  return {
    monthly: { current: mCurr, previous: mPrev, change: pctChange(mCurr, mPrev) },
    quarterly: { current: qCurr, previous: qPrev, change: pctChange(qCurr, qPrev) },
    yearly: { current: yCurr, previous: yPrev, change: pctChange(yCurr, yPrev) },
  };
}

// تولید کارت‌های بینش خودکار از داده‌ی محاسبه‌شده
function buildInsights({ core, prevCore, pcb, customers, receivables: recv, heatmap, growth }) {
  const insights = [];
  const fmt = (n) => new Intl.NumberFormat("fa-IR").format(Math.round(n));

  // پیکِ روز هفته
  if (heatmap.weekday?.length) {
    const WD = ["", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
    const peak = [...heatmap.weekday].sort((a, b) => b.revenue - a.revenue)[0];
    if (peak && peak.revenue > 0) {
      insights.push({ type: "peak", tone: "info", text: `بیشترین فروش در روز «${WD[peak.dow] || peak.dow}» رخ می‌دهد (${fmt(peak.revenue)} تومان).` });
    }
  }
  // سهم دسته‌ی برتر
  if (pcb.categories?.length && pcb.categories[0].share > 0) {
    const c = pcb.categories[0];
    insights.push({ type: "category", tone: "success", text: `دسته‌ی «${c.name}» ${c.share}٪ از درآمد این بازه را تأمین کرده است.` });
  }
  // سهم مشتری برتر
  if (customers.topByRevenue?.length && core.revenue > 0) {
    const t = customers.topByRevenue[0];
    const share = +((t.rangeRevenue / core.revenue) * 100).toFixed(1);
    if (share > 0) insights.push({ type: "customer", tone: "info", text: `مشتری «${t.name}» معادل ${share}٪ از کل درآمد این بازه است.` });
  }
  // هشدار مطالبات
  if (recv.overdue > 0) {
    insights.push({ type: "receivable", tone: "warning", text: `${fmt(recv.overdue)} تومان از مطالبات اقساطی سررسید گذشته و معوق است.` });
  }
  // روند درآمد
  const revChange = pctChange(core.revenue, prevCore.revenue);
  if (revChange !== 0) {
    insights.push({
      type: "trend",
      tone: revChange >= 0 ? "success" : "danger",
      text: revChange >= 0
        ? `درآمد نسبت به بازه‌ی قبل ${revChange}٪ رشد کرده است.`
        : `درآمد نسبت به بازه‌ی قبل ${Math.abs(revChange)}٪ کاهش یافته است.`,
    });
  }
  // برند برتر
  if (pcb.brands?.length && pcb.brands[0].share > 0) {
    const b = pcb.brands[0];
    insights.push({ type: "brand", tone: "info", text: `برند «${b.name}» با ${b.share}٪ سهمِ درآمد، پرفروش‌ترین برند بازه است.` });
  }
  // محصول کم‌فروش
  if (pcb.underperformers?.length) {
    const u = pcb.underperformers[0];
    if (u.units > 0) insights.push({ type: "product", tone: "warning", text: `محصول «${u.name}» با تنها ${fmt(u.units)} فروش، نیازمند بازنگری قیمت/تبلیغ است.` });
  }

  return insights;
}

/**
 * محاسبه‌ی کاملِ تحلیل‌ها برای یک بازه.
 * @param {Object} opts
 * @param {Date} opts.from
 * @param {Date} opts.to
 */
export async function computeAnalytics({ from, to }) {
  await connectToDB();

  const now = new Date();
  const duration = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(from.getTime() - 1 - duration);

  const [
    core,
    prevCore,
    mix,
    daily,
    monthly,
    heatmap,
    recv,
    customers,
    pcb,
    growth,
  ] = await Promise.all([
    coreMetrics(from, to),
    coreMetrics(prevFrom, prevTo),
    customerMix(from, to),
    dailySeries(from, to),
    monthlySeries(to),
    heatmaps(from, to),
    receivables(now),
    customerAnalytics(from, to),
    productCategoryBrand(from, to),
    growthBlocks(now),
  ]);

  // KPIهای اجراییِ با مقایسه‌ی بازه‌ی قبل
  const kpis = {
    revenue: { value: core.revenue, prev: prevCore.revenue, change: pctChange(core.revenue, prevCore.revenue) },
    collected: { value: core.collected, prev: prevCore.collected, change: pctChange(core.collected, prevCore.collected) },
    outstanding: { value: core.outstanding, prev: prevCore.outstanding, change: pctChange(core.outstanding, prevCore.outstanding) },
    orders: { value: core.orders, prev: prevCore.orders, change: pctChange(core.orders, prevCore.orders) },
    aov: { value: core.aov, prev: prevCore.aov, change: pctChange(core.aov, prevCore.aov) },
    customers: { value: mix.active, prev: null, change: null },
    newCustomers: { value: mix.newCustomers, prev: null, change: null },
    returningCustomers: { value: mix.returning, prev: null, change: null },
    collectionRate: { value: core.collectionRate, prev: prevCore.collectionRate, change: pctChange(core.collectionRate, prevCore.collectionRate) },
    revenueGrowth: { value: pctChange(core.revenue, prevCore.revenue), prev: null, change: null },
    monthlyGrowth: { value: growth.monthly.change, current: growth.monthly.current, previous: growth.monthly.previous },
    quarterlyGrowth: { value: growth.quarterly.change, current: growth.quarterly.current, previous: growth.quarterly.previous },
    yearlyGrowth: { value: growth.yearly.change, current: growth.yearly.current, previous: growth.yearly.previous },
  };

  const insights = buildInsights({ core, prevCore, pcb, customers, receivables: recv, heatmap, growth });

  return {
    meta: {
      from: from.toISOString(),
      to: to.toISOString(),
      prevFrom: prevFrom.toISOString(),
      prevTo: prevTo.toISOString(),
      generatedAt: now.toISOString(),
    },
    kpis,
    revenue: { daily, monthly },
    heatmap,
    receivables: recv,
    customers,
    products: {
      list: pcb.products,
      top: pcb.topProducts,
      topByUnits: pcb.topByUnits,
      underperformers: pcb.underperformers,
    },
    categories: pcb.categories,
    brands: pcb.brands,
    insights,
  };
}
