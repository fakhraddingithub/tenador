"use client";

import { FiSettings, FiTag, FiLayers } from "react-icons/fi";

/**
 * نمایش انتخاب‌های فرایند سفارش (flowSelections) ذخیره‌شده روی یک آیتم سفارش.
 * نمایشی برجسته و واضح که دقیقاً مشخص می‌کند چه چیزی سفارش داده شده است.
 *
 * شکل داده (همان چیزی که در مدل Order ذخیره و در API پاپولیت می‌شود):
 *  - service:  { nodeLabel, nodeType:"service", serviceLabel, serviceValue, addonToman }
 *  - category: { nodeLabel, nodeType:"category", selectedProductName, selectedVariantLabel,
 *                addonToman, selectedProduct?: { name, mainImage } }
 *
 * props:
 *  - flowSelections  آرایه‌ی انتخاب‌ها
 */
function formatToman(v) {
  return new Intl.NumberFormat("fa-IR").format(Number(v ?? 0));
}

export default function OrderFlowSelectionsView({ flowSelections }) {
  if (!Array.isArray(flowSelections) || flowSelections.length === 0) return null;

  return (
    <div className="mt-2.5 rounded-xl border border-[#aa4725]/20 bg-[#aa4725]/[0.04] p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#aa4725] mb-2.5">
        <FiLayers className="w-3.5 h-3.5" />
        موارد انتخاب‌شده برای این محصول
      </p>

      <div className="space-y-2.5">
        {flowSelections.map((sel, idx) => {
          const addon = Number(sel.addonToman) || 0;
          const addonText = addon > 0 ? `+ ${formatToman(addon)} تومان` : null;
          const isService = sel.nodeType === "service";

          const productImage =
            sel.selectedProduct?.mainImage || sel.selectedProductImage || null;
          const productName =
            sel.selectedProductName || sel.selectedProduct?.name || "";

          const valueText = isService
            ? sel.serviceLabel
            : `${productName}${
                sel.selectedVariantLabel ? ` (${sel.selectedVariantLabel})` : ""
              }`;

          return (
            <div
              key={`${sel.nodeId || idx}-${idx}`}
              className="flex items-center gap-2.5"
            >
              {/* آیکن یا تصویر */}
              {!isService && productImage ? (
                <img
                  src={productImage}
                  alt={productName}
                  className="w-10 h-10 rounded-lg object-cover border border-gray-200 bg-white shrink-0"
                />
              ) : (
                <span className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  {isService ? (
                    <FiSettings className="w-4 h-4 text-[#aa4725]" />
                  ) : (
                    <FiTag className="w-4 h-4 text-[#aa4725]" />
                  )}
                </span>
              )}

              {/* متن */}
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] text-gray-400 leading-tight">
                  {sel.nodeLabel}
                </span>
                <span className="block text-xs font-semibold text-gray-800 truncate leading-snug">
                  {valueText || "—"}
                </span>
              </div>

              {/* افزوده‌ی قیمت */}
              {addonText && (
                <span className="shrink-0 text-[11px] font-bold text-[#aa4725] bg-[#aa4725]/10 px-2 py-1 rounded-lg">
                  {addonText}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
