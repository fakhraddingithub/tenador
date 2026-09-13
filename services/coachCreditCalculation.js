import "base/models/registerModels";
import CoachCredit from "base/models/CoachCredit";

// Shared by pricing and settlement; scope and both date bounds must all match.
export async function calculateCoachCredit(coachId, items, session = null, context = {}) {
  if (!coachId || !items?.length) return { amount: 0, allocations: [] };
  const now = new Date();
  const rules = await CoachCredit.find({ active: true, $and: [
    { $or: [{ scope: "all_coaches" }, { scope: "specific_coach", coach: coachId }] },
    { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
    { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
  ] }).sort({ priority: -1, _id: 1 }).session(session).lean();
  let amount = 0;
  const allocations = new Map();
  const purchaseTotal = context.purchaseTotal ?? items.reduce((sum, item) => sum + (item.lineTotalToman || 0), 0);
  for (const item of items) {
    if (!(item.lineTotalToman > 0)) continue;
    const targets = { product: item.productId, category: item.categoryId, serie: item.serieId };
    const rule = rules.find(r => (!r.conditions?.onlyNewStudents || context.isFirstPurchase === true)
      && purchaseTotal >= (r.conditions?.minPurchaseAmount || 0)
      && (r.targetType === "all" || r.targets?.some(t => targets[r.targetType] && String(t) === String(targets[r.targetType]))));
    if (!rule) continue;
    const credit = rule.credit.kind === "percent" ? Math.floor(item.lineTotalToman * rule.credit.value / 100) : rule.credit.value;
    if (!Number.isSafeInteger(credit) || credit < 0 || !Number.isSafeInteger(amount + credit)) {
      throw Object.assign(new Error("مقدار قانون کردیت مربی نامعتبر است"), { code: "WALLET_CHECKOUT_ERROR", status: 409 });
    }
    amount += credit;
    if (credit > 0) {
      const key = String(rule._id);
      allocations.set(key, { rule: rule._id, amount: (allocations.get(key)?.amount || 0) + credit });
    }
  }
  return { amount, allocations: [...allocations.values()] };
}

export async function computeCoachCredit(coachId, items, session = null, context = {}) {
  return (await calculateCoachCredit(coachId, items, session, context)).amount;
}
