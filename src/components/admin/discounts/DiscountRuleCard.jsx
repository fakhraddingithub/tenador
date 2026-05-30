"use client";
// components/admin/discounts/DiscountRuleCard.jsx

const TYPE_COLORS = {
  product: "bg-blue-50 text-blue-700 border-blue-200",
  category: "bg-purple-50 text-purple-700 border-purple-200",
  serie: "bg-indigo-50 text-indigo-700 border-indigo-200",
  brand: "bg-orange-50 text-orange-700 border-orange-200",
  global: "bg-green-50 text-green-700 border-green-200",
  userRole: "bg-pink-50 text-pink-700 border-pink-200",
  userLevel: "bg-yellow-50 text-yellow-700 border-yellow-200",
  cartValue: "bg-teal-50 text-teal-700 border-teal-200",
  variant: "bg-cyan-50 text-cyan-700 border-cyan-200",  
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" });
}

function isExpired(endAt) {
  return new Date(endAt) < new Date();
}

function isActive(rule) {
  return rule.active && !isExpired(rule.endAt) && new Date(rule.startAt) <= new Date();
}

export default function DiscountRuleCard({ rule, typeLabels, onEdit, onDelete, onToggle }) {
  const active = isActive(rule);
  const expired = isExpired(rule.endAt);

  return (
    <div
      className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow ${
        !rule.active ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Right: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="font-semibold text-gray-800 text-sm">{rule.title}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                TYPE_COLORS[rule.type] || "bg-gray-50 text-gray-600 border-gray-200"
              }`}
            >
              {typeLabels[rule.type] || rule.type}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                active
                  ? "bg-green-50 text-green-700"
                  : expired
                  ? "bg-red-50 text-red-600"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {active ? "فعال" : expired ? "منقضی" : "غیرفعال"}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {/* مقدار تخفیف */}
            <span className="font-medium text-[#aa4725] text-sm">
              {rule.discount?.kind === "percent"
                ? `${rule.discount.value}٪ تخفیف`
                : `${rule.discount?.value?.toLocaleString("fa-IR")} تومان`}
            </span>
            <span>شروع: {formatDate(rule.startAt)}</span>
            <span>پایان: {formatDate(rule.endAt)}</span>
            <span>اولویت: {rule.priority}</span>
            {rule.usageLimit && (
              <span>
                استفاده: {rule.usedCount}/{rule.usageLimit}
              </span>
            )}
            {rule.combinable && <span className="text-indigo-500">قابل ترکیب</span>}
          </div>

          {/* شرایط */}
          {(rule.conditions?.minCartValue > 0 || rule.conditions?.onlyFirstOrders) && (
            <div className="mt-1.5 flex gap-2 flex-wrap">
              {rule.conditions.minCartValue > 0 && (
                <span className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600">
                  حداقل سبد: {rule.conditions.minCartValue.toLocaleString("fa-IR")} تومان
                </span>
              )}
              {rule.conditions.onlyFirstOrders && (
                <span className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600">
                  فقط اولین سفارش
                </span>
              )}
            </div>
          )}

          {/* نقش/سطح */}
          {rule.type === "userRole" && rule.targetRoles?.length > 0 && (
            <div className="mt-1.5 flex gap-1 flex-wrap">
              {rule.targetRoles.map((r) => (
                <span key={r} className="text-xs bg-pink-50 text-pink-700 border border-pink-200 rounded-lg px-2 py-0.5">
                  {r}
                </span>
              ))}
            </div>
          )}

          {rule.note && (
            <p className="text-xs text-gray-400 mt-1.5 italic">📝 {rule.note}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(rule)}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            ویرایش
          </button>
          <button
            onClick={() => onToggle(rule._id, rule.active)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              rule.active
                ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                : "bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            {rule.active ? "غیرفعال" : "فعال"}
          </button>
          <button
            onClick={() => onDelete(rule._id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}
