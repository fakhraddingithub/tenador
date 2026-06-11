/**
 * src/hooks/useCart.js
 *
 * قیمت‌ها کاملاً از سرور دریافت می‌شوند — هیچ محاسبه‌ای سمت کلاینت نیست
 * اصلاح‌شده: پشتیبانی کامل از فیلدهای محصولات دست‌دوم (usedProductId و itemType)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCart,
  updateQuantity as updateLocalQuantity,
  removeFromCart,
  removeUsedFromCart,
  removeFlowSelectionFromCart,
  flowSignature,
} from '@/lib/cart';

export const useCart = () => {
  const [cartItems,    setCartItems]    = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState(null);

  // قیمت‌های کل از سرور
  const [totalItems,    setTotalItems]    = useState(0);
  const [totalPrice,    setTotalPrice]    = useState(0); // قیمت نهایی بعد از همه تخفیف‌ها
  const [totalRawPrice, setTotalRawPrice] = useState(0); // قیمت بدون هیچ تخفیفی
  const [totalDiscount, setTotalDiscount] = useState(0); // تخفیف rule/flash

  // کوپن
  const [appliedCoupon,  setAppliedCoupon]  = useState(null);  // { code, _id }
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError,    setCouponError]    = useState('');

  // برای جلوگیری از race condition در درخواست‌های پشت سرهم
  const abortRef = useRef(null);

  // ─── بارگذاری آیتم‌ها از سرور ───
  const loadCart = useCallback(async (couponCode = null) => {
    const localCart = getCart();

    if (localCart.length === 0) {
      setCartItems([]);
      setTotalItems(0);
      setTotalPrice(0);
      setTotalRawPrice(0);
      setTotalDiscount(0);
      setCouponDiscount(0);
      setIsLoading(false);
      return;
    }

    // لغو درخواست قبلی
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      // داده نمایشی + قیمت‌های پایه (بدون کوپن)
      const productsRes = await fetch('/api/cart/products', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items: localCart }),
        signal:  controller.signal,
      });

      if (!productsRes.ok) throw new Error('خطا در دریافت اطلاعات سبد');
      const productsData = await productsRes.json();

      // اگر کوپن داریم، قیمت نهایی با کوپن را هم بگیر
      let couponDiscountAmount = 0;
      let validatedCoupon      = null;
      let couponErr            = '';

      if (couponCode || appliedCoupon?.code) {
        const code = couponCode ?? appliedCoupon.code;
        const priceRes = await fetch('/api/cart/price', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ items: localCart, couponCode: code }),
          signal:  controller.signal,
        });
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          couponDiscountAmount = priceData.couponDiscountToman ?? 0;
          validatedCoupon      = priceData.coupon ?? null;
          couponErr            = priceData.couponError ?? '';
        }
      }

      // ساخت آیتم‌های غنی‌شده برای CartItems
      const enriched = (productsData.items || []).map((item, index) => {
        // 🛡️ برای امنیت بیشتر، آیتم متناظر را بر اساس ایندکس از LocalCart پیدا میکنیم تا فیلدها حتماً حفظ شوند
        const localItem = localCart[index] || {};
        const isSameProduct = localItem.productId === item.productId;

        return {
          // شناسه‌ها (اصلاح شد ⚠️)
          productId: item.productId,
          variantId: item.variantId ?? null,
          usedProductId: item.usedProductId || (isSameProduct ? localItem.usedProductId : null) || null,
          itemType: item.itemType || (isSameProduct ? localItem.itemType : 'product') || 'product',
          quantity:  item.quantity,

          // داده نمایشی (سازگار با CartItems)
          product: {
            product: {
              name:             item.product?.name,
              mainImage:        item.product?.mainImage,
              shortDescription: item.product?.shortDescription ?? '',
            },
            price: {
              finalPrice: item.unitPriceToman,
            },
          },

          // واریانت (برای نمایش ویژگی‌ها در صفحه پرداخت)
          variant: item.variant ?? null,

          // موجودی (فقط برای کالای دست‌دوم معنا دارد)
          inStock: item.inStock,

          // قیمت‌گذاری (همه به تومان)
          basePriceToman:          item.basePriceToman,
          unitPriceToman:          item.unitPriceToman,
          discountToman:           item.discountToman,
          itemTotalBeforeDiscount: item.basePriceToman * item.quantity,
          itemDiscount:            item.discountToman  * item.quantity,
          itemFinalPrice:          item.itemFinalToman,
          hasStepDiscount:         item.appliedRules?.length > 0,
          appliedRules:            item.appliedRules ?? [],

          // فرایند سفارش
          flowSelections:          item.flowSelections ?? [],
          flowAddonToman:          item.flowAddonToman ?? 0,
        };
      });

      const rawTotal      = enriched.reduce((s, i) => s + i.itemTotalBeforeDiscount, 0);
      const ruleDiscount  = enriched.reduce((s, i) => s + i.itemDiscount, 0);
      const grandTotal    = (productsData.grandTotalToman ?? 0) - couponDiscountAmount;
      const itemsCount    = enriched.reduce((s, i) => s + i.quantity, 0);

      setCartItems(enriched);
      setTotalItems(itemsCount);
      setTotalRawPrice(rawTotal);
      setTotalDiscount(ruleDiscount);
      setCouponDiscount(couponDiscountAmount);
      setTotalPrice(Math.max(0, grandTotal));

      if (couponCode !== null) {
        setAppliedCoupon(validatedCoupon);
        setCouponError(couponErr);
      } else if (appliedCoupon?.code) {
        setAppliedCoupon(validatedCoupon ?? appliedCoupon);
        setCouponError(couponErr);
      }

    } catch (e) {
      if (e.name === 'AbortError') return;
      setError('خطا در بارگذاری سبد خرید');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [appliedCoupon]);

  // بارگذاری اولیه
  useEffect(() => {
    loadCart();
    const handleCartChange = () => loadCart(appliedCoupon?.code ?? null);
    window.addEventListener('cartchange', handleCartChange);
    return () => window.removeEventListener('cartchange', handleCartChange);
  }, []); // eslint-disable-line

  // ─── تغییر تعداد — ورودی: کل آیتم سبد (پشتیبانی از فرایند سفارش و دست‌دوم) ───
  const updateQuantity = useCallback((item, delta) => {
    if (!item) return;
    const itemType = item.itemType || 'product';
    if (itemType === 'used_product') return; // تعداد دست‌دوم همیشه ۱ است

    const productId = item.productId;
    const variantId = item.variantId ?? null;
    const flowSelections = item.flowSelections ?? null;
    const sig = flowSignature(flowSelections);

    const current = getCart().find(
      (i) =>
        i.itemType !== 'used_product' &&
        i.productId === productId &&
        (i.variantId ?? null) === variantId &&
        flowSignature(i.flowSelections) === sig
    );
    if (!current) return;

    const newQty = Math.max(1, current.quantity + delta);
    updateLocalQuantity(productId, variantId, newQty, flowSelections);
    loadCart(appliedCoupon?.code ?? null);
  }, [appliedCoupon, loadCart]);

  // ─── حذف آیتم — ورودی: کل آیتم سبد ───
  const removeItem = useCallback((item) => {
    if (!item) return;
    const itemType = item.itemType || 'product';

    if (itemType === 'used_product') {
      removeUsedFromCart(item.usedProductId);
    } else {
      removeFromCart(item.productId, item.variantId ?? null, item.flowSelections ?? null);
    }
    loadCart(appliedCoupon?.code ?? null);
  }, [appliedCoupon, loadCart]);

  // ─── حذف یک انتخابِ فرایند از یک آیتم ───
  const removeFlowSelection = useCallback((item, sel) => {
    if (!item || !sel) return;
    if ((item.itemType || 'product') === 'used_product') return;
    removeFlowSelectionFromCart(
      item.productId,
      item.variantId ?? null,
      item.flowSelections ?? null,
      sel.nodeId
    );
    loadCart(appliedCoupon?.code ?? null);
  }, [appliedCoupon, loadCart]);

  // ─── اعمال کوپن ───
  const applyCoupon = useCallback(async (code) => {
    if (!code?.trim()) return;
    await loadCart(code.trim().toUpperCase());
  }, [loadCart]);

  // ─── حذف کوپن ───
  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError('');
    setTotalPrice((prev) => prev + couponDiscount);
    loadCart(null);
  }, [couponDiscount, loadCart]);

  return {
    cartItems,
    isLoading,
    error,
    updateQuantity,
    removeItem,
    removeFlowSelection,
    applyCoupon,
    removeCoupon,
    appliedCoupon,
    couponDiscount,
    couponError,
    totalItems,
    totalPrice,
    totalRawPrice,
    totalDiscount,
    refetch: () => loadCart(appliedCoupon?.code ?? null),
  };
};