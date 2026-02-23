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
 * Add a product (with optional variant) to the cart.
 *
 * Cart item shape:
 * {
 *   productId:   string,
 *   variantId:   string | null,
 *   quantity:    number,
 *   price:       number,
 *   attributes:  object | null,   // e.g. { color: "سفید" }
 *   product:     Product,
 *   variant:     Variant | null,
 * }
 *
 * Two items are considered the SAME line when both productId AND variantId match.
 * A product without variants (variantId = null) is its own unique line.
 */
export function addToCart(product, quantity = 1, variant = null) {
  const cart = getCart();

  const productId = product._id;
  const variantId = variant?._id || null;

  // Match on product + variant combination
  const existing = cart.find(
    (item) =>
      item.productId === productId &&
      (item.variantId || null) === variantId
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      productId,
      variantId,
      quantity,
      // Prefer variant price; fall back to product basePrice
      price: variant?.price ?? product.basePrice,
      // Human-readable label for order summary / cart UI
      attributes: variant?.attributes || null,
      product,
      variant: variant || null,
    });
  }

  saveCart(cart);
}

export function removeFromCart(productId, variantId = null) {
  const cart = getCart().filter(
    (item) =>
      !(item.productId === productId && (item.variantId || null) === variantId)
  );
  saveCart(cart);
}

export function updateQuantity(productId, variantId = null, quantity) {
  const cart = getCart();
  const item = cart.find(
    (i) =>
      i.productId === productId && (i.variantId || null) === variantId
  );
  if (item) {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    item.quantity = quantity;
    saveCart(cart);
  }
}

export function clearCart() {
  saveCart([]);
}

export { getCart };