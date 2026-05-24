/**
 * src/lib/cart.js
 *
 * مدیریت سبد خرید سمت کلاینت (localStorage)
 *
 * ⚠️  مهم: قیمت‌ها در localStorage ذخیره نمی‌شوند.
 *     localStorage فقط شناسه‌ها و تعداد را نگه می‌دارد.
 *     قیمت‌ها همیشه از سرور دریافت می‌شوند.
 *
 * ساختار هر آیتم:
 *  { productId: string, variantId: string|null, quantity: number }
 */

const CART_KEY = "cart";

// ─── خواندن سبد ───

export function getCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // اطمینان از ساختار صحیح
    return parsed
      .filter((item) => item?.productId && item?.quantity > 0)
      .map((item) => ({
        productId: String(item.productId),
        variantId: item.variantId ? String(item.variantId) : null,
        quantity:  Math.max(1, Math.floor(item.quantity || 1)),
      }));
  } catch {
    return [];
  }
}

// ─── ذخیره سبد ───

function saveCart(cart) {
  if (typeof window === "undefined") return;
  // ذخیره فقط داده‌های ضروری (بدون قیمت)
  const clean = cart.map(({ productId, variantId, quantity }) => ({
    productId,
    variantId: variantId ?? null,
    quantity:  Math.max(1, Math.floor(quantity)),
  }));
  localStorage.setItem(CART_KEY, JSON.stringify(clean));
}

// ─── افزودن به سبد ───

export function addToCart(productId, quantity = 1, variantId = null) {
  const cart = getCart();
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;

  const existing = cart.find(
    (i) => i.productId === pid && (i.variantId ?? null) === vid
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId: pid, variantId: vid, quantity });
  }

  saveCart(cart);
  dispatchCartChange();
}

// ─── حذف از سبد ───

export function removeFromCart(productId, variantId = null) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;

  const updated = getCart().filter(
    (i) => !(i.productId === pid && (i.variantId ?? null) === vid)
  );

  saveCart(updated);
  dispatchCartChange();
}

// ─── آپدیت تعداد ───

export function updateQuantity(productId, variantId = null, quantity) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;

  if (quantity <= 0) {
    removeFromCart(pid, vid);
    return;
  }

  const cart = getCart();
  const item = cart.find(
    (i) => i.productId === pid && (i.variantId ?? null) === vid
  );

  if (item) {
    item.quantity = Math.max(1, Math.floor(quantity));
    saveCart(cart);
    dispatchCartChange();
  }
}

// ─── خالی کردن سبد ───

export function clearCart() {
  saveCart([]);
  dispatchCartChange();
}

// ─── بررسی وجود در سبد ───

export function isInCart(productId, variantId = null) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;
  return getCart().some(
    (i) => i.productId === pid && (i.variantId ?? null) === vid
  );
}

// ─── تعداد کل آیتم‌ها ───

export function getCartCount() {
  return getCart().reduce((total, item) => total + item.quantity, 0);
}

// ─── dispatch event برای sync بین کامپوننت‌ها ───

function dispatchCartChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cartchange"));
  }
}
