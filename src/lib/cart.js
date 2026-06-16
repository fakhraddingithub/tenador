/**
 * src/lib/cart.js
 *
 * مدیریت سبد خرید سمت کلاینت (localStorage)
 *
 * ساختار آیتم‌های سبد:
 *  محصول معمولی:  { productId, variantId, quantity, itemType: "product" }
 *  محصول دست‌دوم: { usedProductId, quantity: 1, itemType: "used_product" }
 *  محصول با فرایند سفارش: محصول معمولی + flowSelections[]
 *
 * هر عضو flowSelections یکی از دو شکل زیر است:
 *  نود خدمت:     { nodeId, nodeType:'service', nodeLabel, serviceOption:{ label, value, priceModifier } }
 *  نود دسته‌بندی: { nodeId, nodeType:'category', nodeLabel,
 *                  selectedProductId, selectedVariantId,
 *                  selectedProductName, selectedProductImage, selectedVariantLabel }
 *
 * نکته: قیمت‌ها (priceModifier و قیمت محصول انتخاب‌شده) صرفاً برای نمایش‌اند؛
 * قیمت نهایی در سرور (api/cart/products) به‌صورت معتبر بازمحاسبه می‌شود.
 */

const CART_KEY = "cart";
const COUPON_KEY = "cartCouponCode";

// ─── کد تخفیف اعمال‌شده ───
// کد در storage نگه داشته می‌شود تا در کل فرایند خرید (ثبت سفارش → پرداخت)
// فعال بماند؛ اعتبارسنجی و محاسبه مبلغ همیشه در سرور انجام می‌شود.

export function getStoredCouponCode() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(COUPON_KEY) || null;
  } catch {
    return null;
  }
}

export function storeCouponCode(code) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COUPON_KEY, String(code).trim().toUpperCase());
  } catch {}
}

export function clearStoredCouponCode() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(COUPON_KEY);
  } catch {}
}

// ─── ابزار flowSelections ───

// پاک‌سازی و نرمال‌سازی آرایه‌ی انتخاب‌های فرایند برای ذخیره‌سازی
function normalizeFlowSelections(flowSelections) {
  if (!Array.isArray(flowSelections)) return [];
  return flowSelections
    .filter((s) => s && s.nodeId)
    .map((s) => {
      if (s.nodeType === "service") {
        return {
          nodeId: String(s.nodeId),
          nodeType: "service",
          nodeLabel: s.nodeLabel ?? "",
          serviceOption: {
            label: s.serviceOption?.label ?? "",
            value: String(s.serviceOption?.value ?? ""),
            priceModifier: Number(s.serviceOption?.priceModifier) || 0,
          },
        };
      }
      // category
      return {
        nodeId: String(s.nodeId),
        nodeType: "category",
        nodeLabel: s.nodeLabel ?? "",
        selectedProductId: s.selectedProductId ? String(s.selectedProductId) : null,
        selectedVariantId: s.selectedVariantId ? String(s.selectedVariantId) : null,
        selectedProductName: s.selectedProductName ?? "",
        selectedProductImage: s.selectedProductImage ?? null,
        selectedVariantLabel: s.selectedVariantLabel ?? null,
      };
    });
}

// امضای پایدار از انتخاب‌های فرایند برای تشخیص یکسان بودن دو خط سبد.
// فقط بر اساس «انتخاب واقعی» (نه برچسب یا قیمت) ساخته می‌شود.
export function flowSignature(flowSelections) {
  const norm = normalizeFlowSelections(flowSelections);
  if (norm.length === 0) return "";
  return norm
    .map((s) =>
      s.nodeType === "service"
        ? `s:${s.nodeId}:${s.serviceOption.value}`
        : `c:${s.nodeId}:${s.selectedProductId || ""}:${s.selectedVariantId || ""}`
    )
    .sort()
    .join("|");
}

// امضای یک آیتم سبد (محصول معمولی → "")
function itemFlowSignature(item) {
  return flowSignature(item?.flowSelections);
}

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
        const flow = normalizeFlowSelections(item.flowSelections);
        return {
          productId: String(item.productId),
          variantId: item.variantId ? String(item.variantId) : null,
          quantity:  Math.max(1, Math.floor(item.quantity || 1)),
          itemType:  "product",
          ...(flow.length > 0 ? { flowSelections: flow } : {}),
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
    const flow = normalizeFlowSelections(item.flowSelections);
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity:  Math.max(1, Math.floor(item.quantity)),
      itemType:  "product",
      ...(flow.length > 0 ? { flowSelections: flow } : {}),
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

  // فقط با خط بدون فرایند (امضای خالی) ادغام شود
  const existing = cart.find(
    (i) =>
      i.itemType !== "used_product" &&
      i.productId === pid &&
      (i.variantId ?? null) === vid &&
      itemFlowSignature(i) === ""
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId: pid, variantId: vid, quantity, itemType: "product" });
  }

  saveCart(cart);
}

// ─── افزودن محصول همراه با انتخاب‌های فرایند سفارش ───

export function addToCartWithFlow(
  productId,
  quantity = 1,
  variantId = null,
  flowSelections = []
) {
  const flow = normalizeFlowSelections(flowSelections);

  // اگر هیچ انتخابی نیست، مثل افزودن عادی رفتار کن
  if (flow.length === 0) {
    addToCart(productId, quantity, variantId);
    return;
  }

  const cart = getCart();
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;
  const sig = flowSignature(flow);

  // خطی با همان محصول/واریانت و همان ترکیب انتخاب‌ها → افزایش تعداد
  const existing = cart.find(
    (i) =>
      i.itemType !== "used_product" &&
      i.productId === pid &&
      (i.variantId ?? null) === vid &&
      itemFlowSignature(i) === sig
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      productId: pid,
      variantId: vid,
      quantity: Math.max(1, Math.floor(quantity)),
      itemType: "product",
      flowSelections: flow,
    });
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

export function removeFromCart(productId, variantId = null, flowSelections = null) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;
  const sig = flowSignature(flowSelections); // null/[] → "" یعنی خط بدون فرایند

  const updated = getCart().filter(
    (i) =>
      !(
        i.itemType !== "used_product" &&
        i.productId === pid &&
        (i.variantId ?? null) === vid &&
        itemFlowSignature(i) === sig
      )
  );
  saveCart(updated);
}

// ─── حذف یک انتخابِ فرایند از یک خط سبد ───
// خطِ متناظر را با امضای فعلی پیدا می‌کند، انتخاب با nodeId را حذف می‌کند و
// اگر پس از حذف، امضای جدید با خط دیگری برابر شود آن دو را ادغام می‌کند.
export function removeFlowSelectionFromCart(
  productId,
  variantId = null,
  currentFlowSelections = null,
  nodeId
) {
  if (nodeId == null) return;
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;
  const sig = flowSignature(currentFlowSelections);

  const cart = getCart();
  const line = cart.find(
    (i) =>
      i.itemType !== "used_product" &&
      i.productId === pid &&
      (i.variantId ?? null) === vid &&
      itemFlowSignature(i) === sig
  );
  if (!line) return;

  const remaining = (line.flowSelections || []).filter(
    (s) => String(s.nodeId) !== String(nodeId)
  );
  const newSig = flowSignature(remaining);

  // ادغام با خطی که پس از حذف، امضای یکسانی پیدا می‌کند (مثلاً خط بدون فرایند)
  const target = cart.find(
    (i) =>
      i !== line &&
      i.itemType !== "used_product" &&
      i.productId === pid &&
      (i.variantId ?? null) === vid &&
      itemFlowSignature(i) === newSig
  );

  if (target) {
    target.quantity += line.quantity;
    cart.splice(cart.indexOf(line), 1);
  } else {
    line.flowSelections = remaining;
  }

  saveCart(cart);
}

export function removeUsedFromCart(usedProductId) {
  const uid = String(usedProductId);
  const updated = getCart().filter(
    (i) => !(i.itemType === "used_product" && i.usedProductId === uid)
  );
  saveCart(updated);
}

// ─── آپدیت تعداد محصول معمولی ───

export function updateQuantity(productId, variantId = null, quantity, flowSelections = null) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;
  const sig = flowSignature(flowSelections);

  if (quantity <= 0) {
    removeFromCart(pid, vid, flowSelections);
    return;
  }

  const cart = getCart();
  const item = cart.find(
    (i) =>
      i.itemType !== "used_product" &&
      i.productId === pid &&
      (i.variantId ?? null) === vid &&
      itemFlowSignature(i) === sig
  );

  if (item) {
    item.quantity = Math.max(1, Math.floor(quantity));
    saveCart(cart);
  }
}

// ─── خالی کردن سبد ───

export function clearCart() {
  clearStoredCouponCode();
  saveCart([]);
}

// ─── بررسی وجود در سبد ───

export function isInCart(productId, variantId = null, flowSelections = null) {
  const pid = String(productId);
  const vid = variantId ? String(variantId) : null;
  const sig = flowSignature(flowSelections);
  return getCart().some(
    (i) =>
      i.itemType !== "used_product" &&
      i.productId === pid &&
      (i.variantId ?? null) === vid &&
      itemFlowSignature(i) === sig
  );
}

export function isUsedInCart(usedProductId) {
  const uid = String(usedProductId);
  return getCart().some(
    (i) => i.itemType === "used_product" && i.usedProductId === uid
  );
}

// ─── تعداد کل آیتم‌ها ───

// تعداد خطوط سبد (هر ترکیب محصول/واریانت/فرایند یک خط)
export function getCartCount() {
  return getCart().length;
}

// تعداد کل واحدها (مجموع quantity) — منبع واحد برای بج نوار بالا
// همیشه از getCart() نرمال‌شده خوانده می‌شود تا با محتوای سبد یکسان بماند.
export function getCartTotalQuantity() {
  return getCart().reduce((sum, i) => sum + (i.quantity || 0), 0);
}

// ─── کلید یکتای هر خط سبد ───
// برای تطبیق خطوط محلی با پاسخ سرور (بدون اتکا به ترتیب/ایندکس)
export function cartLineKey(i) {
  if (!i) return "";
  if (i.itemType === "used_product") return `u:${i.usedProductId}`;
  return `p:${i.productId}:${i.variantId ?? ""}:${itemFlowSignature(i)}`;
}

// ─── همگام‌سازی سبد محلی با پاسخ معتبرشده‌ی سرور ───
// سرور آیتم‌هایی را که محصولشان دیگر وجود ندارد حذف می‌کند (filter(Boolean)).
// این تابع همان خطوط را از localStorage هم پاک می‌کند تا بج و محتوا هم‌خوان بمانند.
// فقط هرس می‌کند (چیزی اضافه/جابه‌جا نمی‌کند) و فقط در صورت تغییر ذخیره می‌کند
// تا حلقه‌ی بی‌نهایت رخ ندهد.
export function reconcileCartWithServer(serverItems) {
  if (typeof window === "undefined") return;
  if (!Array.isArray(serverItems)) return;

  const validKeys = new Set(serverItems.map(cartLineKey));
  const local = getCart();
  const kept = local.filter((i) => validKeys.has(cartLineKey(i)));

  if (kept.length !== local.length) {
    saveCart(kept); // dispatchCartChange → بج و نماهای باز به‌روز می‌شوند
  }
}

// ─── پاک‌سازی یک‌باره‌ی داده‌های قدیمی/خراب سبد ───
// به‌خاطر داده‌های ناسازگار قبلی، یک‌بار (و فقط یک‌بار) به‌ازای هر مرورگر
// کلیدهای مربوط به سبد پاک می‌شوند. پرچم در خود localStorage نگه داشته می‌شود
// تا با رفرش یا بازدید مجدد دوباره اجرا نشود.
// فقط کلیدهای سبد پاک می‌شوند؛ به وضعیت ورود/نشست کاربر دست نمی‌زند.
const CLEANUP_FLAG = "cart_cleanup_v1_done";
const STALE_CART_KEYS = [CART_KEY, COUPON_KEY];

export function runOneTimeCartCleanup() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(CLEANUP_FLAG)) return; // قبلاً اجرا شده → هیچ کاری نکن

    let cleared = false;
    for (const key of STALE_CART_KEYS) {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        cleared = true;
      }
    }

    // پرچم را همیشه ست کن تا دیگر هرگز اجرا نشود (حتی اگر چیزی برای پاک‌کردن نبود)
    localStorage.setItem(CLEANUP_FLAG, "true");

    // اگر سبد پاک شد، به نوار بالا/نماهای باز خبر بده تا بج صفر شود
    if (cleared) dispatchCartChange();
  } catch {
    // اگر localStorage در دسترس نبود، بی‌صدا رد شو
  }
}

// ─── dispatch event ───

function dispatchCartChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cartchange"));
    window.dispatchEvent(new Event("cart-changed"));
  }
}