/**
 * src/lib/emailService.js
 *
 * سرویس ارسال ایمیل — فاکتور سفارش برای مشتری و ادمین
 *
 * نیاز: متغیرهای محیطی زیر در .env.local
 *   EMAIL_HOST=smtp.example.com
 *   EMAIL_PORT=587
 *   EMAIL_USER=noreply@tenador.ir
 *   EMAIL_PASS=your_password
 *   EMAIL_FROM="Tenador Store <noreply@tenador.ir>"
 *   ADMIN_EMAIL=admin@tenador.ir
 *   NEXT_PUBLIC_BASE_URL=https://tenador.ir
 *   NEXT_PUBLIC_LOGO_URL=https://www.tenador.com/logo/logo.svg  (اختیاری)
 */

import nodemailer from 'nodemailer';

// ─── Transporter ─────────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   Number(process.env.EMAIL_PORT ?? 587),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ─── Format Helpers ──────────────────────────────────────────────────────────
function formatPrice(price) {
  return new Intl.NumberFormat('fa-IR').format(Number(price ?? 0)) + ' تومان';
}

function formatJalaliDate(date) {
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran',
    }).format(new Date(date));
  } catch {
    return '—';
  }
}

function splitName(text) {
  if (!text) return { farsi: '', english: '' };
  const match = text.match(/[a-zA-Z(].*/);
  if (match) {
    return {
      farsi:   text.substring(0, match.index).trim(),
      english: match[0].trim(),
    };
  }
  return { farsi: text, english: '' };
}

function renderVariant(variantAttrs) {
  if (!variantAttrs || !Object.keys(variantAttrs).length) return '';
  return Object.entries(variantAttrs)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' / ');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// رندر انتخاب‌های فرایند سفارش (خدمات + محصولات انتخاب‌شده) زیر هر آیتم
function renderFlowSelections(flowSelections) {
  if (!Array.isArray(flowSelections) || flowSelections.length === 0) return '';

  const rows = flowSelections.map((sel) => {
    const isService = sel.nodeType === 'service';
    const productImage = sel.selectedProduct?.mainImage || sel.selectedProductImage || '';
    const productName  = sel.selectedProductName || sel.selectedProduct?.name || '';
    const valueText = isService
      ? sel.serviceLabel
      : `${productName}${sel.selectedVariantLabel ? ` (${sel.selectedVariantLabel})` : ''}`;
    const addon = Number(sel.addonToman) || 0;
    const addonCell = addon > 0
      ? `<td style="text-align:left;white-space:nowrap;vertical-align:middle;"><span style="display:inline-block;color:#aa4725;font-weight:700;font-size:11px;background:rgba(170,71,37,0.1);border-radius:6px;padding:3px 8px;">+ ${formatPrice(addon)}</span></td>`
      : '<td></td>';

    const thumbCell = (!isService && productImage)
      ? `<td width="40" style="vertical-align:middle;padding-left:8px;"><img src="${productImage}" alt="${escapeHtml(productName)}" width="36" height="36" style="border-radius:6px;object-fit:cover;border:1px solid #eee;display:block;background:#fff;"></td>`
      : `<td width="40" style="vertical-align:middle;padding-left:8px;"><div style="width:36px;height:36px;border-radius:6px;border:1px solid #eee;background:#fff;text-align:center;line-height:36px;color:#aa4725;font-size:16px;">${isService ? '⚙' : '🏷'}</div></td>`;

    return `
      <tr>
        ${thumbCell}
        <td style="vertical-align:middle;padding:4px 0;">
          <div style="font-size:10px;color:#999;line-height:1.4;">${escapeHtml(sel.nodeLabel)}</div>
          <div style="font-size:12px;color:#333;font-weight:700;line-height:1.5;">${escapeHtml(valueText)}</div>
        </td>
        ${addonCell}
      </tr>`;
  }).join('');

  return `
    <div style="margin-top:8px;border:1px solid rgba(170,71,37,0.2);background:rgba(170,71,37,0.04);border-radius:8px;padding:8px 10px;">
      <div style="font-size:11px;font-weight:700;color:#aa4725;margin-bottom:6px;">موارد انتخاب‌شده برای این محصول</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${rows}
      </table>
    </div>`;
}

const PAYMENT_LABEL = {
  BANK_RECEIPT: 'فیش بانکی',
  INSTALLMENT:  'اقساطی',
  ONLINE:       'پرداخت آنلاین',
};

// ─── جدول زمان‌بندی اقساط (در ایمیل تأیید سفارشِ اقساطی) ──────────────────────
function renderInstallmentSchedule(order, installment) {
  if (!installment || !Array.isArray(installment.checks) || installment.checks.length === 0) {
    return '';
  }

  const checks = installment.checks
    .slice()
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const checksTotal = checks.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const downPaymentAmount = Number(installment.downPaymentAmount ?? installment.downPayment?.amount ?? 0);
  const orderTotal = Number(order.totalPrice ?? 0);
  const interest = Math.max(0, checksTotal - (orderTotal - downPaymentAmount));

  const rows = checks.map((c, idx) => `
    <tr style="border-bottom:1px solid #f0ece8;">
      <td style="padding:10px 12px; text-align:center; font-size:13px; color:#555;">قسط ${new Intl.NumberFormat('fa-IR').format(idx + 1)}</td>
      <td style="padding:10px 12px; text-align:center; font-size:13px; color:#555;">${formatJalaliDate(c.dueDate)}</td>
      <td style="padding:10px 12px; text-align:left; font-size:13px; font-weight:700; color:#1a1a1a; direction:rtl;">${formatPrice(c.amount)}</td>
    </tr>`).join('');

  return `
    <div style="margin-top:24px; border:1px solid rgba(170,71,37,0.25); border-radius:10px; overflow:hidden;">
      <div style="background:rgba(170,71,37,0.06); padding:12px 16px; border-bottom:1px solid rgba(170,71,37,0.15);">
        <span style="font-size:14px; font-weight:700; color:#aa4725;">🗓 زمان‌بندی پرداخت اقساطی</span>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        <tr>
          <td style="padding:10px 16px; color:#888; border-bottom:1px solid #f0ece8; width:50%;">پیش‌پرداخت</td>
          <td style="padding:10px 16px; color:#1a1a1a; font-weight:700; border-bottom:1px solid #f0ece8; text-align:left; direction:rtl;">${formatPrice(downPaymentAmount)}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px; color:#888; border-bottom:1px solid #f0ece8;">تعداد اقساط</td>
          <td style="padding:10px 16px; color:#1a1a1a; font-weight:700; border-bottom:1px solid #f0ece8; text-align:left;">${new Intl.NumberFormat('fa-IR').format(checks.length)} قسط</td>
        </tr>
        <tr>
          <td style="padding:10px 16px; color:#888; border-bottom:1px solid #f0ece8;">مجموع سود اقساط</td>
          <td style="padding:10px 16px; color:#1a1a1a; font-weight:700; border-bottom:1px solid #f0ece8; text-align:left; direction:rtl;">${formatPrice(interest)}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px; color:#888;">مجموع چک‌ها (با سود)</td>
          <td style="padding:10px 16px; color:#aa4725; font-weight:700; text-align:left; direction:rtl;">${formatPrice(checksTotal)}</td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #f0ece8;">
        <thead>
          <tr style="background:#faf7f5;">
            <th style="padding:10px 12px; text-align:center; color:#888; font-weight:600; font-size:12px;">قسط</th>
            <th style="padding:10px 12px; text-align:center; color:#888; font-weight:600; font-size:12px;">سررسید</th>
            <th style="padding:10px 12px; text-align:left; color:#888; font-weight:600; font-size:12px; direction:rtl;">مبلغ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="padding:10px 16px; background:#faf7f5; font-size:11px; color:#888; line-height:1.7;">
        چک‌های شما پس از بازبینی توسط فروشگاه تأیید می‌شوند. لطفاً نسبت به تأمین موجودی هر چک تا تاریخ سررسید آن اقدام فرمایید.
      </div>
    </div>`;
}

// ─── HTML Template ─────────────────────────────────────────────────────────
/**
 * @param {Object} order  - سفارش populate‌شده
 * @param {boolean} isAdmin
 */
function buildEmailHtml(order, isAdmin = false, installment = null) {
  const logoUrl     = process.env.NEXT_PUBLIC_LOGO_URL ?? `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/logo.png`;
  const baseUrl     = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const addressSnap = order.address?.snapshot ?? {};

  const itemsHtml = (order.items ?? []).map((item) => {
    const productName  = item.product?.name ?? '—';
    const productImage = item.product?.mainImage ?? '';
    const { farsi, english } = splitName(productName);
    const variantAttrs = item.variant?.attributes ?? null;
    const variantText  = renderVariant(variantAttrs);
    const unitPrice    = item.unitPrice ?? 0;
    const totalLine    = unitPrice * (item.quantity ?? 1);

    return `
      <tr style="border-bottom:1px solid #f0ece8;">
        <td style="padding:12px 8px; vertical-align:middle; text-align:right;">
          ${productImage ? `<img src="${productImage}" alt="${productName}" width="56" height="56" style="border-radius:8px;object-fit:cover;border:1px solid #f0ece8;display:block;">` : ''}
        </td>
        <td style="padding:12px 8px; vertical-align:middle; text-align:right; max-width:220px;">
          <div style="font-weight:700; color:#1a1a1a; font-size:14px; line-height:1.4;">
            ${farsi ? `<span>${farsi}</span>` : ''}
            ${english ? `<span style="display:block;direction:ltr;font-size:12px;color:#444;">${english}</span>` : ''}
            ${!farsi && !english ? `<span>${productName}</span>` : ''}
          </div>
          ${variantText ? `<div style="margin-top:4px;font-size:11px;color:#aa4725;background:#aa4725/8;border:1px solid rgba(170,71,37,0.2);border-radius:12px;padding:2px 8px;display:inline-block;">${variantText}</div>` : ''}
          ${renderFlowSelections(item.flowSelections)}
        </td>
        <td style="padding:12px 8px; text-align:center; font-size:13px; color:#555; white-space:nowrap;">
          ${new Intl.NumberFormat('fa-IR').format(item.quantity ?? 1)} عدد
        </td>
        <td style="padding:12px 8px; text-align:left; font-size:13px; color:#555; white-space:nowrap; direction:rtl;">
          ${formatPrice(unitPrice)}
        </td>
        <td style="padding:12px 8px; text-align:left; font-size:14px; font-weight:700; color:#1a1a1a; white-space:nowrap; direction:rtl;">
          ${formatPrice(totalLine)}
        </td>
      </tr>
    `;
  }).join('');

  const discountRow = (order.discountAmount ?? 0) > 0 ? `
    <tr>
      <td colspan="4" style="padding:8px 16px; text-align:right; color:#555; font-size:13px;">تخفیف محصولات</td>
      <td style="padding:8px 16px; text-align:left; color:#16a34a; font-weight:600; font-size:13px; direction:rtl;">− ${formatPrice(order.discountAmount)}</td>
    </tr>` : '';

  const couponRow = (order.couponDiscount ?? 0) > 0 ? `
    <tr>
      <td colspan="4" style="padding:8px 16px; text-align:right; color:#555; font-size:13px;">تخفیف کد «${order.coupon?.code ?? ''}»</td>
      <td style="padding:8px 16px; text-align:left; color:#16a34a; font-weight:600; font-size:13px; direction:rtl;">− ${formatPrice(order.couponDiscount)}</td>
    </tr>` : '';

  const greeting = isAdmin
    ? `<p style="font-size:15px;color:#555;margin:0 0 8px;">سفارش جدید از مشتری <strong>${addressSnap.fullName ?? '—'}</strong> ثبت شد.</p>`
    : `<p style="font-size:15px;color:#555;margin:0 0 8px;">با سپاس از خرید شما عزیز، سفارش شما با موفقیت ثبت شد.</p>`;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; background: #f5f0eb; direction: rtl; }
  </style>
</head>
<body style="background:#f5f0eb; padding: 24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto;">

    <!-- Header -->
    <tr>
      <td style="background:#fff; border-radius:12px 12px 0 0; padding:28px 32px; text-align:center;">
        <img src="${logoUrl}" alt="Tenador" height="48" style="display:inline-block;max-width:180px;object-fit:contain;" onerror="this.style.display='none'">
        <h1 style="color:#aa4725; font-size:20px; font-weight:700; margin-top:12px; letter-spacing:-0.3px;">
          ${isAdmin ? '🛒 سفارش جدید دریافت شد' : '✅ تأیید دریافت سفارش'}
        </h1>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="background:#fff; padding:28px 32px;">

        ${greeting}

        <!-- Tracking + Payment Method -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0; border:1px solid #f0ece8; border-radius:8px; overflow:hidden;">
          <tr style="background:#faf7f5;">
            <td style="padding:12px 16px; font-size:13px; color:#888; border-left:1px solid #f0ece8;">کد سفارش</td>
            <td style="padding:12px 16px; font-size:14px; font-weight:700; color:#1a1a1a; font-family:monospace; border-left:1px solid #f0ece8;">${order.trackingCode ?? '—'}</td>
            <td style="padding:12px 16px; font-size:13px; color:#888; border-left:1px solid #f0ece8;">روش پرداخت</td>
            <td style="padding:12px 16px; font-size:14px; font-weight:600; color:#aa4725;">${PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</td>
          </tr>
        </table>

        <!-- Items Table -->
        <p style="font-size:13px; color:#888; margin-bottom:8px;">اقلام سفارش:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0ece8; border-radius:8px; overflow:hidden; font-size:13px;">
          <thead>
            <tr style="background:#faf7f5;">
              <th style="padding:10px 8px; text-align:right; color:#888; font-weight:600; font-size:12px; width:64px;">تصویر</th>
              <th style="padding:10px 8px; text-align:right; color:#888; font-weight:600; font-size:12px;">محصول</th>
              <th style="padding:10px 8px; text-align:center; color:#888; font-weight:600; font-size:12px; white-space:nowrap;">تعداد</th>
              <th style="padding:10px 8px; text-align:left; color:#888; font-weight:600; font-size:12px; white-space:nowrap; direction:rtl;">قیمت واحد</th>
              <th style="padding:10px 8px; text-align:left; color:#888; font-weight:600; font-size:12px; white-space:nowrap; direction:rtl;">جمع</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            ${discountRow}
            ${couponRow}
            <tr style="background:#faf7f5; border-top:2px solid #f0ece8;">
              <td colspan="4" style="padding:14px 16px; text-align:right; font-weight:700; color:#1a1a1a; font-size:14px;">مبلغ قابل پرداخت:</td>
              <td style="padding:14px 16px; text-align:left; font-size:18px; font-weight:700; color:#aa4725; direction:rtl;">
                ${formatPrice(order.totalPrice)}
              </td>
            </tr>
          </tfoot>
        </table>

        ${order.paymentMethod === 'INSTALLMENT' ? renderInstallmentSchedule(order, installment) : ''}

        <!-- Address -->
        <div style="margin-top:24px; border:1px solid #f0ece8; border-radius:8px; overflow:hidden;">
          <div style="background:#faf7f5; padding:10px 16px; border-bottom:1px solid #f0ece8;">
            <span style="font-size:13px; font-weight:600; color:#555;">📦 اطلاعات ارسال</span>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
            <tr>
              <td style="padding:10px 16px; color:#888; width:110px; border-left:1px solid #f0ece8; border-bottom:1px solid #f0ece8;">نام گیرنده</td>
              <td style="padding:10px 16px; color:#1a1a1a; font-weight:600; border-bottom:1px solid #f0ece8;">${addressSnap.fullName ?? '—'}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px; color:#888; border-left:1px solid #f0ece8; border-bottom:1px solid #f0ece8;">تلفن</td>
              <td style="padding:10px 16px; color:#1a1a1a; font-family:monospace; border-bottom:1px solid #f0ece8;">${addressSnap.phone ?? '—'}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px; color:#888; border-left:1px solid #f0ece8; border-bottom:1px solid #f0ece8;">استان / شهر</td>
              <td style="padding:10px 16px; color:#1a1a1a; border-bottom:1px solid #f0ece8;">${[addressSnap.province, addressSnap.city].filter(Boolean).join(' / ') || '—'}</td>
            </tr>
            ${addressSnap.postalCode ? `
            <tr>
              <td style="padding:10px 16px; color:#888; border-left:1px solid #f0ece8; border-bottom:1px solid #f0ece8;">کد پستی</td>
              <td style="padding:10px 16px; color:#1a1a1a; font-family:monospace; border-bottom:1px solid #f0ece8;">${addressSnap.postalCode}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:10px 16px; color:#888; border-left:1px solid #f0ece8;">آدرس</td>
              <td style="padding:10px 16px; color:#1a1a1a; line-height:1.6;">${addressSnap.addressLine ?? '—'}</td>
            </tr>
          </table>
        </div>

        ${!isAdmin ? `
        <!-- CTA -->
        <div style="margin-top:28px; text-align:center;">
          <a href="${baseUrl}/p-user/orders" style="display:inline-block; background:#aa4725; color:#fff; text-decoration:none; font-size:14px; font-weight:700; padding:12px 32px; border-radius:8px; letter-spacing:-0.2px;">
            مشاهده سفارشات من
          </a>
        </div>` : ''}

      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#1a1a1a; border-radius:0 0 12px 12px; padding:20px 32px; text-align:center;">
        <p style="color:#888; font-size:11px; line-height:1.7; margin:0;">
          این ایمیل به صورت خودکار ارسال شده است. لطفاً پاسخ ندهید.<br>
          &copy; تمامی حقوق برای فروشگاه تنادور محفوظ است.
        </p>
        ${baseUrl ? `<a href="${baseUrl}" style="color:#aa4725; font-size:11px; text-decoration:none; display:block; margin-top:6px;">${baseUrl.replace(/^https?:\/\//, '')}</a>` : ''}
      </td>
    </tr>

  </table>
</body>
</html>
  `.trim();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * ارسال ایمیل فاکتور به مشتری + ادمین
 *
 * @param {Object} order  - سفارش کامل populate‌شده از دیتابیس
 * @param {string} customerEmail  - ایمیل مشتری
 */
export async function sendOrderConfirmationEmail(order, customerEmail, installment = null) {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    console.warn('[emailService] EMAIL_HOST / EMAIL_USER not set — skipping email');
    return;
  }

  const transporter = createTransporter();
  const subject = `تأیید سفارش — کد ${order.trackingCode}`;

  const jobs = [];

  // ارسال به مشتری
  if (customerEmail) {
    jobs.push(
      transporter.sendMail({
        from:    process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
        to:      customerEmail,
        subject,
        html:    buildEmailHtml(order, false, installment),
      })
    );
  }

  // ارسال به ادمین
  if (process.env.ADMIN_EMAIL) {
    jobs.push(
      transporter.sendMail({
        from:    process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
        to:      process.env.ADMIN_EMAIL,
        subject: `[سفارش جدید] ${subject}`,
        html:    buildEmailHtml(order, true, installment),
      })
    );
  }

  try {
    await Promise.all(jobs);
    console.log(`[emailService] Order emails sent for ${order.trackingCode}`);
  } catch (err) {
    // خطای ایمیل نباید سفارش را متوقف کند
    console.error('[emailService] Failed to send email:', err);
  }
}

// ─── ایمیل ساده‌ی اعلانی (قالب مشترک برای رویدادهای اقساط) ───────────────────
function buildSimpleNoticeHtml({ title, emoji, greeting, rows = [], note }) {
  const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL ?? `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/logo.png`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  const rowsHtml = rows.map((r) => `
    <tr>
      <td style="padding:10px 16px; color:#888; border-bottom:1px solid #f0ece8; width:45%;">${escapeHtml(r.label)}</td>
      <td style="padding:10px 16px; color:#1a1a1a; font-weight:700; border-bottom:1px solid #f0ece8; text-align:left; direction:rtl;">${r.value}</td>
    </tr>`).join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; background: #f5f0eb; direction: rtl; }
  </style>
</head>
<body style="background:#f5f0eb; padding: 24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto;">
    <tr>
      <td style="background:#fff; border-radius:12px 12px 0 0; padding:28px 32px; text-align:center;">
        <img src="${logoUrl}" alt="Tenador" height="44" style="display:inline-block;max-width:160px;object-fit:contain;" onerror="this.style.display='none'">
        <h1 style="color:#aa4725; font-size:19px; font-weight:700; margin-top:12px;">${emoji} ${escapeHtml(title)}</h1>
      </td>
    </tr>
    <tr>
      <td style="background:#fff; padding:24px 32px;">
        <p style="font-size:15px;color:#555;margin:0 0 16px; line-height:1.8;">${greeting}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0ece8; border-radius:8px; overflow:hidden; font-size:13px;">
          ${rowsHtml}
        </table>
        ${note ? `<p style="font-size:12px;color:#888;margin-top:16px; line-height:1.8;">${note}</p>` : ''}
        <div style="margin-top:24px; text-align:center;">
          <a href="${baseUrl}/p-user/installments" style="display:inline-block; background:#aa4725; color:#fff; text-decoration:none; font-size:14px; font-weight:700; padding:11px 28px; border-radius:8px;">
            مشاهده اقساط من
          </a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#1a1a1a; border-radius:0 0 12px 12px; padding:18px 32px; text-align:center;">
        <p style="color:#888; font-size:11px; line-height:1.7; margin:0;">
          این ایمیل به صورت خودکار ارسال شده است.<br>
          &copy; تمامی حقوق برای فروشگاه تنادور محفوظ است.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

async function sendSingle(to, subject, html) {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    console.warn('[emailService] EMAIL_HOST / EMAIL_USER not set — skipping email');
    return;
  }
  if (!to) return;
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    console.log(`[emailService] Notice email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error('[emailService] Failed to send notice email:', err);
  }
}

/**
 * ایمیل «دریافت یک قسط» — وقتی ادمین یک چک را پاس (CLEARED) می‌کند.
 */
export async function sendInstallmentCheckClearedEmail(order, installment, check, customerEmail) {
  const checks = (installment.checks || []).slice().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const idx = checks.findIndex((c) => String(c._id) === String(check._id));
  const num = idx >= 0 ? idx + 1 : '';
  const clearedCount = checks.filter((c) => c.status === 'CLEARED').length;
  const remaining = checks.length - clearedCount;

  const html = buildSimpleNoticeHtml({
    title: 'قسط شما دریافت شد',
    emoji: '✅',
    greeting: 'با سلام،<br>یکی از اقساط سفارش شما با موفقیت دریافت و تأیید شد.',
    rows: [
      { label: 'کد سفارش', value: escapeHtml(order.trackingCode ?? '—') },
      { label: 'شماره قسط', value: `قسط ${new Intl.NumberFormat('fa-IR').format(num || 0)}` },
      { label: 'مبلغ این قسط', value: formatPrice(check.amount) },
      { label: 'اقساط باقی‌مانده', value: `${new Intl.NumberFormat('fa-IR').format(remaining)} قسط` },
    ],
    note: remaining > 0
      ? 'با تشکر از پرداخت به‌موقع شما. اقساط باقی‌مانده را می‌توانید از پنل کاربری پیگیری کنید.'
      : 'این آخرین قسط شما بود؛ به‌زودی ایمیل تکمیل اقساط برایتان ارسال می‌شود.',
  });

  await sendSingle(customerEmail, `دریافت قسط — سفارش ${order.trackingCode}`, html);
}

/**
 * ایمیل «تکمیل اقساط» — وقتی همه‌ی چک‌ها پاس شده‌اند.
 */
export async function sendInstallmentCompletedEmail(order, installment, customerEmail) {
  const html = buildSimpleNoticeHtml({
    title: 'اقساط شما تکمیل شد',
    emoji: '🎉',
    greeting: 'با سلام،<br>تمامی اقساط سفارش شما با موفقیت پرداخت و تسویه شد. از خرید و همراهی شما سپاسگزاریم.',
    rows: [
      { label: 'کد سفارش', value: escapeHtml(order.trackingCode ?? '—') },
      { label: 'تعداد اقساط', value: `${new Intl.NumberFormat('fa-IR').format(installment.numberOfChecks ?? (installment.checks || []).length)} قسط` },
      { label: 'مبلغ کل سفارش', value: formatPrice(order.totalPrice) },
    ],
    note: 'پرونده‌ی اقساط این سفارش بسته شد. در صورت هرگونه سؤال با پشتیبانی در تماس باشید.',
  });

  await sendSingle(customerEmail, `تکمیل اقساط — سفارش ${order.trackingCode}`, html);
}
