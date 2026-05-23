import { useState, useEffect, useCallback, useMemo } from 'react';
import { getCart, updateQuantity as updateLocalQuantity, removeFromCart } from '@/lib/cart';

const CART_STORAGE_KEY = 'cart';

export const useCart = () => {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pricingData, setPricingData] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  /**
   * مرحله ۱: اطلاعات نمایشی محصولات از /api/cart/products
   * مرحله ۲: قیمت‌گذاری دقیق از /api/cart/price
   */
  const loadCart = useCallback(async (couponCode = null) => {
    if (typeof window === 'undefined') return;
    setIsLoading(true);
    setError(null);

    try {
      const rawCart = getCart(); // [{ productId, variantId, quantity }]

      if (rawCart.length === 0) {
        setCartItems([]);
        setPricingData(null);
        setIsLoading(false);
        return;
      }

      // دریافت اطلاعات نمایشی محصولات
      const productsRes = await fetch('/api/cart/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: rawCart }),
      });

      if (!productsRes.ok) throw new Error('خطا در دریافت اطلاعات محصولات');
      const productsData = await productsRes.json();

      // دریافت قیمت‌گذاری سرور-ساید
      const priceRes = await fetch('/api/cart/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rawCart,
          couponCode: couponCode || undefined,
        }),
      });

      if (!priceRes.ok) throw new Error('خطا در محاسبه قیمت');
      const priceData = await priceRes.json();

      setCouponError(priceData.couponError || null);

      // ترکیب اطلاعات نمایشی با قیمت سرور-ساید
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
          // قیمت‌های واقعی از سرور
          unitPriceToman: priceItem?.unitPriceToman ?? displayItem.displayPriceToman,
          basePriceToman: priceItem?.basePriceToman ?? displayItem.displayPriceToman,
          discountToman: priceItem?.discountToman ?? 0,
          itemFinalPrice: priceItem?.itemFinalToman ?? (displayItem.displayPriceToman * displayItem.quantity),
          itemTotalBeforeDiscount: priceItem?.basePriceToman
            ? priceItem.basePriceToman * displayItem.quantity
            : displayItem.displayPriceToman * displayItem.quantity,
          itemDiscount: priceItem?.discountToman ?? 0,
          hasStepDiscount: (priceItem?.discountToman ?? 0) > 0,
        };
      });

      setCartItems(enriched);
      setPricingData(priceData);
    } catch (e) {
      setError('خطا در بارگذاری سبد خرید');
      console.error('[useCart]', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const { totalItems, totalPrice, totalRawPrice, totalDiscount } = useMemo(() => {
    if (pricingData) {
      const rawPrice = cartItems.reduce((acc, item) => acc + item.itemTotalBeforeDiscount, 0);
      const discount = cartItems.reduce((acc, item) => acc + item.itemDiscount, 0);
      return {
        totalItems: cartItems.reduce((acc, item) => acc + item.quantity, 0),
        totalPrice: pricingData.grandTotalToman ?? 0,
        totalRawPrice: rawPrice,
        totalDiscount: discount,
      };
    }
    return { totalItems: 0, totalPrice: 0, totalRawPrice: 0, totalDiscount: 0 };
  }, [cartItems, pricingData]);

  const updateQuantity = useCallback((productId, delta, variantId = null) => {
    const rawCart = getCart();
    const item = rawCart.find(
      (i) => i.productId === productId && (i.variantId || null) === (variantId || null)
    );
    if (!item) return;
    const newQty = Math.max(1, item.quantity + delta);
    updateLocalQuantity(productId, variantId, newQty);
    loadCart(appliedCoupon);
  }, [loadCart, appliedCoupon]);

  const removeItem = useCallback((productId, variantId = null) => {
    removeFromCart(productId, variantId);
    loadCart(appliedCoupon);
  }, [loadCart, appliedCoupon]);

  const applyCoupon = useCallback((couponCode) => {
    setAppliedCoupon(couponCode || null);
    loadCart(couponCode);
  }, [loadCart]);

  return {
    cartItems,
    isLoading,
    error,
    updateQuantity,
    removeItem,
    applyCoupon,
    appliedCoupon,
    couponError,
    totalItems,
    totalPrice,
    totalRawPrice,
    totalDiscount,
    refetch: () => loadCart(appliedCoupon),
  };
};
