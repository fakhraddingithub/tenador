"use client";

import Link from "next/link";
import {
    FiCheckCircle,
    FiClipboard,
    FiShoppingBag,
    FiHome,
} from "react-icons/fi";
import { fetchOrder } from '@/hooks/usePayment';
import { useEffect, useState } from "react";

export default function PaymentSuccessPage({ trackingCode }) {
    const [order, setOrder] = useState(null);

    useEffect(() => {
        const loadOrder = async () => {
            
            try {
                const res = await fetch(`/api/orders/${trackingCode}`, {
                    method:      'GET',
                    credentials: 'include',
                    headers:     { 'Content-Type': 'application/json' },
                    cache:       'no-store',
                });
                
                const data = await res.json();
console.log(data);
                

                setOrder(data.order);

            } catch (error) {
                console.error('Error fetching order:', error);
            }
        };

        loadOrder();
    }, [trackingCode]); // eslint-disable-line

    return (
        <div className="min-h-screen bg-[var(--color-background)] py-8 px-4">
            <div className="max-w-5xl mx-auto">

                {/* Success Card */}
                <div className="bg-white border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">

                    {/* Header */}
                    <div className="bg-[var(--color-primary)] text-white p-8 text-center">
                        <FiCheckCircle className="mx-auto text-6xl mb-4" />

                        <h1 className="text-2xl md:text-3xl font-bold mb-3">
                            پرداخت شما با موفقیت ثبت شد
                        </h1>

                        <p className="text-white/90 text-sm md:text-base leading-7">
                            از خرید شما سپاسگزاریم.
                            اطلاعات پرداخت شما ثبت شده و پس از بررسی توسط ادمین،
                            نتیجه از طریق پنل کاربری به اطلاع شما خواهد رسید.
                        </p>
                    </div>

                    <div className="p-6 md:p-8 space-y-6">

                        {/* Alert */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-amber-800 text-sm md:text-base">
                                وضعیت سفارش شما در حال حاضر
                                <span className="font-bold mx-1">
                                    «در انتظار تایید پرداخت»
                                </span>
                                می‌باشد.
                            </p>
                        </div>

                        {/* Invoice */}
                        <div className="border border-[var(--border)] rounded-xl overflow-hidden">

                            <div className="bg-gray-50 px-5 py-4 border-b border-[var(--border)]">
                                <h2 className="font-bold text-lg flex items-center gap-2">
                                    <FiClipboard />
                                    خلاصه سفارش
                                </h2>
                            </div>

                            <div className="p-5 space-y-4">

                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">
                                        شماره سفارش
                                    </span>

                                    <span className="font-semibold">
                                        {order?.trackingCode}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">
                                        مبلغ سفارش
                                    </span>

                                    <span className="font-bold text-[var(--color-primary)]">
                                        {Number(order?.totalPrice || 0).toLocaleString()}
                                        {" "}
                                        تومان
                                    </span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">
                                        روش پرداخت
                                    </span>

                                    <span>
                                        فیش بانکی
                                    </span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">
                                        وضعیت
                                    </span>

                                    <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                                        در انتظار تایید
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex flex-col md:flex-row gap-4">

                            <Link
                                href="/p-user/orders"
                                className="
                  flex-1
                  h-12
                  rounded-xl
                  bg-[var(--color-primary)]
                  text-white
                  flex
                  items-center
                  justify-center
                  gap-2
                  font-semibold
                  hover:opacity-90
                  transition
                "
                            >
                                <FiShoppingBag />
                                مشاهده سفارشات
                            </Link>

                            <Link
                                href="/p-user"
                                className="
                  flex-1
                  h-12
                  rounded-xl
                  border
                  border-[var(--border)]
                  flex
                  items-center
                  justify-center
                  gap-2
                  font-semibold
                  hover:bg-gray-50
                  transition
                "
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