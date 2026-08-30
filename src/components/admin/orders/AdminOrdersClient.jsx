"use client";

import { getUserFullName } from "base/utils/userName";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  ShoppingCart, Search, Filter, ChevronRight, ChevronLeft,
  Eye, CheckCircle, XCircle, Clock, Package, Truck,
  Home, AlertCircle, RefreshCw, Receipt, CreditCard,
  Users, BadgeCheck, ChevronDown, Ban, Loader2,
  ReceiptText, Inbox, Sparkles, ShoppingBag,
  X, MapPin, Phone, Hash, ExternalLink, User
} from "lucide-react";

/* ─── Constants ─────────────────────────────────────────────────────── */

const PAYMENT_STATUS = {
  UNPAID:         { label: "پرداخت نشده",  color: "bg-red-50 text-red-600 border-red-200",       dot: "bg-red-500",    icon: XCircle },
  PARTIALLY_PAID: { label: "پرداخت ناقص",  color: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500",  icon: Clock },
  PAID:           { label: "پرداخت کامل",  color: "bg-green-50 text-green-600 border-green-200", dot: "bg-green-500",  icon: CheckCircle },
};

const FULFILLMENT_STATUS = {
  WAITING:        { label: "در انتظار",        color: "bg-gray-50 text-gray-500 border-gray-200",        dot: "bg-gray-400",   icon: Clock },
  NEEDS_PURCHASE: { label: "باید خریداری شود", color: "bg-amber-50 text-amber-600 border-amber-200",     dot: "bg-amber-500",  icon: ShoppingBag },
  PROCESSING: { label: "در حال پردازش",  color: "bg-blue-50 text-blue-600 border-blue-200",         dot: "bg-blue-500",   icon: Package },
  SENT:       { label: "ارسال شده",       color: "bg-purple-50 text-purple-600 border-purple-200",  dot: "bg-purple-500", icon: Truck },
  DELIVERED:  { label: "تحویل داده شد",  color: "bg-teal-50 text-teal-600 border-teal-200",         dot: "bg-teal-500",   icon: Home },
  CANCELED:   { label: "لغو شده",         color: "bg-red-50 text-red-500 border-red-200",           dot: "bg-red-400",    icon: Ban },
};

const PAYMENT_METHOD = {
  ONLINE:       { label: "پرداخت آنلاین", icon: CreditCard },
  BANK_RECEIPT: { label: "رسید بانکی",    icon: Receipt },
  INSTALLMENT:  { label: "اقساطی",        icon: ReceiptText },
};

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatPrice(v) {
  return new Intl.NumberFormat("fa-IR").format(Number(v ?? 0));
}

function splitProductName(text = "") {
  const englishPart = text.match(/[a-zA-Z(].*/);
  if (!englishPart) return { farsi: text, english: "" };

  return {
    farsi: text.slice(0, englishPart.index).trim(),
    english: englishPart[0].trim(),
  };
}

// برچسبِ واریانتِ یک آیتم — از اسنپ‌شات لحظه‌ی ثبت، وگرنه از خودِ واریانت
function variantLabelOf(item) {
  const snap = Array.isArray(item?.variantSnapshot) ? item.variantSnapshot : [];
  if (snap.length > 0) {
    return snap
      .map((s) => {
        const val = s?.units
          ? Object.values(s.units).filter(Boolean).join("، ")
          : s?.value;
        return val ? `${s?.label || s?.name || ""}: ${val}`.trim() : val;
      })
      .filter(Boolean)
      .join(" · ");
  }
  const attrs = item?.variant?.attributes;
  if (attrs && typeof attrs === "object") {
    return Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(" · ");
  }
  return item?.variant?.sku || "";
}

function toFarsiDate(dateStr) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(new Date(dateStr));
}

/**
 * آیا سفارش "جدید و دیده‌نشده" محسوب می‌شود؟
 * — سفارش‌هایی که هنوز بررسی نشده‌اند (reviewedAt ندارند)
 * — یا پرداخت جدید دارند که تأیید نشده (BANK_RECEIPT PENDING)
 */
function isUnseen(order) {
  const hasUnreviewedReceipt = order.payments?.some(
    (p) => p.method === "BANK_RECEIPT" && p.status === "PENDING"
  );
  return !order.reviewedAt || hasUnreviewedReceipt;
}

function isNewOrder(order) {
  // سفارش‌های ثبت‌شده در ۲۴ ساعت گذشته که reviewedAt ندارند
  const hoursSince = (Date.now() - new Date(order.createdAt).getTime()) / 36e5;
  return !order.reviewedAt && hoursSince < 24;
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function StatusBadge({ config, size = "sm" }) {
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold border rounded-full
      ${size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}
      ${config.color}`}>
      {Icon && <Icon size={size === "xs" ? 9 : 11} />}
      {config.label}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
      <p className="text-2xl font-black text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs font-bold text-gray-400 mt-1">{title}</p>
    </div>
  );
}

/* ─── Order Row ─────────────────────────────────────────────────────── */
function OrderRow({ order, onSelect, onView, isHighlighted }) {
  const payCfg = PAYMENT_STATUS[order.paymentStatus];
  const fulCfg = FULFILLMENT_STATUS[order.fulfillmentStatus];
  const methodCfg = PAYMENT_METHOD[order.paymentMethod];
  const pendingReceipts = order.payments?.filter(
    (p) => p.method === "BANK_RECEIPT" && p.status === "PENDING"
  ).length || 0;
  const unseen = isUnseen(order);
  const newOrder = isNewOrder(order);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`group cursor-pointer border-b border-gray-100 transition-colors
        ${isHighlighted
          ? "bg-amber-50/80 hover:bg-amber-50"
          : "hover:bg-[var(--color-primary)]/5"}`}
      onClick={() => onSelect(order)}
    >
      {/* Priority / New indicator */}
      <td className="px-2 py-3.5 w-1">
        {newOrder && (
          <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] mx-auto animate-pulse" title="سفارش جدید" />
        )}
        {!newOrder && unseen && (
          <div className="w-2 h-2 rounded-full bg-amber-400 mx-auto" title="نیاز به بررسی" />
        )}
      </td>

      {/* Tracking Code */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg
            ${unseen ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" : "bg-gray-100 text-gray-700"}`}>
            {order.trackingCode}
          </span>
          {pendingReceipts > 0 && (
            <span className="w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
              {pendingReceipts}
            </span>
          )}
          {newOrder && (
            <span className="text-[9px] bg-[var(--color-primary)] text-white font-black px-1.5 py-0.5 rounded-full">
              جدید
            </span>
          )}
        </div>
      </td>

      {/* User */}
      <td className="px-4 py-3.5">
        <div>
          <p className="text-xs font-bold text-gray-800">{getUserFullName(order.user) || "—"}</p>
          <p className="text-[10px] text-gray-400">{order.user?.phone || ""}</p>
        </div>
      </td>

      {/* Amount */}
      <td className="px-4 py-3.5 text-center">
        <span className="text-xs font-black text-gray-800">{formatPrice(order.totalPrice)}</span>
        <span className="text-[10px] text-gray-400 mr-0.5">ت</span>
      </td>

      {/* Payment Status */}
      <td className="px-4 py-3.5 text-center">
        <StatusBadge config={payCfg} size="xs" />
      </td>

      {/* Fulfillment Status */}
      <td className="px-4 py-3.5 text-center">
        <StatusBadge config={fulCfg} size="xs" />
      </td>

      {/* Method */}
      <td className="px-4 py-3.5 text-center">
        {methodCfg && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500">
            <methodCfg.icon size={10} />
            {methodCfg.label}
          </span>
        )}
      </td>

      {/* Date */}
      <td className="px-4 py-3.5 text-left">
        <span className="text-[10px] text-gray-400">{toFarsiDate(order.createdAt)}</span>
      </td>

      {/* Action */}
      <td className="px-4 py-3.5 text-center">
        <button
          onClick={(e) => { e.stopPropagation(); onView(order); }}
          title="مشاهده جزئیات"
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
          ${unseen
            ? "bg-[var(--color-primary)] text-white"
            : "bg-gray-100 group-hover:bg-[var(--color-primary)] text-gray-400 group-hover:text-white"}`}>
          <Eye size={13} />
        </button>
      </td>
    </motion.tr>
  );
}

/* ─── Filter Select ─────────────────────────────────────────────────── */
function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1.5">{label}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700
          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] bg-white transition"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Order Card (mobile) ───────────────────────────────────────────── */
function OrderCard({ order, onView, onOpen }) {
  const payCfg = PAYMENT_STATUS[order.paymentStatus];
  const fulCfg = FULFILLMENT_STATUS[order.fulfillmentStatus];
  const methodCfg = PAYMENT_METHOD[order.paymentMethod];
  const unseen = isUnseen(order);
  const newOrder = isNewOrder(order);

  return (
    <div className={`p-4 ${unseen ? "bg-amber-50/50" : ""}`}>
      <div className="flex items-center gap-2 mb-2.5">
        {(newOrder || unseen) && (
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${newOrder ? "bg-[var(--color-primary)] animate-pulse" : "bg-amber-400"}`} />
        )}
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg ${unseen ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" : "bg-gray-100 text-gray-700"}`}>
          {order.trackingCode}
        </span>
        <span className="text-[10px] text-gray-400 mr-auto">{toFarsiDate(order.createdAt)}</span>
      </div>

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-800 truncate">{getUserFullName(order.user) || "—"}</p>
          <p className="text-[10px] text-gray-400">{order.user?.phone || ""}</p>
        </div>
        <div className="text-left flex-shrink-0">
          <span className="text-sm font-black text-gray-800">{formatPrice(order.totalPrice)}</span>
          <span className="text-[10px] text-gray-400 mr-0.5">ت</span>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-1.5 mb-3">
        <StatusBadge config={payCfg} size="xs" />
        <StatusBadge config={fulCfg} size="xs" />
        {methodCfg && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
            <methodCfg.icon size={10} />
            {methodCfg.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onView(order)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold text-white bg-[var(--color-primary)] rounded-lg"
        >
          <Eye size={13} /> مشاهده جزئیات
        </button>
        <button
          onClick={() => onOpen(order)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg"
        >
          <ExternalLink size={13} /> ویرایش
        </button>
      </div>
    </div>
  );
}

/* ─── Order Detail Modal (read-only summary) ────────────────────────── */
function ModalSection({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={14} className="text-[var(--color-primary)]" />}
        <h3 className="text-xs font-black text-gray-700">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-[11px] font-bold text-gray-700 text-left break-words">{value ?? "—"}</span>
    </div>
  );
}

function OrderDetailModal({ orderId, onClose, onOpenFull }) {
  const [order, setOrder] = useState(null);
  const [installment, setInstallment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // مودال با key={orderId} در والد رندر می‌شود، پس هر بار تازه mount می‌شود و
  // مقدار اولیه‌ی loading/error درست است (نیازی به setState همگام در ابتدای افکت نیست)
  useEffect(() => {
    if (!orderId) return;
    let active = true;
    fetch(`/api/admin/orders/${orderId}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message || "خطا در دریافت سفارش");
        return d;
      })
      .then((d) => {
        if (!active) return;
        setOrder(d.order);
        setInstallment(d.installment || null);
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [orderId]);

  // بستن با Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const payCfg = order && PAYMENT_STATUS[order.paymentStatus];
  const fulCfg = order && FULFILLMENT_STATUS[order.fulfillmentStatus];
  const methodCfg = order && PAYMENT_METHOD[order.paymentMethod];
  const addr = order?.address?.snapshot;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full sm:max-w-2xl bg-[var(--admin-bg,#f4f5f2)] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-[var(--color-primary)] rounded-xl flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-gray-900 truncate">جزئیات سفارش</h2>
              {order && <p className="text-[11px] font-mono text-gray-400">{order.trackingCode}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={26} className="animate-spin text-[var(--color-primary)]" />
              <p className="text-sm text-gray-400">در حال بارگذاری...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-sm font-bold text-gray-500">{error}</p>
            </div>
          ) : order ? (
            <>
              {/* Status row */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge config={payCfg} />
                <StatusBadge config={fulCfg} />
                {methodCfg && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-1">
                    <methodCfg.icon size={11} /> {methodCfg.label}
                  </span>
                )}
              </div>

              {/* Order + Customer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ModalSection title="اطلاعات سفارش" icon={Hash}>
                  <InfoRow label="کد رهگیری" value={<span className="font-mono">{order.trackingCode}</span>} />
                  <InfoRow label="تاریخ ثبت" value={toFarsiDate(order.createdAt)} />
                  <InfoRow label="تعداد اقلام" value={formatPrice(order.items?.reduce((s, i) => s + (i.quantity || 0), 0))} />
                  {order.description ? <InfoRow label="توضیحات" value={order.description} /> : null}
                </ModalSection>

                <ModalSection title="اطلاعات مشتری" icon={User}>
                  <InfoRow label="نام" value={getUserFullName(order.user)} />
                  <InfoRow label="تلفن" value={order.user?.phone ? <span className="font-mono">{order.user.phone}</span> : "—"} />
                  <InfoRow label="ایمیل" value={order.user?.email ? <span className="font-mono">{order.user.email}</span> : "—"} />
                </ModalSection>
              </div>

              {/* Items */}
              <ModalSection title="اقلام سفارش" icon={Package}>
                <div className="space-y-2">
                  {(order.items || []).map((item, idx) => {
                    const vLabel = variantLabelOf(item);
                    const productName = item.product?.name || "محصول";
                    const { farsi, english } = splitProductName(productName);
                    const productHref = item.product?.slug
                      ? item.itemType === "used_product"
                        ? `/second-hand/${item.product.slug}`
                        : `/products/${item.product.slug}`
                      : null;
                    const productNameContent = (
                      <>
                        {farsi && (
                          <span className="block text-sm font-bold leading-snug text-gray-800 transition-colors duration-200 group-hover/name:text-[var(--color-primary)] group-focus-visible/name:text-[var(--color-primary)] [overflow-wrap:anywhere]">
                            {farsi}
                          </span>
                        )}
                        {english && (
                          <span
                            className="mt-0.5 block text-xs font-semibold leading-snug text-gray-500 transition-colors duration-200 group-hover/name:text-[var(--color-primary)] group-focus-visible/name:text-[var(--color-primary)] [overflow-wrap:anywhere]"
                            dir="ltr"
                          >
                            {english}
                          </span>
                        )}
                      </>
                    );
                    return (
                      <div key={idx} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                        <div className="w-11 h-11 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.product?.mainImage ? (
                            <img src={item.product.mainImage} alt={productName} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={16} className="text-gray-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {productHref ? (
                            <a
                              href={productHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/name block min-w-0 max-w-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
                              aria-label={`مشاهده محصول ${productName} در تب جدید`}
                            >
                              {productNameContent}
                            </a>
                          ) : (
                            <div className="min-w-0 max-w-full">{productNameContent}</div>
                          )}
                          {vLabel ? <p className="text-[10px] text-gray-400 truncate">{vLabel}</p> : null}
                          {(item.flowSelections || []).filter((s) => s.nodeType === "category" || s.selectedProductName || s.nodeLabel).length > 0 && (
                            <p className="text-[10px] text-[var(--color-primary)]/80 truncate">
                              {item.flowSelections.map((s) => s.nodeLabel || s.selectedProductName).filter(Boolean).join("، ")}
                            </p>
                          )}
                        </div>
                        <div className="text-left flex-shrink-0">
                          <p className="text-[11px] font-black text-gray-800">{formatPrice(item.unitPrice)} <span className="text-[9px] text-gray-400">ت</span></p>
                          <p className="text-[10px] text-gray-400">تعداد: {formatPrice(item.quantity)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ModalSection>

              {/* Price summary + Payment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ModalSection title="خلاصه مبلغ" icon={Receipt}>
                  <InfoRow label="جمع اقلام" value={`${formatPrice(order.subtotalPrice)} ت`} />
                  {order.discountAmount > 0 && <InfoRow label="تخفیف" value={`${formatPrice(order.discountAmount)} ت`} />}
                  {order.couponDiscount > 0 && (
                    <InfoRow
                      label={order.coupon?.isManual ? "تخفیف مدیریت" : `تخفیف کد ${order.coupon?.code || ""}`}
                      value={`${formatPrice(order.couponDiscount)} ت`}
                    />
                  )}
                  <InfoRow label="مبلغ کل" value={<span className="text-[var(--color-primary)] font-black">{formatPrice(order.totalPrice)} ت</span>} />
                  {order.priceEUR ? <InfoRow label="مبلغ یورویی" value={`€ ${formatPrice(order.priceEUR)}`} /> : null}
                </ModalSection>

                <ModalSection title="پرداخت" icon={CreditCard}>
                  <InfoRow label="روش" value={methodCfg?.label} />
                  <InfoRow label="وضعیت" value={payCfg?.label} />
                  {(order.payments || []).map((p, i) => (
                    <InfoRow key={i} label={PAYMENT_METHOD[p.method]?.label || p.method}
                      value={`${formatPrice(p.amount)} ت · ${PAYMENT_STATUS[p.status]?.label || p.status}`} />
                  ))}
                  {installment ? <InfoRow label="اقساط" value={`${formatPrice(installment.numberOfChecks)} چک`} /> : null}
                </ModalSection>
              </div>

              {/* Shipping + Tracking */}
              <ModalSection title="ارسال و رهگیری" icon={MapPin}>
                {addr ? (
                  <>
                    <InfoRow label="گیرنده" value={addr.fullName} />
                    <InfoRow label="تلفن" value={addr.phone ? <span className="font-mono">{addr.phone}</span> : "—"} />
                    <InfoRow label="استان / شهر" value={[addr.province, addr.city].filter(Boolean).join(" - ") || "—"} />
                    <InfoRow label="نشانی" value={addr.addressLine} />
                    <InfoRow label="کد پستی" value={addr.postalCode ? <span className="font-mono">{addr.postalCode}</span> : "—"} />
                  </>
                ) : (
                  <p className="text-[11px] font-bold text-gray-400 py-1">نشانی ثبت نشده است</p>
                )}
                <InfoRow label="وضعیت ارسال" value={fulCfg?.label} />
                <InfoRow label="کد رهگیری سفارش" value={<span className="font-mono">{order.trackingCode}</span>} />
              </ModalSection>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3.5 bg-white border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => onOpenFull(orderId)}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition"
          >
            <ExternalLink size={15} /> باز کردن صفحه کامل سفارش
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
          >
            بستن
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function AdminOrdersClient() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [viewOrderId, setViewOrderId] = useState(null); // مودال جزئیات سفارش

  const fetchOrders = useCallback(async (resetPage = false) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "20",
        search,
        paymentStatus,
        fulfillmentStatus,
        paymentMethod,
      });
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setOrders(data.orders || []);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (err) {
      toast.error(err.message || "خطا در دریافت سفارشات");
    } finally {
      setLoading(false);
    }
  }, [page, search, paymentStatus, fulfillmentStatus, paymentMethod]);

  useEffect(() => { fetchOrders(); }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders(true);
  };

  const handleFilterChange = () => { fetchOrders(true); };

  // ترتیب نمایش همان ترتیب سرور است: تاریخ ثبت، جدیدترین اول.
  // سفارش‌های دیده‌نشده فقط با هایلایت بصری متمایز می‌شوند، نه با جابه‌جایی.
  const sortedOrders = orders;

  const pendingReceiptsCount = orders.reduce(
    (acc, o) =>
      acc + (o.payments?.filter((p) => p.method === "BANK_RECEIPT" && p.status === "PENDING").length || 0),
    0
  );

  const newOrdersCount = orders.filter(isNewOrder).length;
  const unseenCount = orders.filter(isUnseen).length;

  const handleSelectOrder = (order) => {
    router.push(`/p-admin/admin-orders/${order._id}`);
  };

  const handleViewOrder = (order) => setViewOrderId(order._id);

  return (
    <div className="min-h-screen" style={{ background: "var(--admin-bg, #f4f5f2)" }}>
      <div className="max-w-7xl mx-auto p-5 space-y-5">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[var(--color-primary)] rounded-xl flex items-center justify-center">
                <ShoppingCart size={15} className="text-white" />
              </div>
              مدیریت سفارشات
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              بررسی و مدیریت تمام سفارش‌ها، رسیدها و وضعیت ارسال
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOrders()} disabled={loading}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600
                hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              بروزرسانی
            </button>
          </div>
        </div>

        {/* ─── Stats Grid ─── */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* فاز ۳ — «درآمد تأیید شده» حذف شد و گرید به ۴ ستون هماهنگ شد */}
            <StatCard title="کل سفارشات" value={new Intl.NumberFormat("fa-IR").format(stats.total)}
              icon={ShoppingCart} color="bg-[var(--color-primary)]/10 text-[var(--color-primary)]" />
            <StatCard title="پرداخت نشده" value={new Intl.NumberFormat("fa-IR").format(stats.unpaid)}
              icon={XCircle} color="bg-red-100 text-red-600" />
            <StatCard title="پرداخت کامل" value={new Intl.NumberFormat("fa-IR").format(stats.paid)}
              icon={CheckCircle} color="bg-green-100 text-green-600" />
            <StatCard title="در حال پردازش" value={new Intl.NumberFormat("fa-IR").format(stats.processing)}
              icon={Package} color="bg-[color:var(--color-primary)]/10 text-[var(--color-primary)]" />
          </div>
        )}

        {/* ─── Alerts ─── */}
        <div className="space-y-2">
          <AnimatePresence>
            {newOrdersCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/30 rounded-2xl px-4 py-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-[var(--color-primary)] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--color-primary)]">
                    {new Intl.NumberFormat("fa-IR").format(newOrdersCount)} سفارش جدید در ۲۴ ساعت اخیر
                  </p>
                  <p className="text-xs text-[var(--color-primary)]/70 mt-0.5">
                    این سفارش‌ها در بالای لیست نمایش داده می‌شوند
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {pendingReceiptsCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-800">
                    {new Intl.NumberFormat("fa-IR").format(pendingReceiptsCount)} رسید بانکی در انتظار تأیید
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">روی سفارش کلیک کنید تا وارد صفحه بررسی شوید</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Filters Bar ─── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو با کد رهگیری یا نام خریدار..."
                className="w-full pr-9 pl-4 py-2.5 text-sm border border-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition"
              />
            </div>
            <button type="submit"
              className="bg-[var(--color-primary)] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[var(--color-primary-hover)] transition">
              جستجو
            </button>
            <button type="button" onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl border transition
                ${showFilters
                  ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"}`}>
              <Filter size={13} />
              فیلتر
              <ChevronDown size={12} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
          </form>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1"
              >
                <FilterSelect label="وضعیت پرداخت" value={paymentStatus}
                  onChange={(v) => { setPaymentStatus(v); handleFilterChange(); }}
                  options={[
                    { value: "all", label: "همه" },
                    ...Object.entries(PAYMENT_STATUS).map(([k, v]) => ({ value: k, label: v.label })),
                  ]} />
                <FilterSelect label="وضعیت ارسال" value={fulfillmentStatus}
                  onChange={(v) => { setFulfillmentStatus(v); handleFilterChange(); }}
                  options={[
                    { value: "all", label: "همه" },
                    ...Object.entries(FULFILLMENT_STATUS).map(([k, v]) => ({ value: k, label: v.label })),
                  ]} />
                <FilterSelect label="روش پرداخت" value={paymentMethod}
                  onChange={(v) => { setPaymentMethod(v); handleFilterChange(); }}
                  options={[
                    { value: "all", label: "همه" },
                    ...Object.entries(PAYMENT_METHOD).map(([k, v]) => ({ value: k, label: v.label })),
                  ]} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Table ─── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
              <p className="text-sm text-gray-400">در حال بارگذاری سفارشات...</p>
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Inbox size={40} className="text-gray-300" />
              <p className="text-sm text-gray-400 font-bold">هیچ سفارشی یافت نشد</p>
              <p className="text-xs text-gray-300">فیلترها را تغییر دهید یا جستجو را پاک کنید</p>
            </div>
          ) : (
            <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {sortedOrders.map((order) => (
                <OrderCard
                  key={order._id}
                  order={order}
                  onView={handleViewOrder}
                  onOpen={handleSelectOrder}
                />
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full" dir="rtl">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="px-2 py-3 w-3"></th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">کد رهگیری</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">خریدار</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">مبلغ</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">وضعیت پرداخت</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">وضعیت ارسال</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">روش پرداخت</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">تاریخ</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order) => (
                    <OrderRow
                      key={order._id}
                      order={order}
                      onSelect={handleSelectOrder}
                      onView={handleViewOrder}
                      isHighlighted={isUnseen(order)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                نمایش {((pagination.page - 1) * 20) + 1}–{Math.min(pagination.page * 20, pagination.total)} از{" "}
                {new Intl.NumberFormat("fa-IR").format(pagination.total)} سفارش
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-500
                    hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={14} />
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const p = i + Math.max(1, page - 2);
                  if (p > pagination.totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold border transition
                        ${p === page
                          ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                          : "border-gray-200 text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"}`}
                    >
                      {new Intl.NumberFormat("fa-IR").format(p)}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-500
                    hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order detail modal */}
      <AnimatePresence>
        {viewOrderId && (
          <OrderDetailModal
            key={viewOrderId}
            orderId={viewOrderId}
            onClose={() => setViewOrderId(null)}
            onOpenFull={(id) => { setViewOrderId(null); router.push(`/p-admin/admin-orders/${id}`); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
