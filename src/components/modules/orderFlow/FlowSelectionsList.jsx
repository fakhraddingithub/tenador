"use client";

import { FiSettings, FiTag, FiTrash2 } from "react-icons/fi";
import { formatToman } from "@/lib/currency";

/**
 * نمایش فشرده‌ی انتخاب‌های فرایند سفارش زیر یک آیتم سبد خرید.
 *
 * props:
 *  - flowSelections  آرایه‌ی غنی‌شده‌ی انتخاب‌ها (از api/cart/products)
 *  - compact         نسخه‌ی کوچک‌تر (برای drawer)
 *  - onRemove        (selection) => void  — در صورت ارائه، برای انتخاب‌های غیراجباری
 *                    دکمه‌ی حذف نمایش داده می‌شود
 */
export default function FlowSelectionsList({ flowSelections, compact = false, onRemove }) {
  if (!Array.isArray(flowSelections) || flowSelections.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5 border-r-2 border-[#aa4725]/20 pr-2.5">
      {flowSelections.map((sel, idx) => {
        const addon = Number(sel.addonToman) || 0;
        const addonText = addon > 0 ? `+ ${formatToman(addon)} تومان` : null;
        const canRemove = typeof onRemove === "function" && !sel.required;

        const removeBtn = canRemove ? (
          <button
            type="button"
            onClick={() => onRemove(sel)}
            aria-label="حذف این انتخاب"
            className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
          >
            <FiTrash2 className="w-3 h-3" />
          </button>
        ) : null;

        if (sel.nodeType === "service") {
          // پیکربندیِ کاملِ خدمت — هر آپشن یک خط، تا مشتری دقیقاً بداند چه سفارش داده
          const config = Array.isArray(sel.serviceConfig) ? sel.serviceConfig : [];
          return (
            <div key={`${sel.nodeId}-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0 text-[11px] text-gray-600">
                  <FiSettings className="w-3 h-3 text-[#aa4725] shrink-0" />
                  <span className="font-medium text-gray-700 truncate">
                    {sel.nodeLabel}
                  </span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {addonText && (
                    <span className="text-[10px] font-medium text-[#aa4725]">
                      {addonText}
                    </span>
                  )}
                  {removeBtn}
                </span>
              </div>

              {config.map((c, i) => (
                <div
                  key={`${c.optionKey}-${i}`}
                  className="flex items-center justify-between gap-2 pr-4"
                >
                  <span className="flex items-center gap-1.5 min-w-0 text-[11px] text-gray-600">
                    {c.image && !compact && (
                      <img
                        src={c.image}
                        alt=""
                        loading="lazy"
                        className="w-4 h-4 rounded object-cover border border-gray-100 shrink-0"
                      />
                    )}
                    <span className="text-gray-400 shrink-0">{c.title}:</span>
                    <span className="font-medium text-gray-700 truncate">{c.label}</span>
                  </span>
                  {c.priceModifier > 0 && (
                    <span className="shrink-0 text-[10px] text-gray-400">
                      + {formatToman(c.priceModifier)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        }

        // category
        return (
          <div
            key={`${sel.nodeId}-${idx}`}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-1.5 min-w-0 text-[11px] text-gray-600">
              {sel.selectedProductImage && !compact ? (
                <img
                  src={sel.selectedProductImage}
                  alt={sel.selectedProductName || ""}
                  className="w-5 h-5 rounded object-cover border border-gray-100 shrink-0"
                />
              ) : (
                <FiTag className="w-3 h-3 text-[#aa4725] shrink-0" />
              )}
              <span className="text-gray-400 shrink-0">{sel.nodeLabel}:</span>
              <span className="font-medium text-gray-700 truncate">
                {sel.selectedProductName}
                {sel.selectedVariantLabel ? ` (${sel.selectedVariantLabel})` : ""}
              </span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {addonText && (
                <span className="text-[10px] font-medium text-[#aa4725]">
                  {addonText}
                </span>
              )}
              {removeBtn}
            </span>
          </div>
        );
      })}
    </div>
  );
}
