"use client";
// src/components/admin/discounts/QuantityDiscountCard.jsx

const TYPE_LABELS = {
  global:   "همه محصولات",
  product:  "محصول خاص",
  brand:    "برند",
  serie:    "سری",
  category: "دسته‌بندی",
};

const TYPE_COLORS = {
  global:   "bg-green-50 text-green-700 border-green-200",
  product:  "bg-blue-50 text-blue-700 border-blue-200",
  brand:    "bg-orange-50 text-orange-700 border-orange-200",
  serie:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  category: "bg-purple-50 text-purple-700 border-purple-200",
};

function formatTier(t) {
  const amount =
    t.discount.kind === "percent"
      ? `${t.discount.value}٪`
      : `${Number(t.discount.value).toLocaleString("fa-IR")} تومان`;
  return `${t.minQty}+ عدد → ${amount}`;
}

function statusOf(item) {
  const now = new Date();
  if (!item.active) return { text: "غیرفعال", cls: "bg-gray-100 text-gray-500" };
  if (item.startAt && new Date(item.startAt) > now)
    return { text: "زمان‌بندی‌شده", cls: "bg-blue-50 text-blue-600" };
  if (item.endAt && new Date(item.endAt) < now)
    return { text: "منقضی", cls: "bg-red-50 text-red-500" };
  return { text: "فعال", cls: "bg-green-50 text-green-600" };
}

export default function QuantityDiscountCard({ item, onEdit, onDelete, onToggle }) {
  const status = statusOf(item);
  const targetsCount = (item.targets || []).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 hover:shadow-sm transition-shadow">
      {/* نوع + هدف */}
      <div className="flex items-center gap-3 md:w-64 flex-shrink-0 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                TYPE_COLORS[item.type] || "bg-gray-50 text-gray-600 border-gray-200"
              }`}
            >
              {TYPE_LABELS[item.type] || item.type}
            </span>
            {item.type !== "global" && targetsCount > 0 && (
              <span className="text-[10px] text-gray-400">
                {targetsCount} مورد
              </span>
            )}
          </div>
          {item.title && (
            <p className="text-sm font-bold text-gray-800 truncate">{item.title}</p>
          )}
        </div>
      </div>

      {/* پله‌ها */}
      <div className="flex flex-wrap items-center gap-1.5 flex-1">
        {(item.tiers || []).map((t, i) => (
          <span
            key={i}
            className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-full"
          >
            {formatTier(t)}
          </span>
        ))}
      </div>

      {/* وضعیت + اکشن‌ها */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
          {status.text}
        </span>
        <button
          onClick={() => onToggle(item._id, item.active)}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          {item.active ? "غیرفعال کن" : "فعال کن"}
        </button>
        <button
          onClick={() => onEdit(item)}
          className="text-xs font-medium text-[#aa4725] px-2 py-1 rounded hover:bg-[#aa4725]/10 transition-colors"
        >
          ویرایش
        </button>
        <button
          onClick={() => onDelete(item._id)}
          className="text-xs font-medium text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors"
        >
          حذف
        </button>
      </div>
    </div>
  );
}
