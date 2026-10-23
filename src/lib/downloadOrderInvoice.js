import { jsPDF } from "jspdf";
import { buildInvoiceData, invoiceNumber } from "./orderInvoiceData.js";

const WIDTH = 794, HEIGHT = 1123, MARGIN = 40, BOTTOM = 1060;
const INK = "#232323", MUTED = "#69635f", PRIMARY = "#aa4725", PALE = "#faf5f1";
let fontsReady;
function loadInvoiceFonts() {
  if (!fontsReady) {
    fontsReady = Promise.all([['Regular', '400'], ['Bold', '700']].map(async ([name, weight]) => {
      const response = await fetch(`/fonts/invoice/Vazirmatn-${name}.woff2`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("دریافت فونت فاکتور ناموفق بود؛ دوباره تلاش کنید.");
      const font = new FontFace("InvoiceVazirmatn", await response.arrayBuffer(), { weight });
      await font.load();
      document.fonts.add(font);
    })).catch((error) => { fontsReady = null; throw error; });
  }
  return fontsReady;
}

// Canvas uses the browser's native Persian shaping and bidi implementation.
// Render one A4 page at a time, never a single oversized screenshot of the order.
export function wrapInvoiceText(context, text, width) {
  const lines = [];
  for (const paragraph of String(text || "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      // Long SKUs/URLs must not overflow the next column.
      for (const character of word) {
        if (line && context.measureText(line + character).width > width) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

async function loadImage(url) {
  if (!url) return null;
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => { image.src = ""; resolve(null); }, 10000);
    image.crossOrigin = "anonymous";
    image.onload = () => {
      clearTimeout(timer);
      // Keep only a thumbnail in memory, even when the source photo is very large.
      const thumb = document.createElement("canvas");
      const ratio = Math.min(1, 300 / Math.max(image.naturalWidth, image.naturalHeight));
      thumb.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      thumb.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      thumb.getContext("2d").drawImage(image, 0, 0, thumb.width, thumb.height);
      resolve(thumb);
    };
    image.onerror = () => { clearTimeout(timer); resolve(null); };
    image.src = url;
  });
}

export async function createOrderInvoice(order, installment, options = {}) {
  const data = buildInvoiceData(order, installment, options);
  await loadInvoiceFonts();
  const logo = await loadImage(process.env.NEXT_PUBLIC_LOGO_URL || "/logo/logo.svg") || await loadImage("/logo/logo.svg");
  // JPEG pages are already compressed; leave content streams uncompressed for reader compatibility.
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: false });
  pdf.setProperties({ title: `Tenador Invoice ${data.code}`, author: "Tenador", subject: "Order invoice" });
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * 2; canvas.height = HEIGHT * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("مرورگر امکان ساخت فاکتور را ندارد.");
  ctx.scale(2, 2);
  let y = 0, page = 0, missingImages = 0;
  function font(size = 13, bold = false) { ctx.font = `${bold ? 700 : 400} ${size}px InvoiceVazirmatn, Tahoma, sans-serif`; }
  function text(value, x, top, { size = 13, bold = false, color = INK, align = "right" } = {}) {
    font(size, bold); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "top"; ctx.direction = "rtl";
    ctx.fillText(String(value ?? ""), x, top);
  }
  function rect(x, top, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, top, w, h); }
  function rule(top) { rect(MARGIN, top, WIDTH - MARGIN * 2, 1, "#e9e2dc"); }
  function picture(image, x, top, w, h) {
    if (!image) return;
    const ratio = Math.min(w / image.width, h / image.height);
    const iw = image.width * ratio, ih = image.height * ratio;
    ctx.drawImage(image, x + (w - iw) / 2, top + (h - ih) / 2, iw, ih);
  }
  function finishPage() {
    rule(1073);
    text("این فاکتور بیانگر جزئیات سفارش است؛ تأیید پرداخت مطابق وضعیت ثبت‌شده انجام می‌شود.", WIDTH - MARGIN, 1082, { size: 9, color: MUTED });
    text("تنادور • با سپاس از همراهی شما", WIDTH - MARGIN, 1100, { size: 9, color: MUTED });
    text(`صفحه ${invoiceNumber(page)} • ${data.code}`, MARGIN, 1100, { size: 9, color: MUTED, align: "left" });
    if (page > 1) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 210, 297);
  }
  function newPage() {
    if (page) finishPage();
    page += 1;
    rect(0, 0, WIDTH, HEIGHT, "#ffffff");
    rect(MARGIN, 28, WIDTH - MARGIN * 2, 3, PRIMARY);
    picture(logo, WIDTH - MARGIN - 118, 48, 118, 46);
    if (!logo) text("تنادور", WIDTH - MARGIN, 52, { size: 26, bold: true, color: PRIMARY });
    text("فاکتور سفارش", MARGIN, 48, { size: 24, bold: true, align: "left" });
    text(`${data.code}   •   ${data.date}`, MARGIN, 84, { size: 11, color: MUTED, align: "left" });
    y = 108;
  }
  function ensure(height) { if (y + height > BOTTOM) newPage(); }
  function paragraph(value, { color = INK, size = 12, bold = false, background = false } = {}) {
    font(size, bold);
    const lines = wrapInvoiceText(ctx, value, WIDTH - MARGIN * 2 - 24);
    for (const line of lines) {
      ensure(20);
      if (background) rect(MARGIN, y, WIDTH - MARGIN * 2, 20, PALE);
      text(line, WIDTH - MARGIN - 12, y + 3, { color, size, bold });
      y += 20;
    }
  }
  function section(title) {
    ensure(60); y += 8;
    text(title, WIDTH - MARGIN, y, { bold: true, color: PRIMARY }); y += 22;
  }
  function tableHeader() {
    rect(MARGIN, y, WIDTH - MARGIN * 2, 30, PRIMARY);
    text("محصول / مشخصات", 740, y + 7, { color: "#fff", size: 11, bold: true });
    text("تعداد", 376, y + 7, { color: "#fff", size: 11 });
    text("واحد (تومان)", 311, y + 7, { color: "#fff", size: 11 });
    text("جمع (تومان)", 177, y + 7, { color: "#fff", size: 11 });
    y += 30;
  }
  try {
    const images = new Map();
    const urls = [...new Set(data.rows.map((row) => row.image).filter(Boolean))];
    let nextImage = 0;
    await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => {
      while (nextImage < urls.length) {
        const url = urls[nextImage++];
        images.set(url, await loadImage(url));
      }
    }));
    newPage();
    paragraph(data.meta, { size: 11, color: PRIMARY, background: true });
    section("اطلاعات گیرنده");
    data.recipient.forEach((line) => paragraph(line));
    y += 15; ensure(100); tableHeader();
    for (const row of data.rows) {
      font(12, true);
      const titleLines = wrapInvoiceText(ctx, row.title, 286).map((value) => ({ value, bold: true }));
      font(11);
      const details = row.detail ? wrapInvoiceText(ctx, row.detail, 286).map((value) => ({ value, bold: false })) : [];
      const lines = [...titleLines, ...details];
      const image = images.get(row.image);
      if (row.image && !image) missingImages += 1;
      let offset = 0;
      while (offset < lines.length) {
        const available = BOTTOM - y;
        const preferred = Math.max(row.addon ? 50 : 66, lines.length * 18 + 18);
        if (available < Math.min(preferred, 250)) { newPage(); tableHeader(); }
        const count = Math.min(lines.length - offset, Math.floor((BOTTOM - y - 18) / 18));
        const height = Math.max(row.addon ? 50 : 66, count * 18 + 18);
        if (row.addon) rect(MARGIN, y, WIDTH - MARGIN * 2, height, PALE);
        if (offset === 0) {
          if (image) picture(image, 697, y + 8, 48, 48);
          else {
            rect(697, y + 8, 48, 44, "#f1ece7");
            text(row.addon ? "خدمت" : "تنادور", 721, y + 23, { size: 10, color: MUTED, align: "center" });
          }
          text(row.quantity, 368, y + 16, { size: 12 });
          text(row.unit, 311, y + 16, { size: 12 });
          text(row.total, 177, y + 16, { size: 12, bold: true });
        }
        lines.slice(offset, offset + count).forEach((line, i) => text(line.value, 683, y + 9 + i * 18, { size: line.bold ? 12 : 11, bold: line.bold, color: line.bold ? INK : MUTED }));
        y += height; rule(y); offset += count;
        if (offset < lines.length) { newPage(); tableHeader(); }
      }
      // Let the browser paint loading feedback between rows on large orders.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    section("خلاصه مالی");
    for (const [name, amount, highlighted] of data.summary) {
      font(12);
      const labels = wrapInvoiceText(ctx, name, 390);
      const height = Math.max(26, labels.length * 20 + 6);
      ensure(height);
      if (highlighted) rect(MARGIN, y, WIDTH - MARGIN * 2, height, PALE);
      labels.forEach((line, i) => text(line, WIDTH - MARGIN - 12, y + 5 + i * 20, { size: 12, bold: highlighted, color: highlighted ? PRIMARY : MUTED }));
      text(amount, MARGIN + 12, y + 5, { size: 13, bold: highlighted, color: highlighted ? PRIMARY : INK, align: "left" });
      y += height;
    }
    if (data.payments.length) { section("سوابق پرداخت"); data.payments.forEach((p) => paragraph(p, { size: 11 })); }
    if (data.checks.length) { section("زمان‌بندی اقساط"); data.checks.forEach((c) => paragraph(c, { size: 11, background: true })); }
    if (data.description) { section("توضیحات سفارش"); paragraph(data.description); }
    finishPage();
    return { pdf, missingImages, filename: `Tenador-Invoice-${data.code.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf` };
  } finally {
    canvas.width = 0; canvas.height = 0;
  }
}

export async function downloadOrderInvoice(order, installment, options) {
  const result = await createOrderInvoice(order, installment, options);
  result.pdf.save(result.filename);
  return { missingImages: result.missingImages };
}
