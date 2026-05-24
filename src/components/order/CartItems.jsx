/**
 * src/components/order/CartItems.jsx
 *
 * نمایش آیتم‌های سبد خرید با قیمت‌های تومانی از سرور
 */

import { FiPlus, FiMinus, FiTrash2 } from 'react-icons/fi';
import { formatPriceWithCurrency } from 'base/utils/formatters';

const CartItems = ({ items, onUpdateQuantity, onRemoveItem, isLoading }) => {

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-4 bg-white animate-pulse">
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-lg bg-slate-200" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-3/4 rounded bg-slate-200" />
                <div className="h-4 w-1/2 rounded bg-slate-200" />
                <div className="h-9 w-28 rounded bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">سبد خرید شما خالی است</h3>
        <p className="text-sm text-slate-500">محصولات مورد نظر خود را به سبد خرید اضافه کنید</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const productName  = item.product?.product?.name       ?? item.product?.name;
        const productImage = item.product?.product?.mainImage  ?? item.product?.mainImage;
        const productDesc  = item.product?.product?.shortDescription ?? '';
        const stock        = item.stock ?? item.product?.stock ?? 0;
        const hasDiscount  = (item.discountToman ?? 0) > 0;

        return (
          <div
            key={`${item.productId}-${item.variantId ?? 'base'}`}
            style={{ animationDelay: `${index * 60}ms` }}
            className="rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/40 animate-slide-up"
          >
            <div className="flex gap-4">
              {/* تصویر */}
              <div className="relative w-24 h-24 md:w-28 md:h-28 flex-shrink-0">
                <img
                  src={productImage}
                  alt={productName}
                  className="w-full h-full object-cover rounded-xl border border-slate-100"
                />
                {/* بج تخفیف */}
                {hasDiscount && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm">
                    تخفیف
                  </div>
                )}
              </div>

              {/* اطلاعات */}
              <div className="flex-1 min-w-0 flex flex-col">
                <h3 className="text-sm md:text-base font-bold text-slate-800 line-clamp-2 mb-1">
                  {productName}
                </h3>

                {productDesc && (
                  <p className="text-xs text-slate-500 w-[70%] line-clamp-1 mb-3">
                    {productDesc}
                  </p>
                )}

                {/* واریانت */}
                {item.variantId && item.variantAttributes && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.entries(item.variantAttributes).map(([key, val]) => (
                      <span key={key} className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {val}
                      </span>
                    ))}
                  </div>
                )}

                {hasDiscount && (
                  <p className="text-[10px] text-green-600 font-bold mb-2">
                    ✓ تخفیف اعمال شد
                  </p>
                )}

                {/* کنترل تعداد */}
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(item.productId, -1, item.variantId)}
                      className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition"
                    >
                      {item.quantity === 1 ? (
                        <FiTrash2 className="w-4 h-4 text-red-500" />
                      ) : (
                        <FiMinus className="w-4 h-4" />
                      )}
                    </button>

                    <span className="w-8 text-center font-semibold text-slate-800">
                      {item.quantity}
                    </span>

                    <button
                      onClick={() => onUpdateQuantity(item.productId, 1, item.variantId)}
                      disabled={stock > 0 && item.quantity >= stock}
                      className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition disabled:opacity-40"
                    >
                      <FiPlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ناحیه قیمت */}
              <div className="flex flex-col items-end justify-between min-w-[100px]">
                <button
                  onClick={() => onRemoveItem(item.productId, item.variantId)}
                  className="md:hidden p-1 text-slate-400 hover:text-red-500 transition"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>

                <div className="text-left">
                  {/* قیمت خط خورده */}
                  {hasDiscount && (
                    <div className="text-[10px] md:text-xs text-slate-400 line-through decoration-red-300 mb-0">
                      {formatPriceWithCurrency(item.itemTotalBeforeDiscount)}
                    </div>
                  )}

                  <div className="text-sm md:text-base font-extrabold text-indigo-600">
                    {formatPriceWithCurrency(item.itemFinalPrice)}
                  </div>

                  {item.quantity > 1 && (
                    <div className="text-[10px] text-slate-500">
                      هر عدد {formatPriceWithCurrency(item.unitPriceToman)}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onRemoveItem(item.productId, item.variantId)}
                  className="hidden md:flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600 transition"
                >
                  <FiTrash2 className="w-3.5 h-3.5" />
                  حذف
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CartItems;
