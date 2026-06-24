// src/components/admin/analytics/exporter.js
// خروجی‌گیریِ گزارش‌ها: CSV (بومی)، Excel (xlsx با import پویا)، PDF (پنجره‌ی چاپ)
//
// نکته‌ی امنیتی: xlsx فقط برای «نوشتنِ» فایل از داده‌ی مطمئنِ خودمان استفاده می‌شود
// (هیچ فایلِ ورودیِ نامطمئنی parse نمی‌شود)، بنابراین آسیب‌پذیری‌های parser آن بی‌اثرند.

import { fa, faDate } from "./format";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns: [{ key, label }]
export function exportCsv(filename, columns, rows) {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c.key])).join(",")).join("\n");
  // BOM برای نمایش صحیحِ فارسی در اکسل
  const blob = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

// ─── سازنده‌های مجموعه‌داده از payloadِ تحلیل ──────────────────────────────
export function buildDatasets(data) {
  return {
    revenue: {
      columns: [
        { key: "date", label: "تاریخ" },
        { key: "revenue", label: "درآمد (تومان)" },
        { key: "orders", label: "تعداد سفارش" },
      ],
      rows: (data?.revenue?.daily || []).map((d) => ({ date: d.date, revenue: d.revenue, orders: d.orders })),
    },
    customers: {
      columns: [
        { key: "name", label: "مشتری" },
        { key: "phone", label: "تلفن" },
        { key: "rangeRevenue", label: "درآمد بازه" },
        { key: "rangeOrders", label: "سفارش بازه" },
        { key: "lifetimeRevenue", label: "درآمد کل" },
        { key: "lifetimeOrders", label: "سفارش کل" },
      ],
      rows: (data?.customers?.topByRevenue || []).map((c) => ({
        name: c.name, phone: c.phone, rangeRevenue: Math.round(c.rangeRevenue),
        rangeOrders: c.rangeOrders, lifetimeRevenue: Math.round(c.lifetimeRevenue), lifetimeOrders: c.lifetimeOrders,
      })),
    },
    products: {
      columns: [
        { key: "name", label: "محصول" },
        { key: "brandName", label: "برند" },
        { key: "categoryName", label: "دسته" },
        { key: "units", label: "تعداد فروش" },
        { key: "revenue", label: "درآمد" },
        { key: "avgPrice", label: "میانگین قیمت" },
        { key: "contribution", label: "سهم (٪)" },
      ],
      rows: (data?.products?.list || []).map((p) => ({
        name: p.name, brandName: p.brandName, categoryName: p.categoryName,
        units: p.units, revenue: Math.round(p.revenue), avgPrice: p.avgPrice, contribution: p.contribution,
      })),
    },
    receivables: {
      columns: [
        { key: "customer", label: "مشتری" },
        { key: "phone", label: "تلفن" },
        { key: "trackingCode", label: "کد سفارش" },
        { key: "amount", label: "مانده" },
        { key: "overdue", label: "معوق" },
        { key: "nextDue", label: "سررسید بعدی" },
      ],
      rows: (data?.receivables?.byCustomer || []).map((d) => ({
        customer: d.customer, phone: d.phone, trackingCode: d.trackingCode,
        amount: Math.round(d.amount), overdue: Math.round(d.overdue), nextDue: d.nextDue ? faDate(d.nextDue) : "—",
      })),
    },
  };
}

// ─── Excel چندبرگه‌ای (import پویای xlsx) ─────────────────────────────────
export async function exportWorkbook(data, rangeLabel) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ds = buildDatasets(data);

  // برگه‌ی خلاصه‌ی KPI
  const k = data?.kpis || {};
  const summary = [
    ["گزارش تحلیل مالی", rangeLabel || ""],
    [],
    ["معیار", "مقدار", "تغییر ٪"],
    ["درآمد کل", k.revenue?.value ?? 0, k.revenue?.change ?? ""],
    ["وصول‌شده", k.collected?.value ?? 0, k.collected?.change ?? ""],
    ["مطالبات معوق", k.outstanding?.value ?? 0, k.outstanding?.change ?? ""],
    ["تعداد سفارش", k.orders?.value ?? 0, k.orders?.change ?? ""],
    ["میانگین ارزش سفارش", k.aov?.value ?? 0, k.aov?.change ?? ""],
    ["مشتریان فعال", k.customers?.value ?? 0, ""],
    ["مشتریان جدید", k.newCustomers?.value ?? 0, ""],
    ["نرخ وصول (٪)", k.collectionRate?.value ?? 0, ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "خلاصه");

  const sheetFor = (name, dset) => {
    const aoa = [dset.columns.map((c) => c.label), ...dset.rows.map((r) => dset.columns.map((c) => r[c.key]))];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  };
  sheetFor("درآمد روزانه", ds.revenue);
  sheetFor("مشتریان", ds.customers);
  sheetFor("محصولات", ds.products);
  sheetFor("مطالبات", ds.receivables);

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `تحلیل-مالی-${Date.now()}.xlsx`);
}

// ─── PDF از طریق پنجره‌ی چاپ (پشتیبانی کاملِ فارسی/RTL) ───────────────────
export function exportPdf(data, rangeLabel) {
  const k = data?.kpis || {};
  const ds = buildDatasets(data);
  const win = window.open("", "_blank");
  if (!win) return;

  const kpiRow = (label, value, change) =>
    `<tr><td>${label}</td><td style="text-align:left;font-weight:700">${fa(value)}</td><td style="text-align:left;color:#888">${change != null && change !== "" ? fa(change) + "٪" : "—"}</td></tr>`;

  const table = (title, dset, limit = 10) => `
    <h3>${title}</h3>
    <table>
      <thead><tr>${dset.columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
      <tbody>${dset.rows.slice(0, limit).map((r) => `<tr>${dset.columns.map((c) => `<td>${typeof r[c.key] === "number" ? fa(r[c.key]) : (r[c.key] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;

  win.document.write(`
<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8">
<title>گزارش تحلیل مالی</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap');
  * { font-family: 'Vazirmatn', Tahoma, sans-serif; box-sizing: border-box; }
  body { padding: 24px; color: #1a1a1a; }
  h1 { color: #aa4725; font-size: 20px; margin: 0 0 4px; }
  h3 { color: #aa4725; font-size: 14px; margin: 22px 0 8px; border-bottom: 2px solid #f0ece8; padding-bottom: 4px; }
  .sub { color: #888; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #eee; padding: 6px 8px; text-align: right; }
  th { background: #faf7f5; color: #888; font-weight: 700; }
  @media print { @page { margin: 12mm; } }
</style></head><body>
  <h1>گزارش تحلیل مالی و هوش فروش</h1>
  <div class="sub">بازه: ${rangeLabel || "—"} — تاریخ تولید: ${faDate(new Date(), true)}</div>
  <h3>خلاصه‌ی اجرایی</h3>
  <table>
    <thead><tr><th>معیار</th><th style="text-align:left">مقدار</th><th style="text-align:left">تغییر</th></tr></thead>
    <tbody>
      ${kpiRow("درآمد کل (تومان)", k.revenue?.value, k.revenue?.change)}
      ${kpiRow("وصول‌شده", k.collected?.value, k.collected?.change)}
      ${kpiRow("مطالبات معوق", k.outstanding?.value, k.outstanding?.change)}
      ${kpiRow("تعداد سفارش", k.orders?.value, k.orders?.change)}
      ${kpiRow("میانگین ارزش سفارش", k.aov?.value, k.aov?.change)}
      ${kpiRow("نرخ وصول (٪)", k.collectionRate?.value, null)}
    </tbody>
  </table>
  ${table("محصولات برتر", { columns: ds.products.columns, rows: data?.products?.top?.map((p) => ({ name: p.name, brandName: p.brandName, categoryName: p.categoryName, units: p.units, revenue: Math.round(p.revenue), avgPrice: p.avgPrice, contribution: p.contribution })) || [] })}
  ${table("مشتریان برتر", ds.customers)}
  ${table("مطالبات معوق", ds.receivables)}
  <script>window.onload = () => { window.print(); };</script>
</body></html>`);
  win.document.close();
}
