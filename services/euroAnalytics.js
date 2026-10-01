import "base/models/registerModels";
import Order from "base/models/Order";

// Cash receipts are dated events, independent of order creation and priceEUR.
// Never use order.updatedAt: editing unrelated fields must not move a receipt.
export async function euroCollections(from, to) {
  const rows = await Order.aggregate([
    { $match: { fulfillmentStatus: { $ne: "CANCELED" }, "paymentsEUR.0": { $exists: true } } },
    { $unwind: "$paymentsEUR" },
    { $set: { paymentDate: { $ifNull: ["$paymentsEUR.confirmedAt", "$paymentsEUR.createdAt"] } } },
    { $match: { paymentDate: { $gte: from, $lte: to }, "paymentsEUR.amount": { $type: "number", $gt: 0 } } },
    { $group: {
      _id: { $dateToString: { date: "$paymentDate", format: "%Y-%m-%d", timezone: "Asia/Tehran" } },
      amount: { $sum: "$paymentsEUR.amount" }, count: { $sum: 1 },
    } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", amount: { $round: ["$amount", 2] }, count: 1 } },
  ]);
  return {
    total: Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
    count: rows.reduce((sum, row) => sum + row.count, 0),
    daily: rows,
  };
}

// Only manually recorded order amounts qualify. Zero is recorded; null is not.
export function aggregateEuroOrders(pipeline) {
  const [first, ...rest] = pipeline;
  return Order.aggregate([
    { $match: { ...first.$match, priceEUR: { $type: "number", $gte: 0 } } },
    { $set: { totalPrice: { $round: ["$priceEUR", 2] } } },
    ...rest,
  ]);
}

export function euroPaymentStages() {
  return [{ $set: {
    paidPayments: { $round: [{ $sum: "$paymentsEUR.amount" }, 2] },
    clearedChecks: { $literal: 0 },
  } }];
}

export async function euroReceivables() {
  const rows = await aggregateEuroOrders([
    { $match: { fulfillmentStatus: { $ne: "CANCELED" } } },
    ...euroPaymentStages(),
    { $set: { amount: { $round: [{ $max: [0, { $subtract: ["$totalPrice", "$paidPayments"] }] }, 2] } } },
    { $match: { amount: { $gt: 0 } } },
    { $facet: {
      totals: [{ $group: { _id: null, amount: { $sum: "$amount" } } }],
      byCustomer: [
        { $sort: { amount: -1, _id: 1 } }, { $limit: 50 },
        { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "customer" } },
        { $set: { customer: { $arrayElemAt: ["$customer", 0] } } },
        { $project: {
          _id: 0, orderId: "$_id", trackingCode: 1, amount: 1,
          customer: { $trim: { input: { $concat: [{ $ifNull: ["$customer.name", ""] }, " ", { $ifNull: ["$customer.lastName", ""] }] } } },
          phone: { $ifNull: ["$customer.phone", ""] },
          overdue: { $literal: null }, nextDue: { $literal: null },
        } },
      ],
    } },
  ]);
  return { outstanding: rows[0]?.totals[0]?.amount || 0, byCustomer: rows[0]?.byCustomer || [], aging: [], overdue: null };
}
