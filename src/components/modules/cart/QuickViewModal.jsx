import React, { useState } from "react";
import Image from "next/image";
import { FaTimes, FaShoppingCart, FaHeart, FaRegHeart, FaPlus, FaMinus } from "react-icons/fa";

export default function QuickViewModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onToggleWishlist,
  isWishlisted
}) {
  const [selectedImage, setSelectedImage] = useState(product?.mainImage);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState({}); 

  if (!isOpen || !product) return null;

  const allImages = [product.mainImage, ...(product.gallery || [])];
  console.log(product);


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
      {/* Overlay شیشه‌ای تیره */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Container اصلی مودال */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-[6px] shadow-2xl overflow-hidden flex flex-col md:flex-row text-right">

        {/* دکمه بستن (سمت چپ بالا در RTL) */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-[6px] bg-gray-100/80 hover:bg-red-500 hover:text-white transition-all backdrop-blur-md border border-white/20"
        >
          <FaTimes size={18} />
        </button>

        {/* بخش راست: گالری تصاویر (Visuals) */}
        <div className="w-full md:w-[45%] p-6 flex flex-col gap-4 bg-[#fcfcfc] border-l border-gray-100">
          <div className="relative aspect-square w-full rounded-[6px] overflow-hidden bg-white border border-gray-100 group">
            <Image
              src={selectedImage || product.mainImage}
              alt={product.name}
              fill
              className="object-contain p-6 transition-transform duration-500 group-hover:scale-110"
            />
          </div>

          {/* تصاویر بندانگشتی (Thumbnails) */}
          <div className="flex gap-3 overflow-x-auto py-2 custom-scrollbar">
            {allImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(img)}
                className={`relative w-20 h-20 flex-shrink-0 rounded-[6px] border-2 transition-all overflow-hidden bg-white ${(selectedImage === img || (!selectedImage && idx === 0))
                    ? "border-[#aa4725] shadow-md"
                    : "border-transparent opacity-60 hover:opacity-100"
                  }`}
              >
                <Image src={img} alt={`thumb-${idx}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* بخش چپ: اطلاعات و انتخاب ویژگی‌ها (Content) */}
        <div className="w-full md:w-[55%] p-8 flex flex-col overflow-y-auto">
          {/* برند و عنوان */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] bg-[#aa4725] text-white px-3 py-1 rounded-[4px] font-bold tracking-wider uppercase">
                {product.brand?.name}
              </span>
              <span className="text-[11px] text-gray-400 font-medium">کد کالا: {product.sku}</span>
            </div>
            <h2 className="text-2xl font-bold text-[#1a1a1a] leading-tight mb-4">
              {product.name}
            </h2>

            {/* توضیحات کوتاه شیشه‌ای */}
            <div className="bg-gray-50/80 border border-gray-100 p-4 rounded-[6px] text-sm text-gray-600 leading-7">
              <div
                className="line-clamp-4 overflow-y-auto max-h-32"
                dangerouslySetInnerHTML={{ __html: product.shortDescription || product.longDescription }}
              />
            </div>
          </div>

          {/* بخش انتخاب تنوع محصول (بر اساس ویژگی‌های Select کاتگوری) */}
          <div className="flex flex-col gap-6 mb-8">
            {product.category?.attributes
              ?.filter((catAttr) => catAttr.type === "select") // فقط اتریبیوت‌های سلکتی کاتگوری
              .map((attr) => {
                const productAttrValue = product.attributes[attr.name];

                if (!productAttrValue) return null;
                
                const options = productAttrValue

                return (
                  <div key={attr.name} className="flex flex-col gap-3">
                    <h4 className="text-[14px] font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-1 h-4 bg-[#aa4725] rounded-full"></span>
                      {attr.label || attr.name} {/* نمایش عنوان فارسی اتریبیوت */}
                    </h4>

                    <div className="flex flex-wrap gap-2">
                      {options.map((val, index) => {
                        const isActive = selected[attr.name] === val;

                        return (
                          <button
                            key={index}
                            onClick={() => setSelected((prev) => ({ ...prev, [attr.name]: val }))}
                            className={`
                    min-w-[60px] px-4 h-11 rounded-[6px] text-xs font-bold transition-all duration-300
                    border flex items-center justify-center gap-2
                    ${isActive
                                ? "bg-[#aa4725] text-white border-[#aa4725] shadow-lg shadow-[#aa4725]/30 scale-[1.05]"
                                : "bg-white/40 backdrop-blur-md border-gray-200 text-gray-500 hover:border-[#aa4725]/40 hover:bg-white/60"
                              }
                  `}
                          >
                            {isActive && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>}
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* قیمت و عملیات خرید - بخش ثابت پایین */}
          <div className="mt-auto pt-6 border-t border-gray-100 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400 font-bold">قیمت نهایی:</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-[#aa4725]">
                    {product.basePrice?.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-[#aa4725]">تومان</span>
                </div>
              </div>

              {/* کنترل تعداد */}
              <div className="flex items-center bg-gray-100 rounded-[6px] p-1 border border-gray-200">
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-[4px] shadow-sm hover:text-[#aa4725] transition-all"
                >
                  <FaPlus size={12} />
                </button>
                <span className="px-5 font-bold text-lg text-[#1a1a1a]">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-[4px] shadow-sm hover:text-red-500 transition-all"
                >
                  <FaMinus size={12} />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => onAddToCart(product, quantity, selectedGrip)}
                className="flex-[5] h-14 bg-[#aa4725] text-white rounded-[6px] font-bold text-lg flex items-center justify-center gap-3 hover:bg-[#8e3b1e] transition-all shadow-xl shadow-[#aa4725]/20 active:scale-95"
              >
                <FaShoppingCart size={20} />
                افزودن به سبد خرید
              </button>

              <button
                onClick={onToggleWishlist}
                className={`flex-1 h-14 flex items-center justify-center rounded-[6px] border-2 transition-all ${isWishlisted
                    ? "bg-red-50 border-red-100 text-red-500"
                    : "bg-white border-gray-100 text-gray-300 hover:border-red-100 hover:text-red-400"
                  }`}
              >
                {isWishlisted ? <FaHeart size={24} /> : <FaRegHeart size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}