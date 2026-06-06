"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FiCheck, FiTag } from "react-icons/fi";
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
export default function CategoryNodeStep({ node, value, onChange }) {
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

  /* ─── render ─── */
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-28 rounded-[8px] bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-[#0d0d0d]">{node.label}</h3>
        {!node.required && (
          <p className="text-xs text-gray-400 mt-1">انتخاب این بخش اختیاری است</p>
        )}
      </div>

      {products.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-gray-300 bg-gray-50 py-10 text-center">
          <FiTag className="w-8 h-8 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-400">محصولی در این دسته‌بندی یافت نشد</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {products.map((p) => {
            const selected = String(p._id) === String(selectedProductId);
            const priceToman = eurToToman(Number(p.basePrice), rate);
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => handleSelectProduct(p)}
                className={`relative text-right rounded-[8px] border p-1.5 transition flex flex-col ${
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
                <p className="text-[11px] font-medium text-[#0d0d0d] line-clamp-1 leading-4">
                  {p.name}
                </p>
                {priceToman > 0 && (
                  <p className="text-[10px] text-[#aa4725] font-semibold mt-0.5">
                    {formatToman(priceToman)} تومان
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── انتخاب واریانت برای محصول انتخاب‌شده ─── */}
      {selectedProduct && hasVariants && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700">
            ویژگی‌های «{selectedProduct.name}»
          </p>
          {optionKeys.map((attrKey) => {
            const values = variantOptions[attrKey];
            const label = labelMap[attrKey] || attrKey;
            return (
              <div key={attrKey} className="flex flex-col gap-2">
                <span className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span className="w-1 h-3.5 bg-[#aa4725] rounded-full" />
                  {label}
                </span>
                <div className="flex flex-wrap gap-2">
                  {values.map((val) => {
                    const isActive = variantSelection[attrKey] === val;
                    const hasStock = productVariants.some(
                      (v) =>
                        v.attributes?.[attrKey] === val &&
                        (v.stock === undefined || v.stock > 0)
                    );
                    return (
                      <button
                        key={val}
                        type="button"
                        disabled={!hasStock}
                        onClick={() => handleVariantSelect(attrKey, val)}
                        className={`min-w-[48px] px-3 h-9 rounded-md text-xs font-medium border transition ${
                          isActive
                            ? "bg-[#aa4725] text-white border-[#aa4725]"
                            : hasStock
                            ? "bg-white border-gray-200 text-gray-600 hover:border-[#aa4725]/50"
                            : "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed line-through"
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

          {optionKeys.every((k) => variantSelection[k]) && !matchedVariant && (
            <p className="text-xs text-red-500">این ترکیب موجود نیست</p>
          )}
          {matchedVariant && (
            <p className="text-xs text-green-600">
              قیمت: {formatToman(computeDisplayPrice(selectedProduct, matchedVariant))} تومان
            </p>
          )}
        </div>
      )}
    </div>
  );
}
