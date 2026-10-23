import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoiceData, invoiceMoney, invoiceDate } from "../src/lib/orderInvoiceData.js";
import { wrapInvoiceText } from "../src/lib/downloadOrderInvoice.js";

const order = {
  trackingCode: "20261023AB1234", totalPrice: 800, subtotalPrice: 1000,
  discountAmount: 100, couponDiscount: 100, walletPaid: 200,
  paymentMethod: "BANK_RECEIPT", paymentStatus: "PARTIALLY_PAID",
  items: [{ product: { name: "راکت", mainImage: "https://example.test/racket.jpg" }, quantity: 2, unitPrice: 450,
    variantSnapshot: [{ label: "سایز", value: "قدیمی" }], variant: { attributes: { size: "جدید" } },
    flowSelections: [{ nodeType: "service", serviceName: "زه‌کشی", addonToman: 50, serviceConfig: [{ title: "کشش", label: "۲۵", unit: "کیلوگرم" }] }] }],
  payments: [{ method: "WALLET", status: "PAID", amount: 200 }, { method: "BANK_RECEIPT", status: "PAID", amount: 100 }, { method: "BANK_RECEIPT", status: "PENDING", amount: 500 }],
};
test("wallet is counted once and pending receipts do not reduce the balance", () => {
  const result = buildInvoiceData(order);
  assert.equal(result.summary.find(([key]) => key === "مانده پرداخت سفارش")[1], invoiceMoney(500));
  assert.equal(result.summary.find(([key]) => key === "مبلغ نهایی سفارش")[1], invoiceMoney(800));
  assert.equal(result.rows[0].total, (900).toLocaleString("fa-IR"));
  assert.equal(result.rows[1].total, undefined); // Add-ons already belong to the parent unit price.
  assert.match(result.rows[0].detail, /قدیمی/);
  assert.doesNotMatch(result.rows[0].detail, /جدید/);
  assert.match(result.rows[1].title, /کشش.*۲۵.*کیلوگرم/);
});
test("installment balances use the plan summary including interest", () => {
  const result = buildInvoiceData({ ...order, paymentMethod: "INSTALLMENT" }, {
    paidAmount: 100, remainingAmount: 550,
    checks: [{ dueDate: "2026-12-01", amount: 300 }, { dueDate: "2026-11-01", amount: 250 }],
  });
  assert.equal(result.summary.find(([key]) => key.startsWith("مانده طرح"))[1], invoiceMoney(550));
  assert.equal(result.summary.find(([key]) => key === "مانده پرداخت سفارش"), undefined);
  assert.ok(result.checks[0].includes(invoiceDate("2026-11-01")));
});
test("deleted products, missing historical fields and zero totals are supported", () => {
  const result = buildInvoiceData({ items: [{ quantity: 1, unitPrice: 0, itemType: "used_product", usedProduct: { name: "راکت کارکرده", images: ["/used.jpg"] } }], totalPrice: 0 });
  assert.match(result.rows[0].title, /راکت کارکرده.*دست دوم/);
  assert.equal(result.rows[0].image, "/used.jpg");
  assert.equal(result.rows[0].total, "۰");
  assert.equal(invoiceDate("invalid"), "—");
});
test("EUR values are opt-in and source objects are not mutated", () => {
  const source = structuredClone({ ...order, priceEUR: 100, paymentsEUR: [{ amount: 20 }] });
  const before = structuredClone(source);
  assert.equal(buildInvoiceData(source).summary.some(([key]) => key.includes("یورویی")), false);
  assert.equal(buildInvoiceData(source, null, { includeEUR: true }).summary.find(([key]) => key === "مانده یورویی")[1], "80 EUR");
  assert.deepEqual(source, before);
});
test("long unbroken identifiers wrap without dropping characters", () => {
  const context = { measureText: (text) => ({ width: [...text].length * 10 }) };
  const value = "SKU123".repeat(150);
  const lines = wrapInvoiceText(context, value, 100);
  assert.equal(lines.join(""), value);
  assert.ok(lines.every((line) => context.measureText(line).width <= 100));
  assert.deepEqual(wrapInvoiceText(context, "سلام دنیا\nمشخصات", 100), ["سلام دنیا", "مشخصات"]);
});
