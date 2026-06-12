"use client";
// src/components/admin/discounts/QuantityDiscountCard.jsx
//
// کارت نمایش یک تخفیف تعدادی در لیست بخش «تخفیف‌ها» — هم‌خانواده با CouponCard.

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
  const product = item.product || {};

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 hover:shadow-sm transition-shadow">
      {/* محصول */}
      <div className="flex items-center gap-3 md:w-72 flex-shrink-0 min-w-0">
        {product.mainImage ? (
          <img
            src={product.mainImage}
            alt=""
            className="w-12 h-12 rounded-lg object-cover border border-gray-100 flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">
            {product.name || "محصول حذف‌شده"}
          </p>
          {item.title && <p className="text-xs text-gray-400 truncate">{item.title}</p>}
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
