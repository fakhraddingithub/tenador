"use client";

import Link from "next/link";
import {
    FiCheckCircle,
    FiClipboard,
    FiShoppingBag,
    FiHome,
    FiMapPin,
} from "react-icons/fi";
import { useEffect, useState } from "react";

// جداسازی نام فارسی و انگلیسی
function splitName(text) {
    if (!text) return { farsi: "", english: "" };
    const match = text.match(/[a-zA-Z(].*/);
    if (match) {
        return {
            farsi:   text.substring(0, match.index).trim(),
            english: match[0].trim(),
        };
    }
    return { farsi: text, english: "" };
}

function formatPrice(price) {
    return new Intl.NumberFormat("fa-IR").format(Number(price ?? 0));
}

const PAYMENT_LABEL = {
    BANK_RECEIPT: "فیش بانکی",
    INSTALLMENT:  "اقساطی",
    ONLINE:       "پرداخت آنلاین",
};

export default function PaymentSuccessPage({ trackingCode }) {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadOrder = async () => {
            try {
                const res = await fetch(`/api/orders/${trackingCode}`, {
                    method:      "GET",
                    credentials: "include",
                    headers:     { "Content-Type": "application/json" },
                    cache:       "no-store",
                });
                const data = await res.json();
                setOrder(data.order);
            } catch (error) {
                console.error("Error fetching order:", error);
            } finally {
                setLoading(false);
            }
        };
        loadOrder();
    }, [trackingCode]); // eslint-disable-line

    return (
        <div className="min-h-screen bg-[var(--color-background)] py-8 px-4">
            <div className="max-w-2xl mx-auto">

                {/* Success Card */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

                    {/* Header */}
                    <div className="bg-[var(--color-primary)] text-white p-8 text-center">
                        <FiCheckCircle className="mx-auto text-6xl mb-4" />
                        <h1 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">
                            سفارش شما با موفقیت ثبت شد
                        </h1>
                        <p className="text-white/90 text-sm md:text-base leading-7">
                            از خرید شما سپاسگزاریم.{" "}
                            {order?.paymentMethod === "ONLINE"
                                ? "پرداخت شما تأیید شد."
                                : "اطلاعات پرداخت ثبت شده و پس از بررسی ادمین اعلام خواهد شد."}
                        </p>
                    </div>

                    <div className="p-6 md:p-8 space-y-6">

                        {/* Status Alert */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-amber-800 text-sm md:text-base">
                                وضعیت سفارش:
                                <span className="font-bold mx-1">
                                    {order?.paymentStatus === "PAID"
                                        ? "«پرداخت تأیید شد»"
                                        : "«در انتظار تایید پرداخت»"}
                                </span>
                            </p>
                        </div>

                        {/* Order Meta */}
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <div className="bg-gray-50 px-5 py-3.5 border-b border-gray-100">
                                <h2 className="font-bold text-base flex items-center gap-2 text-[#1a1a1a]">
                                    <FiClipboard className="text-[var(--color-primary)]" />
                                    خلاصه سفارش
                                </h2>
                            </div>
                            <div className="divide-y divide-gray-50">
                                <div className="flex justify-between items-center px-5 py-3">
                                    <span className="text-gray-500 text-sm">شماره سفارش</span>
                                    <span className="font-bold font-mono text-sm text-[#1a1a1a]">
                                        {order?.trackingCode ?? "—"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center px-5 py-3">
                                    <span className="text-gray-500 text-sm">روش پرداخت</span>
                                    <span className="text-sm font-medium text-[#1a1a1a]">
                                        {PAYMENT_LABEL[order?.paymentMethod] ?? "—"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center px-5 py-3">
                                    <span className="text-gray-500 text-sm">وضعیت</span>
                                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                        order?.paymentStatus === "PAID"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-orange-100 text-orange-700"
                                    }`}>
                                        {order?.paymentStatus === "PAID" ? "پرداخت شده" : "در انتظار تایید"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Items */}
                        {!loading && order?.items?.length > 0 && (
                            <div className="border border-gray-100 rounded-xl overflow-hidden">
                                <div className="bg-gray-50 px-5 py-3.5 border-b border-gray-100">
                                    <h2 className="font-bold text-base text-[#1a1a1a]">اقلام سفارش</h2>
                                </div>
                                <div className="divide-y divide-gray-50 p-2">
                                    {order.items.map((item, idx) => {
                                        const productName  = item.product?.name ?? "";
                                        const productImage = item.product?.mainImage ?? "";
                                        const { farsi, english } = splitName(productName);
                                        const variantAttrs = item.variant?.attributes ?? null;
                                        const unitPrice    = item.unitPrice ?? 0;
                                        const totalLine    = unitPrice * (item.quantity ?? 1);

                                        return (
                                            <div key={item.product?._id ?? idx} className="flex gap-3 py-3 px-2">
                                                {/* تصویر */}
                                                {productImage && (
                                                    <img
                                                        src={productImage}
                                                        alt={productName}
                                                        className="w-14 h-14 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                                                    />
                                                )}
                                                {/* اطلاعات */}
                                                <div className="flex-1 min-w-0">
                                                    {/* نام */}
                                                    <div>
                                                        {farsi && (
                                                            <p className="text-sm font-bold text-[#1a1a1a] leading-snug tracking-tight line-clamp-1">
                                                                {farsi}
                                                            </p>
                                                        )}
                                                        {english && (
                                                            <span className="block text-xs font-bold text-[#444] tracking-tight" dir="ltr">
                                                                {english}
                                                            </span>
                                                        )}
                                                        {!farsi && !english && productName && (
                                                            <p className="text-sm font-bold text-[#1a1a1a] leading-snug tracking-tight">
                                                                {productName}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {/* واریانت */}
                                                    {variantAttrs && Object.keys(variantAttrs).length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {Object.entries(variantAttrs).map(([k, v]) => (
                                                                <span
                                                                    key={k}
                                                                    className="text-[10px] bg-[#aa4725]/8 text-[#aa4725] border border-[#aa4725]/20 px-2 py-0.5 rounded-full"
                                                                >
                                                                    {k}: {v}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* قیمت و تعداد */}
                                                    <div className="flex items-center justify-between mt-1.5">
                                                        <span className="text-xs text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-full font-semibold">
                                                            × {item.quantity}
                                                        </span>
                                                        <div className="flex items-baseline gap-0.5">
                                                            <span className="text-sm font-bold text-[#1a1a1a] tracking-tight">
                                                                {formatPrice(totalLine)}
                                                            </span>
                                                            <span className="text-[10px] text-gray-500 font-medium">تومان</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* قیمت کل */}
                                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                                    {(order.discountAmount > 0 || order.couponDiscount > 0) && (
                                        <div className="space-y-2 mb-3 text-sm">
                                            {order.discountAmount > 0 && (
                                                <div className="flex justify-between text-emerald-600">
                                                    <span>تخفیف</span>
                                                    <span className="font-medium">− {formatPrice(order.discountAmount)} تومان</span>
                                                </div>
                                            )}
                                            {order.couponDiscount > 0 && (
                                                <div className="flex justify-between text-emerald-600">
                                                    <span>تخفیف کد «{order.coupon?.code}»</span>
                                                    <span className="font-medium">− {formatPrice(order.couponDiscount)} تومان</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-[#1a1a1a] text-sm">مبلغ قابل پرداخت:</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-bold text-[var(--color-primary)] tracking-tight">
                                                {formatPrice(order?.totalPrice ?? 0)}
                                            </span>
                                            <span className="text-xs font-bold text-[var(--color-primary)]/70">تومان</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* آدرس */}
                        {order?.address?.snapshot && (
                            <div className="border border-gray-100 rounded-xl overflow-hidden">
                                <div className="bg-gray-50 px-5 py-3.5 border-b border-gray-100">
                                    <h2 className="font-bold text-base flex items-center gap-2 text-[#1a1a1a]">
                                        <FiMapPin className="text-[var(--color-primary)]" />
                                        آدرس تحویل
                                    </h2>
                                </div>
                                <div className="px-5 py-4 space-y-2 text-sm">
                                    <div className="flex gap-2">
                                        <span className="text-gray-500 w-24 flex-shrink-0">نام گیرنده:</span>
                                        <span className="font-semibold text-[#1a1a1a]">{order.address.snapshot.fullName}</span>
                                    </div>
                                    {order.address.snapshot.phone && (
                                        <div className="flex gap-2">
                                            <span className="text-gray-500 w-24 flex-shrink-0">تلفن:</span>
                                            <span className="font-medium text-[#1a1a1a] font-mono">{order.address.snapshot.phone}</span>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <span className="text-gray-500 w-24 flex-shrink-0">آدرس:</span>
                                        <span className="text-[#1a1a1a] leading-relaxed">{order.address.snapshot.addressLine}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <Link
                                href="/p-user/orders"
                                className="flex-1 h-12 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center gap-2 font-semibold hover:opacity-90 transition text-sm"
                            >
                                <FiShoppingBag />
                                مشاهده سفارشات
                            </Link>
                            <Link
                                href="/p-user"
                                className="flex-1 h-12 rounded-xl border border-gray-200 flex items-center justify-center gap-2 font-semibold hover:bg-gray-50 transition text-sm text-[#1a1a1a]"
                            >
                                <FiHome />
                                بازگشت به صفحه اصلی
                            </Link>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
