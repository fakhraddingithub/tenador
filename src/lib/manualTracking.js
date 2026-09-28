// Shared by the admin UI and server. Manual quantities never create warehouse records.
export const MANUAL_TRACKING_STATUSES = {
  FR_WAREHOUSE: "انبار فرانسه",
  READY_TO_SHIP: "آماده ارسال",
  IN_TRANSIT: "در مسیر",
  CUSTOMS_HOLD: "گمرک",
  IR_WAREHOUSE: "انبار ایران",
  DELIVERED: "تحویل داده شده",
  RETURNED: "مرجوعی",
};

export function manualTrackingCount(line) {
  return (line?.manualTracking || []).reduce((sum, row) => sum + row.quantity, 0);
}

export function trackingQuantities(line, quantity, scannedCount) {
  const manualCount = manualTrackingCount(line);
  return {
    manualTracking: line?.manualTracking || [],
    manualTrackingRevision: line?.manualTrackingRevision || 0,
    manualCount,
    remainingCount: Math.max(0, quantity - scannedCount - manualCount),
  };
}

export function validateManualTracking(rows, available) {
  if (!Array.isArray(rows) || rows.length > Object.keys(MANUAL_TRACKING_STATUSES).length) {
    throw new Error("وضعیت‌های دستی نامعتبر است");
  }
  const seen = new Set();
  const normalized = rows.map((row) => {
    if (!row || !Object.hasOwn(MANUAL_TRACKING_STATUSES, row.status) || seen.has(row.status)) {
      throw new Error("وضعیت نامعتبر یا تکراری است");
    }
    if (!Number.isSafeInteger(row.quantity) || row.quantity <= 0) {
      throw new Error("تعداد هر وضعیت باید عدد صحیح و بزرگ‌تر از صفر باشد");
    }
    seen.add(row.status);
    return { status: row.status, quantity: row.quantity };
  });
  if (manualTrackingCount({ manualTracking: normalized }) > Math.max(0, available)) {
    throw new Error("مجموع تعداد وضعیت‌های دستی و ترکینگ‌های انبار از تعداد سفارش بیشتر است");
  }
  return normalized;
}

const id = (value) => (value?._id || value)?.toString();

// Keep the existing explicit-index and legacy matching rules in one place.
export function matchMainTracking(item, index, trackingItems) {
  return trackingItems.filter((t) => {
    if (t.flowNodeId) return false;
    if (t.orderItemIndex !== null && t.orderItemIndex !== undefined) return t.orderItemIndex === index;
    if (item.itemType === "used_product") {
      const up = item.usedProduct;
      if (!up) return false;
      return Boolean(
        (up.warehouseTrackingId && id(t) === id(up.warehouseTrackingId)) ||
        (up.assignedBarcode && t.barcode === up.assignedBarcode) ||
        (up.assignedTrackingCode && t.trackingId === up.assignedTrackingCode)
      );
    }
    return id(t.productRef) === id(item.product) && (!item.variant || id(t.variantRef) === id(item.variant));
  });
}

export function lineTracking(item, index, flowNodeId, trackingItems, usedItems = []) {
  if (flowNodeId) return trackingItems.filter((t) => t.orderItemIndex === index && t.flowNodeId === flowNodeId);
  return [
    ...matchMainTracking(item, index, trackingItems),
    ...(item.itemType === "used_product" ? usedItems.filter((t) => t.usedProductRef === id(item.usedProduct)) : []),
  ];
}

// Only orders that have opted into manual tracking use quantity-complete delivery.
// Legacy orders continue through the original fulfillment calculation.
export function manualOrderDeliveryStatuses(order, trackingItems, usedItems = []) {
  const statuses = [];
  for (const [index, item] of (order.items || []).entries()) {
    const lines = [
      { line: item, quantity: item.itemType === "used_product" ? 1 : item.quantity, nodeId: null },
      ...(item.flowSelections || []).filter((s) => s.nodeType === "category" && s.selectedProduct)
        .map((line) => ({ line, quantity: item.quantity, nodeId: line.nodeId })),
    ];
    for (const { line, quantity, nodeId } of lines) {
      const tracked = lineTracking(item, index, nodeId, trackingItems, usedItems);
      const manual = line.manualTracking || [];
      const covered = tracked.length + manualTrackingCount(line);
      statuses.push(...tracked.map((t) => t.status), ...manual.map((row) => row.status));
      if (covered !== quantity) statuses.push("UNASSIGNED");
    }
  }
  return statuses;
}
