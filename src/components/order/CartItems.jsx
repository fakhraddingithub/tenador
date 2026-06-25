/**
 * src/components/order/CartItems.jsx
 *
 * نمایش آیتم‌های سبد خرید — فونت و استایل هماهنگ با صفحه محصول
 */

import { FiPlus, FiMinus, FiTrash2 } from 'react-icons/fi';
import { formatPriceWithCurrency } from 'base/utils/formatters';
import { flowSignature } from '@/lib/cart';
import FlowSelectionsList from '@/components/modules/orderFlow/FlowSelectionsList';

const CartItems = ({ items, onUpdateQuantity, onRemoveItem, onRemoveFlowSelection, isLoading }) => {

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
        const productName  = item.product?.product?.name      ?? item.product?.name;
        const productImage = item.product?.product?.mainImage ?? item.product?.mainImage;
        const hasDiscount  = (item.discountToman ?? 0) > 0;

        // واریانت: از variantAttributes یا variant.attributes
        const variantAttrs =
          item.variantAttributes ||
          item.product?.variant?.attributes ||
          null;

        // تصویرِ نماینده‌ی هر ویژگیِ تصویری (مثلاً رنگ) برای نمایش thumbnail — Change 4
        const variantAttrImages =
          item.variantAttributeImages ||
          item.product?.variant?.attributeImages ||
          null;

        // مقادیرِ واحدهای ویژگی‌های چندواحدی (مثلاً سایز EU/سانتی‌متر) — Change 3
        const variantAttrUnits =
          item.variantAttributeUnits ||
          item.product?.variant?.attributeUnits ||
          null;

        // جداسازی بخش فارسی و انگلیسی نام (مثل صفحه محصول)
        const splitName = (text) => {
          if (!text) return { farsi: '', english: '' };
          const match = text.match(/[a-zA-Z(].*/);
          if (match) {
            return {
              farsi:   text.substring(0, match.index).trim(),
              english: match[0].trim(),
            };
          }
          return { farsi: text, english: '' };
        };

        const { farsi, english } = splitName(productName);

        return (
          <div
            key={`${item.productId}-${item.variantId ?? 'base'}-${flowSignature(item.flowSelections)}`}
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
                {hasDiscount && (
                  <div className="absolute -top-2 -right-2 bg-[#aa4725] text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm">
                    تخفیف
                  </div>
                )}
              </div>

              {/* اطلاعات */}
              <div className="flex-1 min-w-0 flex flex-col">
                {/* نام محصول — هماهنگ با ProductHeader */}
                <div className="mb-1.5">
                  {farsi && (
                    <h3 className="text-sm md:text-base font-bold text-[#1a1a1a] leading-snug tracking-tight">
                      {farsi}
                    </h3>
                  )}
                  {english && (
                    <span
                      className="block text-xs md:text-sm font-bold text-[#1a1a1a] tracking-tight mt-0.5"
                      dir="ltr"
                    >
                      {english}
                    </span>
                  )}
                  {/* اگر نام فقط انگلیسی بود */}
                  {!farsi && !english && productName && (
                    <h3 className="text-sm md:text-base font-bold text-[#1a1a1a] leading-snug tracking-tight">
                      {productName}
                    </h3>
                  )}
                </div>

                {/* واریانت — زیر نام محصول */}
                {variantAttrs && Object.keys(variantAttrs).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {Object.entries(variantAttrs).map(([key, val]) => {
                      const img = variantAttrImages?.[key];
                      const units = variantAttrUnits?.[key];
                      // چندواحدی: همه‌ی واحدها نمایش داده می‌شوند (مثلاً «۴۲ EU / ۲۶.۵ سانتی‌متر»)
                      const text = units
                        ? Object.entries(units)
                            .map(([u, v]) => `${v} ${u}`)
                            .join(' / ')
                        : val;
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 text-xs bg-[#aa4725]/8 text-[#aa4725] border border-[#aa4725]/20 px-2.5 py-0.5 rounded-full font-medium"
                        >
                          {img ? (
                            <img
                              src={img}
                              alt={val}
                              className="w-4 h-4 rounded-full object-cover border border-[#aa4725]/20"
                            />
                          ) : (
                            <span className="text-slate-500 text-[10px]">{key}:</span>
                          )}
                          {text}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* انتخاب‌های فرایند سفارش */}
                {item.flowSelections?.length > 0 && (
                  <FlowSelectionsList
                    flowSelections={item.flowSelections}
                    onRemove={
                      onRemoveFlowSelection
                        ? (sel) => onRemoveFlowSelection(item, sel)
                        : undefined
                    }
                  />
                )}

                {hasDiscount && (
                  <p className="text-[10px] text-green-600 font-bold mb-2 mt-2">
                    ✓ تخفیف اعمال شد
                  </p>
                )}

                {/* کنترل تعداد */}
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(item, -1)}
                      className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition"
                    >
                      {item.quantity === 1 ? (
                        <FiTrash2 className="w-4 h-4 text-red-500" />
                      ) : (
                        <FiMinus className="w-4 h-4" />
                      )}
                    </button>

                    <span className="w-8 text-center font-bold text-[#1a1a1a] text-sm">
                      {item.quantity}
                    </span>

                    <button
                      onClick={() => onUpdateQuantity(item, 1)}
                      className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center hover:bg-slate-100 transition disabled:opacity-40"
                    >
                      <FiPlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ناحیه قیمت — هماهنگ با ProductPrice */}
              <div className="flex flex-col items-end justify-between min-w-[110px]">
                <button
                  onClick={() => onRemoveItem(item)}
                  className="md:hidden p-1 text-slate-400 hover:text-red-500 transition"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>

                <div className="text-left">
                  {/* قیمت خط‌خورده */}
                  {hasDiscount && (
                    <div className="text-[10px] md:text-xs text-slate-400 line-through decoration-red-300 mb-0.5">
                      {formatPriceWithCurrency(item.itemTotalBeforeDiscount)}
                    </div>
                  )}

                  {/* قیمت نهایی — استایل مشابه ProductPrice */}
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="text-base md:text-lg font-bold text-[#1a1a1a] tracking-tight">
                      {new Intl.NumberFormat('fa-IR').format(item.itemFinalPrice)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">تومان</span>
                  </div>

                  {item.quantity > 1 && (
                    <div className="text-[10px] text-slate-500 text-left mt-0.5">
                      هر عدد{' '}
                      <span className="font-semibold text-slate-600">
                        {new Intl.NumberFormat('fa-IR').format(item.unitPriceToman)}
                      </span>{' '}
                      ت
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onRemoveItem(item)}
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
