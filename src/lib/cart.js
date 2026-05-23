/**
 * src/lib/cart.js
 *
 * مدیریت سبد خرید در localStorage.
 *
 * تغییرات مهم نسبت به نسخه قبلی:
 *  ❌ calculateDiscount و calculateFinalPrice حذف شدند
 *     (قیمت‌گذاری فقط باید روی سرور از /api/cart/price انجام شود)
 *  ✅ سبد فقط ساختار { productId, variantId, quantity } را ذخیره می‌کند
 *  ✅ finalUnitPrice دیگر از localStorage خوانده نمی‌شود — همیشه از API
 */

const CART_KEY = "cart";

/** @returns {Array<{ productId: string, variantId: string|null, quantity: number }>} */
export function getCart() {
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
 * افزودن به سبد خرید
 * قیمت ذخیره نمی‌شود — همیشه از سرور دریافت می‌شود
 */
export function addToCart(productId, quantity = 1, variantId = null) {
  const cart = getCart();
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;

  const existing = cart.find(
    (i) => i.productId === pid && (i.variantId || null) === vid
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId: pid, variantId: vid, quantity });
  }

  saveCart(cart);
}

export function removeFromCart(productId, variantId = null) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;
  saveCart(
    getCart().filter(
      (i) => !(i.productId === pid && (i.variantId || null) === vid)
    )
  );
}

export function updateQuantity(productId, variantId = null, quantity) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;

  if (quantity <= 0) {
    removeFromCart(pid, vid);
    return;
  }

  const cart = getCart();
  const item = cart.find(
    (i) => i.productId === pid && (i.variantId || null) === vid
  );
  if (item) {
    item.quantity = quantity;
    saveCart(cart);
  }
}

export function clearCart() {
  saveCart([]);
}

export function isInCart(productId, variantId = null) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;
  return getCart().some(
    (i) => i.productId === pid && (i.variantId || null) === vid
  );
}

export function getCartItem(productId, variantId = null) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;
  return (
    getCart().find(
      (i) => i.productId === pid && (i.variantId || null) === vid
    ) || null
  );
}

export function getCartCount() {
  return getCart().reduce((total, item) => total + item.quantity, 0);
}
