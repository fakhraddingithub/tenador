"use client";

import { FiCheck } from "react-icons/fi";
import { formatToman } from "@/lib/currency";

/**
 * مرحله‌ی نود نوع "service" — انتخاب از بین آپشن‌های خدمت
 *
 * props:
 *  - node      نود فرایند { id, label, serviceName, serviceOptions[] }
 *  - value     انتخاب فعلی این نود (یا undefined)
 *  - onChange  (selection) => void
 *
 * شکل selection خروجی:
 *  { nodeId, nodeType:'service', nodeLabel, serviceOption:{ label, value, priceModifier } }
 */
export default function ServiceNodeStep({ node, value, onChange }) {
  const options = node.serviceOptions || [];
  const selectedValue = value?.serviceOption?.value ?? null;

  const formatModifier = (m) => {
    if (!m) return null;
    const sign = m > 0 ? "+" : "−";
    return `${sign} ${formatToman(Math.abs(m))} تومان`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[#0d0d0d]">{node.label}</h3>
        {node.serviceName && (
          <p className="text-xs text-gray-500 mt-1">{node.serviceName}</p>
        )}
      </div>

      {options.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          گزینه‌ای برای این خدمت تعریف نشده است
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt) => {
            const selected = selectedValue === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onChange({
                    nodeId: node.id,
                    nodeType: "service",
                    nodeLabel: node.label,
                    serviceOption: {
                      label: opt.label,
                      value: opt.value,
                      priceModifier: opt.priceModifier || 0,
                    },
                  })
                }
                className={`relative text-right rounded-[8px] border p-3 transition ${
                  selected
                    ? "border-[#aa4725] bg-[#ffbf00]/10"
                    : "border-gray-200 hover:border-[#aa4725]/60 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0d0d0d]">{opt.label}</p>
                    {opt.priceModifier ? (
                      <p
                        className={`text-xs mt-1 ${
                          opt.priceModifier > 0 ? "text-[#aa4725]" : "text-green-600"
                        }`}
                      >
                        {formatModifier(opt.priceModifier)}
                      </p>
                    ) : (
                      <p className="text-xs mt-1 text-gray-400">بدون تغییر قیمت</p>
                    )}
                  </div>
                  {selected && (
                    <span className="w-5 h-5 rounded-full bg-[#aa4725] flex items-center justify-center shrink-0">
                      <FiCheck className="w-3 h-3 text-white" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
