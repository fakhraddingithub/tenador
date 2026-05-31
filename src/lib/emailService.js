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

const PAYMENT_LABEL = {
  BANK_RECEIPT: 'فیش بانکی',
  INSTALLMENT:  'اقساطی',
  ONLINE:       'پرداخت آنلاین',
};

// ─── HTML Template ─────────────────────────────────────────────────────────
/**
 * @param {Object} order  - سفارش populate‌شده
 * @param {boolean} isAdmin
 */
function buildEmailHtml(order, isAdmin = false) {
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
              <td style="padding:10px 16px; color:#1a1a1a; line-height:1.6;">${addressSnap.fullAddress ?? '—'}</td>
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
export async function sendOrderConfirmationEmail(order, customerEmail) {
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
        html:    buildEmailHtml(order, false),
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
        html:    buildEmailHtml(order, true),
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
