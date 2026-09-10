// null matches both null and missing MongoDB fields. Keep the two bounds
// inside $and so callers can still use $or for discount targets.
export function discountWindowFilter(now = new Date()) {
  return {
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
    ],
  };
}
