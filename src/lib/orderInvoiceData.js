// Only order snapshots and confirmed payments are used; catalog prices are never recalculated.
export const invoiceNumber = (value) => Number(value || 0).toLocaleString("fa-IR");
export const invoiceMoney = (value) => `${invoiceNumber(value)} تومان`;
export function invoiceDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" }) : "—";
}
const methods = { ONLINE: "آنلاین", BANK_RECEIPT: "فیش بانکی", WALLET: "کیف پول", INSTALLMENT: "اقساطی" };
const statuses = { PAID: "پرداخت شده", UNPAID: "پرداخت نشده", PARTIALLY_PAID: "پرداخت جزئی", PENDING: "در انتظار تأیید", FAILED: "ناموفق", REJECTED: "رد شده", WAITING: "در انتظار", NEEDS_PURCHASE: "در انتظار تأمین", PROCESSING: "در حال پردازش", SENT: "ارسال شده", DELIVERED: "تحویل شده", CANCELED: "لغو شده", RECEIVED: "دریافت شده", APPROVED: "تأیید شده", BOUNCED: "برگشت خورده", OVERDUE: "سررسید گذشته", SUBMITTED: "ثبت شده" };
const label = (value) => statuses[value] || value || "—";
const imageUrl = (value) => typeof value === "string" ? value : value?.url || "";

export function buildInvoiceData(order, installment = null, { customerRole } = {}) {
  // The order owner's current role comes from the authenticated detail endpoint.
  // Being an admin downloading the invoice does not make it a store invoice.
  const includeEUR = customerRole === "store";
  const rows = [];
  for (const [index, item] of (order.items || []).entries()) {
    const quantity = Number(item.quantity ?? 1);
    const unit = Number(item.unitPrice || 0);
    const attrs = item.variantSnapshot?.length ? item.variantSnapshot
      : Object.entries(item.variant?.attributes || {}).map(([name, value]) => ({ name, value }));
    const variant = attrs.map((a) => {
      const units = Object.entries(a.units || {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
      return `${a.label || a.name}: ${units.length ? units.map(([u, v]) => `${v} ${u}`).join(" / ") : a.value ?? "—"}`;
    }).join(" • ");
    rows.push({
      title: `${invoiceNumber(index + 1)}. ${item.product?.name || item.usedProduct?.name || "محصول حذف‌شده"}${item.itemType === "used_product" ? " (دست دوم)" : ""}`,
      detail: [variant, item.unitDiscount > 0 && `تخفیف هر واحد: ${invoiceMoney(item.unitDiscount)}`,
        includeEUR && item.priceEUR != null && `قیمت واحد: ${item.priceEUR} EUR • جمع: ${item.priceEUR * quantity} EUR`].filter(Boolean).join("\n"),
      image: imageUrl(item.variant?.images?.[0] || item.product?.mainImage || item.usedProduct?.images?.[0]),
      quantity: invoiceNumber(quantity), unit: invoiceNumber(unit), total: invoiceNumber(unit * quantity),
    });
    for (const selection of item.flowSelections || []) {
      const configs = selection.serviceConfig || [];
      const text = selection.nodeType === "service"
        ? [selection.serviceName || selection.nodeLabel, configs.length
          ? configs.map((c) => `${c.title || ""}: ${c.label ?? c.value ?? "—"}${c.unit ? ` ${c.unit}` : ""}`).join(" • ")
          : selection.serviceLabel || selection.serviceValue].filter(Boolean).join(" • ")
        : [selection.selectedProductName || selection.selectedProduct?.name || selection.nodeLabel, selection.selectedVariantLabel].filter(Boolean).join(" • ");
      rows.push({ title: text || "انتخاب تکمیلی", detail: `افزوده هر واحد: ${invoiceMoney(selection.addonToman)} (در قیمت محصول لحاظ شده)`,
        image: imageUrl(selection.selectedProduct?.mainImage || configs.find((c) => c.image)?.image), addon: true });
    }
  }
  const total = Number(order.totalPrice || 0);
  const payments = (order.payments || []).filter((p) => p && typeof p === "object");
  // Wallet Payment is already in payments; never subtract it twice.
  const wallet = Number(order.walletPaid || 0);
  const otherPaid = payments.filter((p) => p.status === "PAID" && p.method !== "WALLET").reduce((s, p) => s + Number(p.amount || 0), 0);
  const paid = wallet + otherPaid;
  const summary = [
    ["جمع پیش از تخفیف", invoiceMoney(order.subtotalPrice ?? total + Number(order.discountAmount || 0) + Number(order.couponDiscount || 0))],
    ["تخفیف محصولات", invoiceMoney(order.discountAmount)],
    [order.coupon?.isManual ? "تخفیف مدیریت" : `تخفیف کد ${order.coupon?.code || "تخفیف"}`, invoiceMoney(order.couponDiscount)],
    ["مبلغ نهایی سفارش", invoiceMoney(total), true],
    ["پرداخت از کیف پول", invoiceMoney(wallet)],
    ["سایر پرداخت‌های تأییدشده", invoiceMoney(otherPaid)],
  ];
  if (!installment) summary.push(["مانده پرداخت سفارش", invoiceMoney(Math.max(0, total - paid)), true]);
  const terms = order.installmentTerms;
  if (order.paymentMethod === "INSTALLMENT" && terms?.snapshotAt) {
    summary.push(["پیش‌پرداخت قراردادی", invoiceMoney(terms.downPaymentAmount)], ["سود اقساط", invoiceMoney(terms.totalInterest)], ["مجموع اقساط با سود", invoiceMoney(terms.totalPayable)]);
  }
  if (installment) {
    summary.push(["پرداخت تأییدشده طرح اقساط", invoiceMoney(installment.paidAmount)], ["مانده طرح اقساط (با سود)", invoiceMoney(installment.remainingAmount), true]);
  }
  if (includeEUR && order.priceEUR != null) {
    const eurPaid = (order.paymentsEUR || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    summary.push(["مبلغ مستقل یورویی", `${order.priceEUR} EUR`], ["پرداخت یورویی", `${eurPaid} EUR`], ["مانده یورویی", `${Math.max(0, order.priceEUR - eurPaid)} EUR`]);
  }
  const address = order.address?.snapshot || {};
  return {
    code: String(order.trackingCode || order._id || "—"), date: invoiceDate(order.orderDate || order.createdAt), rows, summary,
    meta: `روش پرداخت: ${methods[order.paymentMethod] || "—"}   •   ${label(order.paymentStatus)}   •   وضعیت سفارش: ${label(order.fulfillmentStatus)}`,
    recipient: [ `گیرنده: ${address.fullName || "—"}   •   تلفن: ${address.phone || "—"}`,
      [address.province, address.city, address.addressLine].filter(Boolean).join("، ") || "آدرس ثبت نشده",
      `کد پستی: ${address.postalCode || "—"}` ],
    payments: payments.map((p) => `${invoiceDate(p.createdAt)}   •   ${methods[p.method] || p.method}   •   ${invoiceMoney(p.amount)}   •   ${label(p.status)}`),
    checks: [...(installment?.checks || [])].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map((c, i) => `قسط ${invoiceNumber(i + 1)}   •   سررسید: ${invoiceDate(c.dueDate)}   •   ${invoiceMoney(c.amount)}   •   ${label(c.displayStatus || c.status)}${c.checkNumber ? `   •   چک: ${c.checkNumber}` : ""}`),
    description: order.description || "",
  };
}
