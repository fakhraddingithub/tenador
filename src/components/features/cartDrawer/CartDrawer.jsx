'use client';

/**
 * src/components/features/cartDrawer/CartDrawer.jsx
 *
 * سبد خرید کشویی — قیمت‌ها کاملاً از سرور دریافت می‌شوند
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    FaTimes,
    FaPlus,
    FaMinus,
    FaTrash,
    FaShoppingCart,
    FaSpinner,
} from 'react-icons/fa';
import {
    getCart,
    updateQuantity,
    removeFromCart,
    removeUsedFromCart,
    flowSignature,
    reconcileCartWithServer,
} from '@/lib/cart';
import FlowSelectionsList from '@/components/modules/orderFlow/FlowSelectionsList';
import { useUser } from '@/components/features/auth/UserContext';
import StockReminderToast from '@/components/order/StockReminderToast';
import VariantSummary from '@/components/order/VariantSummary';

export default function CartDrawer({ isOpen, onClose }) {
    const { user } = useUser();
    const [items, setItems] = useState([]);
    const [totals, setTotals] = useState({ grand: 0, savings: 0 });
    const [loading, setLoading] = useState(false);
    const [updatingId, setUpdatingId] = useState(null); // آیتمی که در حال آپدیت است
    const router = useRouter();

    // ─── بارگذاری آیتم‌ها از سرور ───
    const loadCartItems = useCallback(async () => {
        setLoading(true);
        try {
            const cartData = getCart(); // فقط [{ productId, variantId, quantity }]

            if (cartData.length === 0) {
                setItems([]);
                setTotals({ grand: 0, savings: 0 });
                return;
            }

            // یک fetch واحد — همه داده‌های نمایشی + قیمت
            const res = await fetch('/api/cart/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cartData }),
            });

            if (!res.ok) throw new Error('خطا در دریافت سبد خرید');

            const data = await res.json();
            const serverItems = data.items || [];

            // همگام‌سازی: خطوطی که محصولشان حذف شده از localStorage هم پاک شوند
            // تا بج و محتوای سبد همیشه یکی باشند.
            reconcileCartWithServer(serverItems);

            setItems(serverItems);
            setTotals({
                grand: data.grandTotalToman ?? 0,
                savings: data.grandDiscountToman ?? 0,
            });
        } catch (error) {
            console.error('خطا در بارگذاری سبد خرید:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) loadCartItems();
    }, [isOpen, loadCartItems]);

    // ─── تغییر تعداد ───
    const handleQuantityChange = async (item, newQty) => {
        if (newQty < 1) return;
        // تعداد کالای دست‌دوم همیشه ۱ است
        if ((item.itemType || 'product') === 'used_product') return;
        const sig = flowSignature(item.flowSelections);
        const key = `${item.productId}-${item.variantId ?? 'null'}-${sig}`;
        setUpdatingId(key);

        // آپدیت فوری localStorage
        updateQuantity(item.productId, item.variantId, newQty, item.flowSelections);

        // آپدیت state محلی (optimistic)
        setItems((prev) =>
            prev.map((i) =>
                i.productId === item.productId &&
                    (i.variantId ?? null) === (item.variantId ?? null) &&
                    flowSignature(i.flowSelections) === sig
                    ? {
                        ...i,
                        quantity: newQty,
                        itemFinalToman: i.unitPriceToman * newQty,
                    }
                    : i
            )
        );

        // دریافت قیمت دقیق از سرور
        try {
            const cartData = getCart();
            const res = await fetch('/api/cart/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cartData }),
            });
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);
                setTotals({
                    grand: data.grandTotalToman ?? 0,
                    savings: data.grandDiscountToman ?? 0,
                });
            }
        } finally {
            setUpdatingId(null);
        }
    };

    // ─── حذف آیتم ───
    const handleRemove = (item) => {
        const isUsed = (item.itemType || 'product') === 'used_product';
        const sig = flowSignature(item.flowSelections);

        // کالای دست‌دوم با removeFromCart حذف نمی‌شود (آن تابع خطوط used را رد می‌کند)
        if (isUsed) {
            removeUsedFromCart(item.usedProductId);
        } else {
            removeFromCart(item.productId, item.variantId, item.flowSelections);
        }

        const remaining = items.filter((i) =>
            isUsed
                ? !((i.itemType || 'product') === 'used_product' &&
                    i.usedProductId === item.usedProductId)
                : !((i.itemType || 'product') !== 'used_product' &&
                    i.productId === item.productId &&
                    (i.variantId ?? null) === (item.variantId ?? null) &&
                    flowSignature(i.flowSelections) === sig)
        );
        setItems(remaining);

        // محاسبه مجدد totals از آیتم‌های باقیمانده
        const newGrand = remaining.reduce((s, i) => s + (i.itemFinalToman ?? 0), 0);
        const newSavings = remaining.reduce((s, i) => s + (i.discountToman ?? 0) * i.quantity, 0);
        setTotals({ grand: newGrand, savings: newSavings });
    };

    // ─── محاسبه تعداد کل ───
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

    // ۲. handleCheckout را اینطور تغییر بده
    const handleCheckout = () => {
        onClose();
        if (!user) {
            router.push('/login-register?callbackUrl=/p-user/signOrder');
            return;
        }
        router.push('/p-user/signOrder');
    };  

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                onClick={onClose}
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-fadeIn"
            />

            {/* Drawer */}
            <aside className="fixed left-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-slideInLeft">

                {/* ─── Header ─── */}
                <div className="flex items-center justify-between p-4 border-b-2 border-gray-200 bg-gradient-to-r from-[#aa4725]/5 to-transparent">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <FaTimes className="text-xl text-[#aa4725]" />
                    </button>
                    <div className="flex items-center gap-2 font-bold text-[#aa4725] text-lg">
                        <FaShoppingCart />
                        سبد خرید
                        {totalItems > 0 && (
                            <span className="bg-[#aa4725] text-white text-xs px-2 py-1 rounded-full">
                                {totalItems}
                            </span>
                        )}
                    </div>
                </div>

                {/* ─── Items ─── */}
                <div className="flex-1 relative min-h-0 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <FaSpinner className="animate-spin text-4xl text-[#aa4725]" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <FaShoppingCart className="text-6xl mb-4 opacity-20" />
                            <p className="text-lg">سبد خرید خالی است</p>
                        </div>
                    ) : (
                        items.map((item) => {
                            const sig = flowSignature(item.flowSelections);
                            const key = (item.itemType || 'product') === 'used_product'
                                ? `used-${item.usedProductId}`
                                : `${item.productId}-${item.variantId ?? 'no-variant'}-${sig}`;
                            const isUpdating = updatingId === `${item.productId}-${item.variantId ?? 'null'}-${sig}`;
                            const baseToman = item.basePriceToman ?? 0;
                            const unitToman = item.unitPriceToman ?? baseToman;
                            const itemTotal = item.itemFinalToman ?? unitToman * item.quantity;
                            const hasDiscount = (item.discountToman ?? 0) > 0;
                            const productImage = item.variant?.images?.[0] || item.product?.mainImage;

                            return (
                                <div
                                    key={key}
                                    className={`bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow ${isUpdating ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex gap-4">
                                        {/* تصویر */}
                                        {productImage && (
                                            <img
                                                src={productImage}
                                                alt={item.product?.name}
                                                className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                                            />
                                        )}

                                        <div className="flex-1 flex flex-col justify-between min-w-0">
                                            {/* نام محصول */}
                                            <div>
                                                <p className="font-bold text-gray-800 mb-1 truncate">
                                                    {item.product?.name}
                                                </p>

                                                {/* ویژگی‌های واریانت */}
                                                {item.variant && Object.keys(item.variant.attributes || {}).length > 0 && (
                                                    <div className="mb-2">
                                                        <VariantSummary
                                                            attributes={item.variant.attributes}
                                                            attributeImages={item.variant.attributeImages}
                                                            attributeUnits={item.variant.attributeUnits}
                                                        />
                                                    </div>
                                                )}

                                                {/* بج تخفیف */}
                                                {hasDiscount && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                                        </svg>
                                                        تخفیف اعمال شد
                                                    </span>
                                                )}

                                                {/* انتخاب‌های فرایند سفارش */}
                                                {item.flowSelections?.length > 0 && (
                                                    <FlowSelectionsList flowSelections={item.flowSelections} compact />
                                                )}
                                            </div>

                                            {/* قیمت و کنترل تعداد */}
                                            <div className="space-y-2 mt-2">
                                                {/* قیمت واحد */}
                                                <div className="flex items-center gap-2">
                                                    {hasDiscount ? (
                                                        <>
                                                            <span className="text-sm text-gray-400 line-through">
                                                                {baseToman.toLocaleString('fa-IR')}
                                                            </span>
                                                            <span className="text-base font-bold text-[#aa4725]">
                                                                {unitToman.toLocaleString('fa-IR')} تومان
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-base font-bold text-gray-800">
                                                            {baseToman.toLocaleString('fa-IR')} تومان
                                                        </span>
                                                    )}
                                                </div>

                                                {/* کنترل تعداد + جمع + حذف */}
                                                <div className="flex items-center justify-between">
                                                    {/* کنترل تعداد */}
                                                    <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden">
                                                        <button
                                                            onClick={() => handleQuantityChange(item, item.quantity - 1)}
                                                            disabled={item.quantity <= 1 || isUpdating}
                                                            className="px-2 py-1 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            <FaMinus className="text-sm" />
                                                        </button>

                                                        <span className="px-3 py-1 font-bold text-gray-800 min-w-[40px] text-center">
                                                            {isUpdating ? (
                                                                <FaSpinner className="animate-spin text-xs mx-auto" />
                                                            ) : (
                                                                item.quantity
                                                            )}
                                                        </span>

                                                        <button
                                                            onClick={() => handleQuantityChange(item, item.quantity + 1)}
                                                            disabled={!item.inStock || isUpdating || (item.itemType || 'product') === 'used_product'}
                                                            className="px-2 py-1 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            <FaPlus className="text-sm" />
                                                        </button>
                                                    </div>

                                                    {/* جمع آیتم + حذف */}
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-left">
                                                            <div className="text-xs text-gray-500">جمع</div>
                                                            <div className="font-bold text-[#aa4725]">
                                                                {itemTotal.toLocaleString('fa-IR')} تومان
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleRemove(item)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ─── اعلان موجودی — toast مشترک، از پایین سایدبار بالا می‌آید ─── */}
                <StockReminderToast active={items.length > 0} floating />
                </div>

                {/* ─── Footer ─── */}
                {items.length > 0 && (
                    <div className="border-t-2 border-gray-200 p-4 space-y-3 bg-gray-50">
                        {/* صرفه‌جویی */}
                        {totals.savings > 0 && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-semibold text-green-700">صرفه‌جویی شما</span>
                                    </div>
                                    <span className="text-base font-bold text-green-700">
                                        {totals.savings.toLocaleString('fa-IR')} تومان
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between text-sm text-gray-600">
                            <span>تعداد آیتم‌ها</span>
                            <span className="font-semibold">{totalItems} عدد</span>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                            <span className="text-base font-bold text-gray-800">مجموع</span>
                            <span className="text-2xl font-bold text-[#aa4725]">
                                {totals.grand.toLocaleString('fa-IR')} تومان
                            </span>
                        </div>

                        <button
                            onClick={handleCheckout}
                            className="w-full bg-[#aa4725] text-white py-3 rounded-lg font-bold text-lg hover:bg-[#8a3719] transition-colors shadow-lg hover:shadow-xl"
                        >
                            تکمیل خرید
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
}
