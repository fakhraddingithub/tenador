import { useState, useEffect, useCallback, useMemo } from 'react';

const CART_STORAGE_KEY = 'cart';

const fetchProduct = async (id) => {
  const res = await fetch(`/api/product/${id}`);
  if (!res.ok) throw new Error('خطا در دریافت محصول');
  return await res.json();
};

export const useCart = () => {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCart = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setIsLoading(true);
    try {
      const rawCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
      const enriched = await Promise.all(
        rawCart.map(async (item) => {
          const product = await fetchProduct(item.productId);
          if (!product) return null;

          // محاسبه تخفیف تکی برای این آیتم
          let discountAmount = 0;
          let hasStepDiscount = false;
          const basePrice = product.price.finalPrice;

          if (product.label === "discount") {
            if (item.quantity === 2) {
              discountAmount = (basePrice * item.quantity) * 0.10;
              hasStepDiscount = true;
            } else if (item.quantity >= 3) {
              discountAmount = (basePrice * item.quantity) * 0.15;
              hasStepDiscount = true;
            }
          }

          return {
            ...item,
            product,
            itemTotalBeforeDiscount: basePrice * item.quantity,
            itemDiscount: discountAmount,
            itemFinalPrice: (basePrice * item.quantity) - discountAmount,
            hasStepDiscount
          };
        })
      );
      setCartItems(enriched.filter(Boolean));
    } catch (e) {
      setError('خطا در بارگذاری');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadCart(); }, [loadCart]);

  const { totalItems, totalPrice, totalRawPrice, totalDiscount } = useMemo(() => {
    return cartItems.reduce((acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      totalPrice: acc.totalPrice + item.itemFinalPrice,
      totalRawPrice: acc.totalRawPrice + item.itemTotalBeforeDiscount,
      totalDiscount: acc.totalDiscount + item.itemDiscount,
    }), { totalItems: 0, totalPrice: 0, totalRawPrice: 0, totalDiscount: 0 });
  }, [cartItems]);

  const updateQuantity = (productId, delta) => {
    setCartItems(prev => {
      const updated = prev.map(item => 
        item.productId === productId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      );
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated.map(i => ({ productId: i.productId, quantity: i.quantity }))));
      loadCart(); // بازخوانی برای محاسبه مجدد تخفیف‌ها
      return updated;
    });
  };

  const removeItem = (productId) => {
    const updated = cartItems.filter(i => i.productId !== productId);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated.map(i => ({ productId: i.productId, quantity: i.quantity }))));
    setCartItems(updated);
  };

  return { cartItems, isLoading, error, updateQuantity, removeItem, totalItems, totalPrice, totalRawPrice, totalDiscount, refetch: loadCart };
};