'use client';

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
} from '@/lib/cart';

export default function CartDrawer({ isOpen, onClose }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pricingData, setPricingData] = useState(null);
    const router = useRouter();

    const loadCartItems = useCallback(async () => {
        setLoading(true);
        try {
            const cartData = getCart();

            if (cartData.length === 0) {
                setItems([]);
                setPricingData(null);
                setLoading(false);
                return;
            }

            // دریافت اطلاعات نمایشی محصولات
            const productsRes = await fetch('/api/cart/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cartData }),
            });

            // دریافت قیمت‌گذاری سرور-ساید
            const priceRes = await fetch('/api/cart/price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cartData }),
            });

            if (productsRes.ok && priceRes.ok) {
                const productsData = await productsRes.json();
                const priceData = await priceRes.json();

                setPricingData(priceData);

                // ترکیب اطلاعات نمایشی با قیمت سرور
                const priceMap = new Map(
                    (priceData.items || []).map((p) => [
                        `${p.productId}-${p.variantId ?? 'null'}`,
                        p,
                    ])
                );

                const enriched = (productsData.items || []).map((displayItem) => {
                    const key = `${displayItem.productId}-${displayItem.variantId ?? 'null'}`;
                    const priceItem = priceMap.get(key);
                    return {
                        ...displayItem,
                        unitPriceToman: priceItem?.unitPriceToman ?? displayItem.displayPriceToman,
                        basePriceToman: priceItem?.basePriceToman ?? displayItem.displayPriceToman,
                        discountToman: priceItem?.discountToman ?? 0,
                        itemFinalPrice: priceItem?.itemFinalToman
                            ?? (displayItem.displayPriceToman * displayItem.quantity),
                    };
                });

                setItems(enriched);
            }
        } catch (error) {
            console.error('خطا در بارگذاری سبد خرید:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        loadCartItems();
    }, [isOpen, loadCartItems]);

    const handleQuantityChange = (item, newQuantity) => {
        if (newQuantity < 1) return;
        updateQuantity(item.productId, item.variantId, newQuantity);
        loadCartItems();
    };

    const handleRemove = (item) => {
        removeFromCart(item.productId, item.variantId);
        setItems(prevItems =>
            prevItems.filter(
                i => !(i.productId === item.productId &&
                    (i.variantId || null) === (item.variantId || null))
            )
        );
    };

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    // قیمت نهایی از سرور
    const totalPrice = pricingData?.grandTotalToman
        ?? items.reduce((sum, item) => sum + item.itemFinalPrice, 0);
    const totalSavings = items.reduce((sum, item) => sum + (item.discountToman ?? 0), 0);

    const handleCheckout = () => {
        router.push('/p-user/signOrder');
        onClose();
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
                {/* Header */}
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

                {/* Items */}
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
                            const hasDiscount = (item.discountToman ?? 0) > 0;
                            const basePriceToman = item.basePriceToman ?? item.displayPriceToman;
                            const unitPriceToman = item.unitPriceToman ?? basePriceToman;
                            const itemTotal = item.itemFinalPrice;

                            return (
                                <div
                                    key={`${item.productId}-${item.variantId || 'no-variant'}`}
                                    className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow"
                                >
                                    <div className="flex gap-4">
                                        {/* Image */}
                                        <img
                                            src={item.variant?.images?.[0] || item.product?.mainImage}
                                            alt={item.product?.name}
                                            className="w-24 h-24 object-cover rounded-lg"
                                        />

                                        {/* Details */}
                                        <div className="flex-1 flex flex-col justify-between">
                                            {/* Product Name */}
                                            <div>
                                                <p className="font-bold text-gray-800 mb-1">
                                                    {item.product?.name}
                                                </p>

                                                {/* Variant Info */}
                                                {item.variant && (
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {Object.entries(item.variant.attributes || {}).map(([key, value]) => (
                                                            <span
                                                                key={key}
                                                                className="text-xs bg-gray-100 px-2 py-1 rounded"
                                                            >
                                                                {value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Discount Badge */}
                                                {hasDiscount && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                                        </svg>
                                                        تخفیف اعمال شد
                                                    </span>
                                                )}
                                            </div>

                                            {/* Price & Quantity Controls */}
                                            <div className="space-y-2">
                                                {/* Price Display */}
                                                <div className="flex items-center gap-2">
                                                    {hasDiscount ? (
                                                        <>
                                                            <span className="text-sm text-gray-400 line-through">
                                                                {basePriceToman.toLocaleString('fa-IR')}
                                                            </span>
                                                            <span className="text-base font-bold text-[#aa4725]">
                                                                {unitPriceToman.toLocaleString('fa-IR')} تومان
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-base font-bold text-gray-800">
                                                            {basePriceToman.toLocaleString('fa-IR')} تومان
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Quantity & Actions */}
                                                <div className="flex items-center justify-between">
                                                    {/* Quantity Controls */}
                                                    <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden">
                                                        <button
                                                            onClick={() => handleQuantityChange(item, item.quantity - 1)}
                                                            disabled={item.quantity <= 1}
                                                            className="px-2 py-1 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            <FaMinus className="text-sm" />
                                                        </button>

                                                        <span className="px-3 py-1 font-bold text-gray-800 min-w-[40px] text-center">
                                                            {item.quantity}
                                                        </span>

                                                        <button
                                                            onClick={() => handleQuantityChange(item, item.quantity + 1)}
                                                            disabled={!item.inStock}
                                                            className="px-2 py-1 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-40"
                                                        >
                                                            <FaPlus className="text-sm" />
                                                        </button>
                                                    </div>

                                                    {/* Item Total & Delete */}
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

                {/* Footer */}
                {items.length > 0 && (
                    <div className="border-t-2 border-gray-200 p-4 space-y-3 bg-gray-50">
                        {/* Savings Badge */}
                        {totalSavings > 0 && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-semibold text-green-700">
                                            صرفه‌جویی شما
                                        </span>
                                    </div>
                                    <span className="text-base font-bold text-green-700">
                                        {totalSavings.toLocaleString('fa-IR')} تومان
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
                                {totalPrice.toLocaleString('fa-IR')} تومان
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
