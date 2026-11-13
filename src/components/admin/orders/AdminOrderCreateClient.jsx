"use client";

/**
 * ایجاد سفارش برای یک مشتری توسط ادمین.
 *
 * مشتری → آدرس → اقلام → روش پرداخت → «تأیید و ثبت سفارش».
 * ثبتِ نهایی POST /api/admin/orders است که از همان services/placeOrder.js ِ
 * ثبتِ سفارشِ مشتری می‌گذرد؛ این صفحه فقط ورودی جمع می‌کند و قیمتی حساب نمی‌کند:
 * مبلغ‌ها از پیش‌نمایشِ سرور (dryRun) می‌آیند و با expectedTotal دوباره چک می‌شوند.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toast } from "react-toastify";
import {
  ChevronRight, User, MapPin, Package, CreditCard, Search, Plus, Minus,
  Trash2, Loader2, Receipt, Calendar, CheckCircle, X, AlertCircle,
} from "lucide-react";
import { getUserFullName } from "base/utils/userName";
import OrderFlowSelectionsView from "@/components/order/OrderFlowSelectionsView";
import ReceiptUploader from "@/components/payments/ReceiptUploader";

const AddItemModal = dynamic(() =>
  import("@/components/admin/orders/AdminOrderDetailClient").then((m) => m.AddItemModal));
const InstallmentPage = dynamic(() => import("@/components/payments/InstallmentPage"));

const formatPrice = (v) => new Intl.NumberFormat("fa-IR").format(Number(v ?? 0));
const inputClass = `w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800
  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition`;
const EMPTY_ADDRESS = { title: "", fullName: "", phone: "", city: "", postalCode: "", addressLine: "" };

async function api(url, options) {
  const res = await fetch(url, options && {
    ...options,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "خطا در ارتباط با سرور");
  return data;
}

function Section({ step, icon: Icon, title, action, children, disabled }) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-100 p-5 space-y-4 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-black flex items-center justify-center">
            {formatPrice(step)}
          </span>
          <Icon size={14} className="text-[var(--color-primary)]" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ─── ۱. مشتری ─────────────────────────────────────────────────────── */
function CustomerPicker({ customer, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = هنوز جستجو نشده
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);
  const request = useRef(null);

  useEffect(() => () => { clearTimeout(timer.current); request.current?.abort(); }, []);

  const handleQuery = (value) => {
    setQuery(value);
    clearTimeout(timer.current);
    request.current?.abort();
    if (!value.trim()) { setResults(null); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const res = await fetch(`/api/admin/orders/customers?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "خطا در جستجوی کاربر");
        setResults(data.users || []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults([]);
        toast.error(error.message);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
  };

  if (customer) {
    return (
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
          <User size={16} className="text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{getUserFullName(customer, "بدون نام")}</p>
          <p className="text-xs text-gray-400 truncate">
            <span dir="ltr" className="font-mono">{customer.phone}</span>
            {customer.email ? ` · ${customer.email}` : " · بدون ایمیل (ایمیل تأیید فقط برای مدیریت ارسال می‌شود)"}
          </p>
        </div>
        <button type="button" onClick={() => { onChange(null); setQuery(""); setResults(null); }}
          className="text-xs text-gray-400 hover:text-gray-600 font-bold">× تغییر</button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" value={query} autoComplete="off" autoFocus
          onChange={(e) => handleQuery(e.target.value)}
          placeholder="نام، شماره موبایل یا ایمیل مشتری..."
          aria-label="جستجوی مشتری"
          className={`${inputClass} pr-9`}
        />
        {searching && <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
      </div>
      {results && !searching && (
        <ul className="mt-2 border border-gray-200 rounded-xl max-h-72 overflow-y-auto">
          {results.length === 0
            ? <li className="px-4 py-6 text-sm text-gray-400 text-center">کاربری یافت نشد</li>
            : results.map((user) => (
              <li key={user._id} className="border-b border-gray-50 last:border-none">
                <button type="button" onClick={() => onChange(user)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-right hover:bg-gray-50 transition">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-800 truncate">{getUserFullName(user, "بدون نام")}</span>
                    <span className="block text-xs text-gray-400 truncate">{user.email || "بدون ایمیل"}</span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {user.isBanned && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-md px-1.5 py-0.5">مسدود</span>}
                    <span dir="ltr" className="text-xs font-mono text-gray-500">{user.phone}</span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

/* ─── ۲. آدرس ──────────────────────────────────────────────────────── */
function AddressPicker({ customer, addressId, onSelect }) {
  const [addresses, setAddresses] = useState(null); // null = در حال بارگذاری
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    api(`/api/admin/orders/customers?userId=${customer._id}`)
      .then((data) => {
        if (!active) return;
        setError("");
        setAddresses(data.addresses || []);
        const preferred = data.addresses?.find((a) => a.isDefault) || data.addresses?.[0];
        if (preferred) onSelect(preferred._id);
        else setFormOpen(true);
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [customer._id, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const openForm = () => {
    setForm({ ...EMPTY_ADDRESS, fullName: getUserFullName(customer), phone: customer.phone || "" });
    setFieldErrors({});
    setFormOpen(true);
  };

  const saveAddress = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const res = await fetch("/api/admin/orders/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, userId: customer._id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFieldErrors(data.fieldErrors || {});
        throw new Error(data.message || "خطا در ثبت آدرس");
      }
      setAddresses((prev) => [data.address, ...(prev || [])]);
      onSelect(data.address._id);
      setFormOpen(false);
      toast.success("آدرس برای مشتری ثبت شد");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
        <p>{error}</p>
        <button type="button" onClick={() => { setError(""); setReload((n) => n + 1); }} className="mt-2 font-bold underline">تلاش دوباره</button>
      </div>
    );
  }
  if (!addresses) {
    return <p className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> بارگذاری آدرس‌های مشتری...</p>;
  }

  const field = (key, label, props = {}) => (
    <label className="block">
      <span className="block text-xs font-bold text-gray-500 mb-1.5">{label}</span>
      <input
        value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        aria-invalid={!!fieldErrors[key]}
        className={`${inputClass} ${fieldErrors[key] ? "border-red-400" : ""}`} {...props}
      />
      {fieldErrors[key] && <span className="block text-[11px] text-red-600 mt-1">{fieldErrors[key]}</span>}
    </label>
  );

  return (
    <div className="space-y-3">
      {addresses.length === 0 && !formOpen && (
        <p className="text-sm text-gray-400">این مشتری هنوز آدرسی ثبت نکرده است.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {addresses.map((address) => {
          const selected = addressId === address._id;
          return (
            <label key={address._id}
              className={`flex gap-2.5 p-3 rounded-xl cursor-pointer transition border
                ${selected ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30" : "bg-white border-gray-200 hover:border-[var(--color-primary)]/30"}`}>
              <input type="radio" name="order-address" checked={selected} onChange={() => onSelect(address._id)}
                className="accent-[var(--color-primary)] mt-1" />
              <span className="min-w-0 text-xs text-gray-600 leading-6">
                <span className="block text-sm font-bold text-gray-800">
                  {address.title || address.fullName}
                  {address.isDefault && <span className="mr-1.5 text-[10px] text-gray-400 font-normal">(پیش‌فرض)</span>}
                </span>
                <span className="block">{address.fullName} · <span dir="ltr" className="font-mono">{address.phone}</span></span>
                <span className="block">{address.city} — {address.addressLine}</span>
                {address.postalCode && <span className="block text-gray-400">کد پستی: {address.postalCode}</span>}
              </span>
            </label>
          );
        })}
      </div>

      {formOpen ? (
        <form onSubmit={saveAddress} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/60">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-700">آدرس جدید برای مشتری</p>
            {addresses.length > 0 && (
              <button type="button" onClick={() => setFormOpen(false)} aria-label="بستن فرم آدرس" className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("fullName", "نام و نام خانوادگی گیرنده *")}
            {field("phone", "شماره موبایل گیرنده *", { inputMode: "numeric", dir: "ltr", placeholder: "09xxxxxxxxx" })}
            {field("city", "شهر *")}
            {field("postalCode", "کد پستی", { inputMode: "numeric", dir: "ltr" })}
            {field("title", "عنوان آدرس (مثلاً خانه)")}
          </div>
          {field("addressLine", "آدرس کامل *")}
          <button type="submit" disabled={saving}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            ثبت آدرس
          </button>
        </form>
      ) : (
        <button type="button" onClick={openForm}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] border border-[var(--color-primary)]/30 rounded-lg px-3 py-2 hover:bg-[var(--color-primary)]/5 transition">
          <Plus size={12} /> افزودن آدرس جدید
        </button>
      )}
    </div>
  );
}

/* ─── صفحه ─────────────────────────────────────────────────────────── */
export default function AdminOrderCreateClient() {
  const router = useRouter();
  const [customer, setCustomer] = useState(null);
  const [addressId, setAddressId] = useState(null);
  const [items, setItems] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [priced, setPriced] = useState(null); // { key, data } | { key, error }
  const [retry, setRetry] = useState(0);
  const [method, setMethod] = useState("BANK_RECEIPT");
  const [planNow, setPlanNow] = useState(true);
  const [receiptUrls, setReceiptUrls] = useState([]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nextKey = useRef(0);

  const lines = items.map(({ product, variantId, quantity, flowSelections }) => (
    { productId: product._id, variantId, quantity, flowSelections }
  ));
  // قیمت به مشتری هم بستگی دارد (تخفیف‌های نقش/سطح)، پس کلید هر دو را دارد.
  const priceKey = customer && items.length ? JSON.stringify([customer._id, lines]) : "";

  useEffect(() => {
    if (!priceKey) return;
    const controller = new AbortController();
    const [userId, payload] = JSON.parse(priceKey);
    fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, items: payload, dryRun: true }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "خطا در محاسبه قیمت");
        setPriced({ key: priceKey, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setPriced({ key: priceKey, error: error.message });
      });
    return () => controller.abort();
  }, [priceKey, retry]);

  // نتیجه‌ی یک درخواستِ قدیمی هرگز به‌جای قیمتِ اقلامِ فعلی نشان داده نمی‌شود.
  const current = priced?.key === priceKey ? priced : null;
  const pricing = current?.data || null;
  const pricingError = current?.error || "";
  const total = pricing?.totalToman ?? 0;
  const ready = !!customer && !!addressId && !!pricing && total > 0;

  const selectCustomer = (user) => {
    setCustomer(user);
    setAddressId(null);
  };

  const changeQuantity = (key, delta) => setItems((prev) => prev.map((item) => (
    item.key === key ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
  )));

  const submit = async (paymentFields) => {
    setSubmitting(true);
    try {
      const data = await api("/api/admin/orders", {
        method: "POST",
        body: {
          userId: customer._id, items: lines, addressId, paymentMethod: method,
          description, expectedTotal: total, ...paymentFields,
        },
      });
      toast.success(`${data.message} — کد رهگیری: ${data.trackingCode}`);
      router.push(`/p-admin/admin-orders/${data.orderId}`);
    } catch (error) {
      setSubmitting(false);
      // قیمت عوض شده یا قلمی دیگر معتبر نیست: پیش‌نمایش را تازه کن تا ادمین مبلغِ جدید را ببیند
      setRetry((n) => n + 1);
      throw error;
    }
  };

  const submitDirect = () => submit(method === "BANK_RECEIPT" ? { receiptImageUrls: receiptUrls } : {})
    .catch((error) => toast.error(error.message));

  const withPlan = method === "INSTALLMENT" && planNow;

  return (
    <div className="space-y-4 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3">
        <Link href="/p-admin/admin-orders" aria-label="بازگشت به سفارشات"
          className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition">
          <ChevronRight size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-black text-gray-800">ایجاد سفارش</h1>
          <p className="text-xs text-gray-400">سفارش به نام مشتری و دقیقاً مثل سفارشی که خودش ثبت می‌کند ثبت می‌شود.</p>
        </div>
      </div>

      <Section step={1} icon={User} title="مشتری">
        <CustomerPicker customer={customer} onChange={selectCustomer} />
      </Section>

      <Section step={2} icon={MapPin} title="آدرس تحویل" disabled={!customer}>
        {customer
          ? <AddressPicker key={customer._id} customer={customer} addressId={addressId} onSelect={setAddressId} />
          : <p className="text-sm text-gray-400">ابتدا مشتری را انتخاب کنید.</p>}
      </Section>

      <Section step={3} icon={Package} title="اقلام سفارش" disabled={!customer}
        action={customer && (
          <button type="button" onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg px-3 py-1.5 transition">
            <Plus size={12} /> افزودن آیتم
          </button>
        )}>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">
            {customer ? "هنوز قلمی اضافه نشده است." : "ابتدا مشتری را انتخاب کنید."}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => {
              const line = pricing?.items?.[index];
              return (
                <li key={item.key} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    {item.product.image
                      ? <img src={item.product.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                      : <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{item.product.label}</p>
                      {item.variantLabel && <p className="text-xs text-gray-400 truncate">{item.variantLabel}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button type="button" aria-label="کاهش تعداد" onClick={() => changeQuantity(item.key, -1)} disabled={item.quantity <= 1}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-[var(--color-primary)] disabled:opacity-40 transition">
                        <Minus size={12} />
                      </button>
                      <span className="w-7 text-center text-sm font-black text-gray-800">{formatPrice(item.quantity)}</span>
                      <button type="button" aria-label="افزایش تعداد" onClick={() => changeQuantity(item.key, 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-[var(--color-primary)] transition">
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="w-32 text-left flex-shrink-0">
                      {line ? (
                        <>
                          <p className="text-sm font-black text-gray-800">{formatPrice(line.unitPrice * item.quantity)} <span className="text-[10px] font-normal text-gray-400">تومان</span></p>
                          {item.quantity > 1 && <p className="text-[10px] text-gray-400">هر عدد {formatPrice(line.unitPrice)}</p>}
                          {line.unitDiscount > 0 && <p className="text-[10px] text-green-600">تخفیف هر عدد {formatPrice(line.unitDiscount)}</p>}
                        </>
                      ) : !pricingError && <Loader2 size={14} className="animate-spin text-gray-300 mr-auto" />}
                    </div>
                    <button type="button" aria-label="حذف آیتم" onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                      className="text-gray-300 hover:text-red-500 transition flex-shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {line?.flowSelections?.length > 0 && <OrderFlowSelectionsView flowSelections={line.flowSelections} />}
                </li>
              );
            })}
          </ul>
        )}

        {pricingError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <div>
              <p>{pricingError}</p>
              <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-1 font-bold underline">تلاش دوباره</button>
            </div>
          </div>
        )}

        {pricing && (
          <dl className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500"><dt>جمع اقلام</dt><dd>{formatPrice(pricing.subtotalToman)} تومان</dd></div>
            {pricing.discountToman > 0 && (
              <div className="flex justify-between text-green-600"><dt>تخفیف</dt><dd>{formatPrice(pricing.discountToman)}− تومان</dd></div>
            )}
            <div className="flex justify-between font-black text-gray-800 text-base"><dt>مبلغ قابل پرداخت</dt><dd>{formatPrice(total)} تومان</dd></div>
          </dl>
        )}

        <label className="block">
          <span className="block text-xs font-bold text-gray-500 mb-1.5">توضیحات سفارش (اختیاری)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000}
            className={inputClass} />
        </label>
      </Section>

      <Section step={4} icon={CreditCard} title="روش پرداخت" disabled={!ready}>
        {!ready ? (
          <p className="text-sm text-gray-400">پس از انتخاب مشتری، آدرس و دست‌کم یک قلم، روش پرداخت را انتخاب کنید.</p>
        ) : (
          <fieldset disabled={submitting} className="space-y-4 min-w-0">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { value: "BANK_RECEIPT", label: "رسید بانکی", hint: "کارت‌به‌کارت / واریز به حساب", icon: Receipt },
                { value: "INSTALLMENT", label: "اقساطی", hint: "پیش‌پرداخت + چک", icon: Calendar },
              ].map(({ value, label, hint, icon: Icon }) => (
                <label key={value}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition border
                    ${method === value ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30" : "bg-white border-gray-200 hover:border-[var(--color-primary)]/30"}`}>
                  <input type="radio" name="payment-method" checked={method === value} onChange={() => setMethod(value)}
                    className="accent-[var(--color-primary)]" />
                  <Icon size={16} className="text-[var(--color-primary)]" />
                  <span>
                    <span className="block text-sm font-bold text-gray-800">{label}</span>
                    <span className="block text-[11px] text-gray-400">{hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {method === "BANK_RECEIPT" && (
              <>
                <p className="text-xs text-gray-500 leading-6">
                  بارگذاری رسید اختیاری است. با رسید، پرداخت «در انتظار بررسی» ثبت می‌شود؛ بدون رسید، سفارش «پرداخت‌نشده»
                  ثبت می‌شود و مشتری می‌تواند از حساب خودش رسید را بارگذاری کند.
                </p>
                <ReceiptUploader onFileChange={setReceiptUrls} />
              </>
            )}

            {method === "INSTALLMENT" && (
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={planNow} onChange={(e) => setPlanNow(e.target.checked)}
                  className="accent-[var(--color-primary)] mt-1" />
                <span>
                  پیش‌پرداخت و چک‌ها را همین حالا ثبت می‌کنم
                  <span className="block text-[11px] text-gray-400">
                    اگر خاموش باشد، سفارش «پرداخت‌نشده» ثبت می‌شود و مشتری طرح اقساط را از حساب خودش کامل می‌کند.
                  </span>
                </span>
              </label>
            )}

            {withPlan ? (
              // تصویرِ رسید و چک و شماره‌ی چک اختیاری است؛ مبلغ‌ها و سررسیدها نه.
              <InstallmentPage embedded order={{ totalPrice: total }} onFinalSubmit={submit} submitLabel="تأیید و ثبت سفارش" />
            ) : (
              <button type="button" onClick={submitDirect} disabled={submitting}
                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-3.5 rounded-xl text-base transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle size={17} />}
                {submitting ? "در حال ثبت سفارش..." : "تأیید و ثبت سفارش"}
              </button>
            )}
          </fieldset>
        )}
      </Section>

      {addOpen && (
        <AddItemModal
          onClose={() => setAddOpen(false)}
          onPick={(pick) => setItems((prev) => [...prev, { ...pick, key: nextKey.current++ }])}
        />
      )}
    </div>
  );
}
