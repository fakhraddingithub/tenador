/**
 * services/orderEurRecalc.js
 *
 * بازمحاسبه‌ی «مبلغ کلِ یورویی سفارش» (order.priceEUR) از روی قیمت‌های یورویی
 * اقلام (order.items[].priceEUR).
 *
 * ⚠️ این ماژول کاملاً مستقل از سیستم تومان است و هیچ فیلد تومانی
 * (unitPrice / subtotalPrice / discountAmount / couponDiscount / totalPrice /
 * paymentStatus) را نمی‌خواند و نمی‌نویسد. متقابلاً services/orderRecalc.js
 * (سیستم تومان) هرگز فیلدهای یورویی را لمس نمی‌کند.
 *
 * تعریف‌ها:
 *   items[].priceEUR = قیمت **واحد** به یورو، دستی توسط ادمین (نه قیمت محصول).
 *   سهم هر قلم        = priceEUR × quantity   (هم‌ارزِ unitPrice تومانی)
 *   مبلغ کل یورو      = Σ سهمِ اقلامی که priceEUR دارند
 *
 * قاعده‌ی ایمنیِ سازگاری با گذشته (مهم‌ترین نکته‌ی این فایل):
 *   اگر **هیچ** قلمی قیمت یورویی نداشته باشد، order.priceEUR اصلاً لمس نمی‌شود.
 *   یعنی سفارش‌های قدیمی (که فقط یک مبلغ کلِ یورویی دستی دارند) هرگز به صفر
 *   یا null بازنویسی نمی‌شوند. مبلغ کل فقط وقتی خودکار عوض می‌شود که دست‌کم یک
 *   قلم قیمت یورویی داشته باشد — یعنی دقیقاً وقتی ادمین آگاهانه از قیمت‌گذاری
 *   یوروییِ سطحِ قلم استفاده کرده است.
 */

/** آیا مقدار یک قیمت یورویی معتبرِ ثبت‌شده است؟ (null/undefined/NaN = تعیین‌نشده) */
export function hasItemEur(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

/**
 * جمعِ قیمت‌های یورویی اقلام.
 *
 * @param {Array<{ priceEUR?: number|null, quantity?: number }>} items
 * @returns {{ hasAny: boolean, sum: number, count: number }}
 *   hasAny = آیا دست‌کم یک قلم قیمت یورویی دارد (تصمیم‌گیرِ «بازمحاسبه بکنیم یا نه»)
 *   sum    = Σ(priceEUR × quantity) روی همان اقلام
 */
export function sumItemsEUR(items) {
  const list = Array.isArray(items) ? items : [];
  let sum = 0;
  let count = 0;

  for (const it of list) {
    if (!hasItemEur(it?.priceEUR)) continue;
    const price = Math.max(0, Number(it.priceEUR));
    const qty = Math.max(1, Math.floor(Number(it?.quantity)) || 1);
    sum += price * qty;
    count += 1;
  }

  // گِرد کردن به دو رقم اعشار — یورو ارزِ اعشاری است و جمعِ اعداد اعشاری در
  // ممیز شناور دُم می‌سازد (0.1 + 0.2). بدون این، مبلغ کل مثل 100.00000000000001 می‌شد.
  return { hasAny: count > 0, sum: Math.round(sum * 100) / 100, count };
}

/**
 * مبلغ کلِ یورویی‌ای که باید ذخیره شود را برمی‌گرداند.
 *
 * @param {Array} items          اقلامِ سفارش (پس از اعمالِ تغییرِ جاری)
 * @param {number|null} current  مبلغ کلِ یورویی فعلیِ سفارش
 * @returns {number|null} مقدارِ جدید؛ اگر هیچ قلمی قیمت یورویی ندارد همان `current`
 *                        برگردانده می‌شود (یعنی «دست نزن»).
 */
export function resolveOrderEurTotal(items, current) {
  const { hasAny, sum } = sumItemsEUR(items);
  if (!hasAny) return current ?? null;
  return sum;
}

/**
 * همان منطق، ولی اعمال‌شده روی یک سندِ Mongoose (یا شیء ساده) — در جاهایی که
 * سند با order.save() ذخیره می‌شود.
 *
 * @param {Object} order سندِ سفارش با items[] و priceEUR
 * @returns {boolean} آیا مقدار عوض شد (برای لاگ/تصمیمِ فراخوان)
 */
export function applyOrderEurTotal(order) {
  const next = resolveOrderEurTotal(order?.items, order?.priceEUR ?? null);
  const prev = order?.priceEUR ?? null;
  if (next === prev) return false;
  order.priceEUR = next;
  return true;
}

/* ─── یورو در سفارش‌های اقساطی ─────────────────────────────────────────
 * مبلغ یوروییِ هر چکِ پاس‌شده یک ردیفِ عادی در order.paymentsEUR است با
 * installmentCheck = شناسه‌ی چک. پس مانده‌ی یورو، گزارش‌ها، فاکتور و پنل مشتری
 * (که همه Σ paymentsEUR.amount را می‌خوانند) بدون هیچ تغییری هماهنگ می‌مانند.
 * هیچ تبدیلی از مبلغ تومانیِ چک انجام نمی‌شود. */

/** خلاصه‌ی یوروی سفارش: مبلغ کل، پرداخت‌شده، مانده (null وقتی مبلغ کل ثبت نشده). */
export function eurSummary(order) {
  const priceEUR = hasItemEur(order?.priceEUR) ? Number(order.priceEUR) : null;
  const paid = (order?.paymentsEUR || []).reduce((s, p) => s + (Number(p?.amount) || 0), 0);
  const paidEUR = Math.round(paid * 100) / 100;
  return {
    priceEUR,
    paidEUR,
    remainingEUR: priceEUR === null ? null : Math.round((priceEUR - paidEUR) * 100) / 100,
    // ردیف‌هایی که به هیچ چک/رسیدی وصل نیستند (دستی یا قدیمی) — برای هشدارِ «دوباره ثبت نکنید»
    unlinkedCount: (order?.paymentsEUR || []).filter((p) => !p?.installmentCheck && !p?.payment).length,
  };
}

/**
 * پیوندِ یک ردیفِ یورو:
 *   installmentCheck → چکِ اقساطی (Installment.checks._id)
 *   payment          → رسید/پرداختِ تومانی (Payment._id)
 */
export const EUR_LINK_FIELDS = ["installmentCheck", "payment"];

/** جمعِ پرداخت‌های یوروییِ پیوندخورده با `field`: { [id]: amount } */
export function eurPaidByLink(paymentsEUR, field) {
  const out = {};
  for (const p of paymentsEUR || []) {
    if (!p?.[field]) continue;
    const key = String(p[field]);
    out[key] = Math.round(((out[key] || 0) + (Number(p.amount) || 0)) * 100) / 100;
  }
  return out;
}

/**
 * مبلغ یوروی پیوندخورده به یک چک/رسید را «تنظیم» می‌کند (نه اضافه): ردیفِ موجود
 * ویرایش می‌شود (با editHistory، مثل PUT /eur)، نبودش ردیفِ تازه می‌سازد، و
 * amount = 0 ردیف را برمی‌دارد. خالص است؛ نوشتن با فراخوان است.
 *
 * @returns {{ rows: Array, changed: boolean }}
 */
export function setLinkedEur(paymentsEUR, { field, id, amount, adminId, now, newId, note }) {
  if (!EUR_LINK_FIELDS.includes(field)) throw new Error(`unknown EUR link field: ${field}`);
  const list = Array.isArray(paymentsEUR) ? paymentsEUR : [];
  const isLinked = (p) => p?.[field] != null && String(p[field]) === String(id);
  const linked = list.filter(isLinked);

  if (!(amount > 0)) {
    return { rows: list.filter((p) => !isLinked(p)), changed: linked.length > 0 };
  }

  if (!linked.length) {
    const row = {
      _id: newId, amount, note: note || "", [field]: id,
      confirmedBy: adminId, confirmedAt: now, createdAt: now, updatedAt: now,
    };
    return { rows: [...list, row], changed: true };
  }

  // یک چک/رسید یک ردیف دارد؛ اگر به‌هر دلیل بیشتر بود، اولی می‌ماند و بقیه ادغام نمی‌شوند بلکه حذف
  // می‌شوند — مبلغِ جدید همان «کلِ یوروی این چک/رسید» است.
  const [first] = linked;
  const same = Number(first.amount) === amount && linked.length === 1;
  if (same) return { rows: list, changed: false };

  const updated = Number(first.amount) === amount ? first : {
    ...first,
    amount,
    editedBy: adminId,
    editedAt: now,
    updatedAt: now,
    editHistory: [
      ...(Array.isArray(first.editHistory) ? first.editHistory : []),
      { oldAmount: Number(first.amount) || 0, newAmount: amount, at: now, by: adminId },
    ],
  };
  return {
    rows: list.filter((p) => !isLinked(p) || p === first).map((p) => (p === first ? updated : p)),
    changed: true,
  };
}

/**
 * اعتبارسنجیِ مبلغ یوروییِ یک چک/رسید.
 * required = مقدار باید فرستاده شود (پاس‌کردنِ چک روی سفارشی که مبلغ کلِ یورو دارد،
 * یا ویرایشِ یوروی چک/رسیدی که از قبل ثبت شده).
 * ۰ مجاز است و یعنی «یورویی ندارد» — ردیفی ثبت نمی‌شود (و ردیفِ موجود برداشته می‌شود).
 * @returns {{ value: number|null } | { error: string }}
 */
export function parseCheckEurAmount(raw, { required }) {
  if (raw === null || raw === undefined || raw === "") {
    return required ? { error: "مبلغ یورویی این چک را وارد کنید" } : { value: null };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { error: "مبلغ یورو باید عددی نامنفی باشد" };
  return { value: Math.round(n * 100) / 100 };
}
