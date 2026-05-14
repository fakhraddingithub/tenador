const CART_KEY = "cart";

function getCart() {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCart(cart) {
  if (typeof window === "undefined") return;

  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/**
 * محاسبه تخفیف بر اساس تعداد
 */
export function calculateDiscount(quantity) {
  if (quantity >= 3) return 15;
  if (quantity >= 2) return 10;
  return 0;
}

/**
 * محاسبه قیمت نهایی با تخفیف
 */
export function calculateFinalPrice(basePrice, quantity, hasDiscountLabel) {
  if (!hasDiscountLabel) return basePrice;
  
  const discountPercent = calculateDiscount(quantity);
  return Math.round(basePrice * (1 - discountPercent / 100));
}

/**
 * ساختار سبد خرید:
 * [
 *   {
 *     productId: string,
 *     variantId: string | null,
 *     quantity: number,
 *     finalUnitPrice: number
 *   }
 * ]
 */

export function addToCart(product, quantity = 1, variant = null, finalUnitPrice = null) {
  const cart = getCart();

  const productId = String(product._id);
  const variantId = variant?._id ? String(variant._id) : null;
  
  // اگر قیمت نهایی پاس نشده، از قیمت پایه استفاده می‌کنیم
  const price = finalUnitPrice !== null 
    ? finalUnitPrice 
    : (variant?.price ?? product.basePrice);

  const existingItem = cart.find(
    (item) =>
      item.productId === productId &&
      (item.variantId || null) === variantId
  );

  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.finalUnitPrice = price;
  } else {
    cart.push({
      productId,
      variantId,
      quantity,
      finalUnitPrice: price,
    });
  }

  saveCart(cart);
}

export function removeFromCart(productId, variantId = null) {
  const normalizedProductId = String(productId);
  const normalizedVariantId = variantId ? String(variantId) : null;

  const updatedCart = getCart().filter(
    (item) =>
      !(
        item.productId === normalizedProductId &&
        (item.variantId || null) === normalizedVariantId
      )
  );

  saveCart(updatedCart);
}

export function updateQuantity(productId, variantId = null, quantity, finalUnitPrice) {
  const normalizedProductId = String(productId);
  const normalizedVariantId = variantId ? String(variantId) : null;

  const cart = getCart();

  const item = cart.find(
    (i) =>
      i.productId === normalizedProductId &&
      (i.variantId || null) === normalizedVariantId
  );

  if (!item) return;

  if (quantity <= 0) {
    removeFromCart(normalizedProductId, normalizedVariantId);
    return;
  }

  item.quantity = quantity;
  
  // همیشه قیمت رو به‌روز می‌کنیم
  if (finalUnitPrice !== undefined && finalUnitPrice !== null) {
    item.finalUnitPrice = finalUnitPrice;
  }

  saveCart(cart);
}

export function clearCart() {
  saveCart([]);
}

export function isInCart(productId, variantId = null) {
  const normalizedProductId = String(productId);
  const normalizedVariantId = variantId ? String(variantId) : null;

  const cart = getCart();

  return cart.some(
    (item) =>
      item.productId === normalizedProductId &&
      (item.variantId || null) === normalizedVariantId
  );
}

export function getCartItem(productId, variantId = null) {
  const normalizedProductId = String(productId);
  const normalizedVariantId = variantId ? String(variantId) : null;

  const cart = getCart();

  return (
    cart.find(
      (item) =>
        item.productId === normalizedProductId &&
        (item.variantId || null) === normalizedVariantId
    ) || null
  );
}

export function getCartCount() {
  const cart = getCart();

  return cart.reduce((total, item) => total + item.quantity, 0);
}

export { getCart };