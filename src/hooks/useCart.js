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
  getStoredCouponCode,
  storeCouponCode,
  clearStoredCouponCode,
  reconcileCartWithServer,
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

  // کوپن — کد در storage نگه داشته می‌شود تا در کل فرایند خرید فعال بماند
  const [appliedCoupon,  setAppliedCoupon]  = useState(null);  // { code, _id }
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError,    setCouponError]    = useState('');

  // مرجع همگام کد تخفیف — جلوگیری از closure کهنه در loadCart
  const couponCodeRef = useRef(getStoredCouponCode());

  // جمع کل بدون کوپن (از /api/cart/products) — برای حذف فوری کوپن بدون fetch
  const baseTotalRef = useRef(0);

  // برای جلوگیری از race condition در درخواست‌های پشت سرهم
  const abortRef = useRef(null);

  // ─── بارگذاری آیتم‌ها از سرور ───
  const loadCart = useCallback(async () => {
    const localCart = getCart();

    if (localCart.length === 0) {
      setCartItems([]);
      setTotalItems(0);
      setTotalPrice(0);
      setTotalRawPrice(0);
      setTotalDiscount(0);
      setCouponDiscount(0);
      // کد در storage می‌ماند؛ با افزودن دوباره کالا خودکار بازاعتبارسنجی می‌شود
      setAppliedCoupon(null);
      setCouponError('');
      baseTotalRef.current = 0;
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

      // همگام‌سازی: خطوطی که محصولشان دیگر وجود ندارد از localStorage پاک شوند
      // تا بج نوار بالا و محتوای سبد همیشه یکی باشند.
      reconcileCartWithServer(productsData.items || []);

      // اگر کوپن داریم، قیمت نهایی با کوپن را هم بگیر
      let couponDiscountAmount = 0;
      let finalWithCoupon      = null;

      if (couponCodeRef.current) {
        const priceRes = await fetch('/api/cart/price', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ items: localCart, couponCode: couponCodeRef.current }),
          signal:  controller.signal,
        });
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          if (priceData.coupon) {
            couponDiscountAmount = priceData.couponDiscountToman ?? 0;
            finalWithCoupon      = priceData.finalTotalToman ?? null;
            setAppliedCoupon(priceData.coupon);
            setCouponError('');
          } else {
            // کد با ترکیب فعلی سبد دیگر معتبر نیست — حذف و اطلاع به کاربر
            couponCodeRef.current = null;
            clearStoredCouponCode();
            setAppliedCoupon(null);
            setCouponError(priceData.couponError || 'کد تخفیف دیگر معتبر نیست');
          }
        }
      }

      // ساخت آیتم‌های غنی‌شده برای CartItems
      // ⚠️ از فیلدهای خود سرور استفاده می‌کنیم، نه تطبیق بر اساس ایندکس با localCart.
      // سرور آیتم‌های حذف‌شده را drop می‌کند، پس ایندکس‌ها لزوماً هم‌تراز نیستند و
      // تطبیق ایندکسی داده را به خط اشتباه می‌چسباند.
      const enriched = (productsData.items || []).map((item) => {
        return {
          // شناسه‌ها — مستقیم از پاسخ معتبرشده‌ی سرور
          productId: item.productId,
          variantId: item.variantId ?? null,
          usedProductId: item.usedProductId ?? null,
          itemType: item.itemType || 'product',
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
      const baseTotal     = productsData.grandTotalToman ?? 0;
      const itemsCount    = enriched.reduce((s, i) => s + i.quantity, 0);

      baseTotalRef.current = baseTotal;

      setCartItems(enriched);
      setTotalItems(itemsCount);
      setTotalRawPrice(rawTotal);
      setTotalDiscount(ruleDiscount);
      setCouponDiscount(couponDiscountAmount);
      setTotalPrice(Math.max(0, finalWithCoupon ?? (baseTotal - couponDiscountAmount)));

    } catch (e) {
      if (e.name === 'AbortError') return;
      setError('خطا در بارگذاری سبد خرید');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // بارگذاری اولیه
  useEffect(() => {
    loadCart();
    const handleCartChange = () => loadCart();
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
    loadCart();
  }, [loadCart]);

  // ─── حذف آیتم — ورودی: کل آیتم سبد ───
  const removeItem = useCallback((item) => {
    if (!item) return;
    const itemType = item.itemType || 'product';

    if (itemType === 'used_product') {
      removeUsedFromCart(item.usedProductId);
    } else {
      removeFromCart(item.productId, item.variantId ?? null, item.flowSelections ?? null);
    }
    loadCart();
  }, [loadCart]);

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
    loadCart();
  }, [loadCart]);

  // ─── اعمال کوپن ───
  // فقط /api/cart/price صدا زده می‌شود؛ آیتم‌ها و isLoading دست نمی‌خورند تا
  // صفحه وارد حالت بارگذاری نشود. خروجی: true در صورت اعمال موفق.
  const applyCoupon = useCallback(async (rawCode) => {
    const code = rawCode?.trim().toUpperCase();
    if (!code) return false;

    const localCart = getCart();
    if (localCart.length === 0) {
      setCouponError('سبد خرید شما خالی است');
      return false;
    }

    try {
      const res = await fetch('/api/cart/price', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items: localCart, couponCode: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCouponError(data.error || 'خطا در بررسی کد تخفیف');
        return false;
      }

      if (!data.coupon) {
        setCouponError(data.couponError || 'کد تخفیف معتبر نیست');
        return false;
      }

      couponCodeRef.current = code;
      storeCouponCode(code);

      const discount = data.couponDiscountToman ?? 0;
      setAppliedCoupon(data.coupon);
      setCouponDiscount(discount);
      setCouponError('');
      setTotalPrice(Math.max(0, data.finalTotalToman ?? (baseTotalRef.current - discount)));
      return true;
    } catch (e) {
      console.error(e);
      setCouponError('خطا در بررسی کد تخفیف؛ دوباره تلاش کنید');
      return false;
    }
  }, []);

  // ─── حذف کوپن ───
  // فوری و بدون fetch — جمع کل به مبلغ بدون کوپن (baseTotal) برمی‌گردد
  const removeCoupon = useCallback(() => {
    couponCodeRef.current = null;
    clearStoredCouponCode();
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError('');
    setTotalPrice(Math.max(0, baseTotalRef.current));
  }, []);

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
    refetch: () => loadCart(),
  };
};