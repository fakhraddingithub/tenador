/**
 * src/lib/cart.js
 *
 * مدیریت سبد خرید سمت کلاینت (localStorage)
 *
 * ساختار آیتم‌های سبد:
 *  محصول معمولی:  { productId, variantId, quantity, itemType: "product" }
 *  محصول دست‌دوم: { usedProductId, quantity: 1, itemType: "used_product" }
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

    return parsed
      .filter((item) => {
        if (item?.itemType === "used_product") return item?.usedProductId;
        return item?.productId && item?.quantity > 0;
      })
      .map((item) => {
        if (item.itemType === "used_product") {
          return {
            usedProductId: String(item.usedProductId),
            quantity: 1, // همیشه ۱
            itemType: "used_product",
          };
        }
        return {
          productId: String(item.productId),
          variantId: item.variantId ? String(item.variantId) : null,
          quantity:  Math.max(1, Math.floor(item.quantity || 1)),
          itemType:  "product",
        };
      });
  } catch {
    return [];
  }
}

// ─── ذخیره سبد ───

function saveCart(cart) {
  if (typeof window === "undefined") return;
  const clean = cart.map((item) => {
    if (item.itemType === "used_product") {
      return { usedProductId: item.usedProductId, quantity: 1, itemType: "used_product" };
    }
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity:  Math.max(1, Math.floor(item.quantity)),
      itemType:  "product",
    };
  });
  localStorage.setItem(CART_KEY, JSON.stringify(clean));
  dispatchCartChange();
}

// ─── افزودن محصول معمولی ───

export function addToCart(productId, quantity = 1, variantId = null) {
  const cart = getCart();
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;

  const existing = cart.find(
    (i) => i.itemType !== "used_product" && i.productId === pid && (i.variantId ?? null) === vid
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId: pid, variantId: vid, quantity, itemType: "product" });
  }

  saveCart(cart);
}

// ─── افزودن محصول دست‌دوم ───

export function addUsedToCart(usedProductId) {
  const cart = getCart();
  const uid = String(usedProductId);

  const alreadyIn = cart.some(
    (i) => i.itemType === "used_product" && i.usedProductId === uid
  );

  if (!alreadyIn) {
    cart.push({ usedProductId: uid, quantity: 1, itemType: "used_product" });
    saveCart(cart);
  }
}

// ─── حذف از سبد ───

export function removeFromCart(productId, variantId = null) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;

  const updated = getCart().filter(
    (i) => !(i.itemType !== "used_product" && i.productId === pid && (i.variantId ?? null) === vid)
  );
  saveCart(updated);
}

export function removeUsedFromCart(usedProductId) {
  const uid = String(usedProductId);
  const updated = getCart().filter(
    (i) => !(i.itemType === "used_product" && i.usedProductId === uid)
  );
  saveCart(updated);
}

// ─── آپدیت تعداد محصول معمولی ───

export function updateQuantity(productId, variantId = null, quantity) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;

  if (quantity <= 0) {
    removeFromCart(pid, vid);
    return;
  }

  const cart = getCart();
  const item = cart.find(
    (i) => i.itemType !== "used_product" && i.productId === pid && (i.variantId ?? null) === vid
  );

  if (item) {
    item.quantity = Math.max(1, Math.floor(quantity));
    saveCart(cart);
  }
}

// ─── خالی کردن سبد ───

export function clearCart() {
  saveCart([]);
}

// ─── بررسی وجود در سبد ───

export function isInCart(productId, variantId = null) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;
  return getCart().some(
    (i) => i.itemType !== "used_product" && i.productId === pid && (i.variantId ?? null) === vid
  );
}

export function isUsedInCart(usedProductId) {
  const uid = String(usedProductId);
  return getCart().some(
    (i) => i.itemType === "used_product" && i.usedProductId === uid
  );
}

// ─── تعداد کل آیتم‌ها ───

export function getCartCount() {
  return getCart().length;
}

// ─── dispatch event ───

function dispatchCartChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cartchange"));
    window.dispatchEvent(new Event("cart-changed"));
  }
}