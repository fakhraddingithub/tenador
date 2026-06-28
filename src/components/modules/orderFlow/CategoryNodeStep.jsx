"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiTag, FiX, FiRefreshCw } from "react-icons/fi";
import { eurToToman, formatToman } from "@/lib/currency";

/* ─── helpers (هم‌راستا با QuickViewModal) ─── */
function groupVariantOptions(variants = []) {
  const map = {};
  for (const v of variants) {
    const attrs = v.attributes || {};
    for (const [key, val] of Object.entries(attrs)) {
      if (!map[key]) map[key] = new Set();
      map[key].add(val);
    }
  }
  return Object.fromEntries(
    Object.entries(map).map(([k, s]) => [k, Array.from(s)])
  );
}

function findMatchingVariant(variants = [], selection = {}) {
  if (!Object.keys(selection).length) return null;
  return (
    variants.find((v) => {
      const attrs = v.attributes || {};
      return Object.entries(selection).every(([k, val]) => attrs[k] === val);
    }) || null
  );
}

function buildLabelMap(variantAttributes = []) {
  return Object.fromEntries(variantAttributes.map((a) => [a.name, a.label]));
}

function getNodeCategoryId(node) {
  const cat = node?.categoryId;
  if (!cat) return null;
  return typeof cat === "object" ? cat._id || cat.id : cat;
}

/* نام محصول = «فارسی + انگلیسی» در یک رشته؛ دقیقاً مثل کارت صفحه‌ی محصولات
   جدا می‌شود: تا اولین حرف لاتین/پرانتز = فارسی، باقی = انگلیسی. */
function splitName(text = "") {
  const match = text.match(/[a-zA-Z(].*/);
  if (match)
    return {
      farsi: text.substring(0, match.index).trim(),
      english: match[0].trim(),
    };
  return { farsi: text, english: "" };
}

/**
 * مرحله‌ی نود نوع "category" — انتخاب یک محصول (و در صورت نیاز واریانت) از یک دسته‌بندی
 *
 * props:
 *  - node      نود فرایند { id, label, categoryId, allowVariantSelection }
 *  - value     انتخاب فعلی این نود (برای بازگردانی هنگام رفت‌وبرگشت)
 *  - onChange  (selection | undefined) => void
 *
 * شکل selection خروجی:
 *  { nodeId, nodeType:'category', nodeLabel,
 *    selectedProductId, selectedProductName, selectedProductImage,
 *    selectedVariantId, selectedVariantLabel, displayPriceToman }
 */
export default function CategoryNodeStep({
  node,
  value,
  onChange,
  showError = false,
  onIncompleteChange,
}) {
  const categoryId = useMemo(() => getNodeCategoryId(node), [node]);
  const allowVariant = node?.allowVariantSelection !== false;

  const [products, setProducts] = useState([]);
  const [rate, setRate] = useState(0);
  const [loading, setLoading] = useState(Boolean(categoryId));

  const [selectedProductId, setSelectedProductId] = useState(
    value?.selectedProductId || null
  );
  // مقدار اولیه از انتخاب قبلی بازگردانی می‌شود (هنگام رفت‌وبرگشت بین مراحل)
  const [variantSelection, setVariantSelection] = useState(() => ({
    ...(value?.selectedVariantAttributes || {}),
  })); // attrName -> value

  // ─── واکشی محصولات دسته‌بندی + نرخ ارز ───
  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [prodRes, rateRes] = await Promise.all([
          fetch(`/api/product?category=${categoryId}&withVariants=true`),
          fetch(`/api/exchange-rate`),
        ]);
        const prodData = await prodRes.json();
        const rateData = await rateRes.json().catch(() => ({}));
        if (cancelled) return;
        setProducts(Array.isArray(prodData?.products) ? prodData.products : []);
        setRate(rateData?.rateToToman || 0);
      } catch (err) {
        console.error("CategoryNodeStep: load failed", err);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p._id) === String(selectedProductId)) || null,
    [products, selectedProductId]
  );

  const productVariants = useMemo(
    () => selectedProduct?.variants || [],
    [selectedProduct]
  );
  const hasVariants =
    allowVariant && Array.isArray(productVariants) && productVariants.length > 0;

  const variantOptions = useMemo(
    () => groupVariantOptions(productVariants),
    [productVariants]
  );
  const optionKeys = Object.keys(variantOptions);
  const labelMap = useMemo(
    () => buildLabelMap(selectedProduct?.category?.variantAttributes),
    [selectedProduct]
  );

  const matchedVariant = useMemo(() => {
    if (!hasVariants) return null;
    if (!optionKeys.every((k) => variantSelection[k])) return null;
    return findMatchingVariant(productVariants, variantSelection);
  }, [hasVariants, optionKeys, variantSelection, productVariants]);

  // ویژگی‌هایی که هنوز انتخاب نشده‌اند (برای پیام اعتبارسنجی)
  const missingVariantKeys = useMemo(
    () => (hasVariants ? optionKeys.filter((k) => !variantSelection[k]) : []),
    [hasVariants, optionKeys, variantSelection]
  );

  // محصول واریانت‌دار انتخاب شده ولی واریانتش کامل/معتبر نیست
  const isIncomplete = Boolean(selectedProduct) && hasVariants && !matchedVariant;

  // وضعیت ناقص بودن را به والد گزارش بده تا ناوبری را کنترل کند
  useEffect(() => {
    onIncompleteChange?.(isIncomplete);
  }, [isIncomplete, onIncompleteChange]);

  // ─── محاسبه‌ی قیمت نمایشی ───
  const computeDisplayPrice = (product, variant) => {
    const eur = variant ? Number(variant.price) : Number(product?.basePrice);
    return eurToToman(eur, rate);
  };

  // ─── انتشار انتخاب به والد ───
  const emitSelection = (product, variant) => {
    if (!product) {
      onChange(undefined);
      return;
    }
    // محصول واریانت‌دار ولی واریانت کامل انتخاب نشده → ناقص
    const productHasVariants =
      allowVariant &&
      Array.isArray(product.variants) &&
      product.variants.length > 0;
    if (productHasVariants && !variant) {
      onChange(undefined);
      return;
    }

    const variantLabel = variant
      ? Object.entries(variant.attributes || {})
          .map(([k, v]) => `${labelMap[k] || k}: ${v}`)
          .join("، ")
      : null;

    onChange({
      nodeId: node.id,
      nodeType: "category",
      nodeLabel: node.label,
      selectedProductId: String(product._id),
      selectedProductName: product.name,
      selectedProductImage: product.mainImage || null,
      selectedVariantId: variant ? String(variant._id) : null,
      selectedVariantLabel: variantLabel,
      selectedVariantAttributes: variant ? { ...(variant.attributes || {}) } : null,
      displayPriceToman: computeDisplayPrice(product, variant),
    });
  };

  // وقتی واریانت کامل می‌شود، انتخاب را به‌روزرسانی کن
  useEffect(() => {
    if (!selectedProduct) return;
    if (hasVariants) {
      emitSelection(selectedProduct, matchedVariant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedVariant]);

  const handleSelectProduct = (product) => {
    setSelectedProductId(String(product._id));
    setVariantSelection({});
    // emitSelection خودش تشخیص می‌دهد محصول واریانت‌دار است یا نه:
    // واریانت‌دار → ناقص (undefined) تا انتخاب واریانت، وگرنه انتخاب کامل
    emitSelection(product, null);
  };

  const handleVariantSelect = (attrKey, val) => {
    setVariantSelection((prev) => ({ ...prev, [attrKey]: val }));
  };

  // لغو انتخاب / بازگشت به مرور همه‌ی محصولات
  const handleDeselect = () => {
    setSelectedProductId(null);
    setVariantSelection({});
    onChange(undefined);
  };

  /* ─── render ─── */
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-32 rounded-[8px] bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const focusedNames = selectedProduct ? splitName(selectedProduct.name) : null;
  const focusedPrice = selectedProduct
    ? computeDisplayPrice(selectedProduct, matchedVariant)
    : 0;

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {/* سرتیتر مرحله */}
      <div className="shrink-0 mb-3">
        <h3 className="text-sm font-semibold text-[#0d0d0d]">{node.label}</h3>
        {!node.required && (
          <p className="text-xs text-gray-400 mt-1">انتخاب این بخش اختیاری است</p>
        )}
      </div>

      {/* ─── شبکه‌ی محصولات (هنگام تمرکز روی یک محصول، کم‌رنگ و تار می‌شود) ─── */}
      <motion.div
        animate={{
          opacity: selectedProduct ? 0.35 : 1,
          filter: selectedProduct ? "blur(2px)" : "blur(0px)",
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={`flex-1 min-h-0 overflow-y-auto -mx-1 px-1 ${
          selectedProduct ? "pointer-events-none" : ""
        }`}
      >
        {products.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-gray-300 bg-gray-50 py-10 text-center">
            <FiTag className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-400">محصولی در این دسته‌بندی یافت نشد</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pb-1">
            {products.map((p) => {
              const selected = String(p._id) === String(selectedProductId);
              const priceToman = eurToToman(Number(p.basePrice), rate);
              const { farsi, english } = splitName(p.name);
              return (
                <motion.button
                  key={p._id}
                  layoutId={`flow-card-${p._id}`}
                  type="button"
                  onClick={() => handleSelectProduct(p)}
                  className={`relative text-right rounded-[8px] border p-1.5 transition-colors flex flex-col ${
                    selected
                      ? "border-[#aa4725] bg-[#ffbf00]/10"
                      : "border-gray-200 hover:border-[#aa4725]/60 hover:bg-gray-50"
                  }`}
                >
                  <div className="relative w-full aspect-square rounded-md overflow-hidden bg-white mb-1.5">
                    {p.mainImage ? (
                      <Image
                        src={p.mainImage}
                        alt={p.name}
                        fill
                        className="object-contain p-0.5"
                        sizes="(max-width: 640px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <FiTag className="w-5 h-5" />
                      </div>
                    )}
                    {selected && (
                      <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#aa4725] flex items-center justify-center">
                        <FiCheck className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </div>
                  {/* نام در ۲ خط: خط ۱ فارسی، خط ۲ انگلیسی — مثل کارت صفحه‌ی محصولات */}
                  <p className="text-[11px] font-semibold text-[#0d0d0d] line-clamp-1 leading-4">
                    {farsi}
                  </p>
                  <p
                    dir="ltr"
                    className="text-[10px] text-gray-500 font-medium line-clamp-1 leading-4 text-right"
                  >
                    {english || " "}
                  </p>
                  {priceToman > 0 && (
                    <p className="text-[10px] text-[#aa4725] font-semibold mt-0.5">
                      {formatToman(priceToman)} تومان
                    </p>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ─── حالت تمرکز: کارت انتخاب‌شده به مرکز می‌آید و واریانت‌ها زیرش ظاهر می‌شوند ─── */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            key="focus-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleDeselect}
            className="absolute inset-0 z-20 overflow-y-auto bg-white/55 backdrop-blur-[1px]"
          >
            <div className="min-h-full flex flex-col items-center justify-center gap-4 py-4">
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col items-center gap-4 w-full max-w-[260px]"
              >
                {/* کارت محصول متمرکز — با همان layoutId از شبکه به مرکز morph می‌شود */}
                <motion.div
                  layoutId={`flow-card-${selectedProduct._id}`}
                  className="w-full rounded-[12px] border border-[#aa4725] bg-white p-3 shadow-[0_12px_32px_rgba(170,71,37,0.14)]"
                >
                  <div className="relative w-full aspect-square rounded-md overflow-hidden bg-white mb-2">
                    {selectedProduct.mainImage ? (
                      <Image
                        src={selectedProduct.mainImage}
                        alt={selectedProduct.name}
                        fill
                        className="object-contain p-1"
                        sizes="240px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <FiTag className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#aa4725] flex items-center justify-center">
                      <FiCheck className="w-3 h-3 text-white" />
                    </span>
                  </div>
                  {/* نام در ۲ خط بدون برش */}
                  <p className="text-[13px] font-bold text-[#0d0d0d] leading-5 text-center">
                    {focusedNames.farsi}
                  </p>
                  {focusedNames.english && (
                    <p
                      dir="ltr"
                      className="text-[11px] text-gray-500 font-medium leading-4 text-center mt-0.5"
                    >
                      {focusedNames.english}
                    </p>
                  )}
                  {focusedPrice > 0 && (
                    <p className="text-[12px] text-[#aa4725] font-bold text-center mt-1.5">
                      {formatToman(focusedPrice)} تومان
                    </p>
                  )}
                </motion.div>

                {/* انتخاب واریانت یا تایید محصول بدون واریانت */}
                {hasVariants ? (
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.28, ease: "easeOut" }}
                    className="w-full space-y-3.5"
                  >
                    <p className="text-xs font-semibold text-gray-700 text-center">
                      یک ویژگی را انتخاب کنید
                    </p>

                    {/* پیام اعتبارسنجی — درون‌خطی، زیر واریانت‌ها */}
                    <AnimatePresence>
                      {showError && missingVariantKeys.length > 0 && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-center overflow-hidden"
                        >
                          لطفاً{" "}
                          {missingVariantKeys
                            .map((k) => labelMap[k] || k)
                            .join(" و ")}{" "}
                          را انتخاب کنید
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {optionKeys.map((attrKey) => {
                      const values = variantOptions[attrKey];
                      const label = labelMap[attrKey] || attrKey;
                      return (
                        <div key={attrKey} className="flex flex-col gap-2">
                          <span className="text-xs text-gray-600 flex items-center gap-1.5">
                            <span className="w-1 h-3.5 bg-[#aa4725] rounded-full" />
                            {label}
                          </span>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {values.map((val) => {
                              const isActive = variantSelection[attrKey] === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleVariantSelect(attrKey, val)}
                                  className={`min-w-[48px] px-3 h-9 rounded-md text-xs font-medium border transition ${
                                    isActive
                                      ? "bg-[#aa4725] text-white border-[#aa4725]"
                                      : "bg-white border-gray-200 text-gray-600 hover:border-[#aa4725]/50"
                                  }`}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* خطای ترکیب ناموجود — درون‌خطی */}
                    {optionKeys.every((k) => variantSelection[k]) &&
                      !matchedVariant && (
                        <p className="text-xs text-red-500 text-center">
                          این ترکیب موجود نیست
                        </p>
                      )}
                    {matchedVariant && (
                      <p className="text-xs text-green-600 text-center flex items-center justify-center gap-1">
                        <FiCheck className="w-3.5 h-3.5" />
                        ویژگی انتخاب شد
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.p
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.28, ease: "easeOut" }}
                    className="text-xs text-green-600 flex items-center gap-1"
                  >
                    <FiCheck className="w-3.5 h-3.5" />
                    این محصول انتخاب شد
                  </motion.p>
                )}

                {/* دکمه‌های لغو انتخاب / تغییر محصول */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, duration: 0.25, ease: "easeOut" }}
                  className="flex items-center gap-2 pt-1"
                >
                  <button
                    type="button"
                    onClick={handleDeselect}
                    className="flex items-center gap-1.5 px-4 h-9 rounded-[6px] border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-[#aa4725] transition"
                  >
                    <FiX className="w-3.5 h-3.5" />
                    لغو انتخاب
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselect}
                    className="flex items-center gap-1.5 px-4 h-9 rounded-[6px] text-xs font-medium text-[#aa4725] hover:bg-[#ffbf00]/10 transition"
                  >
                    <FiRefreshCw className="w-3.5 h-3.5" />
                    تغییر محصول
                  </button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
