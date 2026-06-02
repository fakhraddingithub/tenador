"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { FiShield, FiTag, FiShoppingCart, FiCheck, FiX } from "react-icons/fi";
import ProductHeader from "@/components/templates/product/ProductHeader";
import { addUsedToCart, removeUsedFromCart, isUsedInCart } from "@/lib/cart";
import { toast } from "react-toastify";

const SCORE_STYLE = (s) => {
  if (s == null) return { color: "text-gray-400", bg: "bg-gray-50 border-gray-100" };
  if (s >= 8)    return { color: "text-green-600", bg: "bg-green-50 border-green-100" };
  if (s >= 5)    return { color: "text-amber-600", bg: "bg-amber-50 border-amber-100" };
  return               { color: "text-red-500",   bg: "bg-red-50 border-red-100" };
};

const UsedProductInfo = ({ product }) => {
  const { _id, name, price, description, overallScore, status, baseProduct, baseVariant } = product;
  const scoreStyle = SCORE_STYLE(overallScore);

  const [inCart, setInCart] = useState(false);

  useEffect(() => {
    setInCart(isUsedInCart(_id));
    const handler = () => setInCart(isUsedInCart(_id));
    window.addEventListener("cartchange", handler);
    window.addEventListener("cart-changed", handler);
    return () => {
      window.removeEventListener("cartchange", handler);
      window.removeEventListener("cart-changed", handler);
    };
  }, [_id]);

  const handleCartToggle = () => {
    if (status !== "available") return;
    if (inCart) {
      removeUsedFromCart(_id);
      toast.info("محصول از سبد خرید حذف شد");
      setInCart(false);
    } else {
      addUsedToCart(_id);
      toast.success("محصول به سبد خرید اضافه شد");
      setInCart(true);
    }
  };

  const isSold     = status === "sold";
  const isReserved = status === "reserved";

  return (
    <div className="flex flex-col h-full justify-between gap-6 relative">

      {/* لوگو برند */}
      {baseProduct.brand?.logo && (
        <Link
          href={`/brands/${baseProduct.brand.slug || baseProduct.brand._id}`}
          className="self-end absolute top-0 left-0"
        >
          <img
            src={baseProduct.brand.logo}
            alt={baseProduct.brand.title}
            className="h-24 w-auto object-contain"
          />
        </Link>
      )}

      {/* نام محصول */}
      <ProductHeader
        name={name}
        shortDescription={baseProduct.shortDescription}
      />

      {/* واریانت تعیین‌شده */}
      {baseVariant && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(baseVariant.attributes || {}).map(([key, value]) => {
            const label =
              baseProduct?.category?.variantAttributes?.find((a) => a.name === key)?.label || key;

            return (
              <div
                key={key}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg text-sm"
              >
                <span className="text-neutral-400 text-xs">{label}:</span>
                <span className="font-bold text-neutral-700">{value}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* امتیاز سلامت کلی */}
      {overallScore != null && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${scoreStyle.bg}`}>
          <FiShield size={20} className={scoreStyle.color} />
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-semibold">کارت سلامت</p>
            <p className={`text-sm font-black ${scoreStyle.color}`}>
              امتیاز {overallScore}/10
            </p>
          </div>
          <div className="w-32 bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${(overallScore / 10) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* توضیحات */}
      {description && (
        <div className="bg-gray-50/80 border border-gray-100 p-4 rounded-lg text-sm text-gray-600 leading-7 whitespace-pre-line">
          {description}
        </div>
      )}

      {/* وضعیت */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
          isSold     ? "bg-red-50 text-red-500" :
          isReserved ? "bg-amber-50 text-amber-600" :
                       "bg-green-50 text-green-600"
        }`}>
          {isSold ? "فروخته شده" : isReserved ? "رزرو شده" : "موجود"}
        </span>
        <span className="flex items-center gap-1 text-xs font-bold text-[var(--color-primary)]">
          <FiTag size={11} /> دست‌دوم
        </span>
      </div>

      {/* قیمت */}
      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs text-gray-400 font-bold mb-1">قیمت</p>
        <p className="text-3xl font-black text-[var(--color-primary)]">
          {Number(price).toLocaleString("fa-IR")}
          <small className="text-sm font-normal text-gray-400 mr-1">تومان</small>
        </p>
      </div>

      {/* دکمه افزودن به سبد */}
      {!isSold && !isReserved && (
        <button
          onClick={handleCartToggle}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[6px] font-bold text-sm transition-all
            ${inCart
              ? "bg-gray-100 border-2 border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
              : "bg-[var(--color-primary)] text-white hover:opacity-90 shadow-lg shadow-[var(--color-primary)]/25"
            }`}
        >
          {inCart ? (
            <>
              <FiCheck size={16} />
              در سبد خرید — کلیک برای حذف
            </>
          ) : (
            <>
              <FiShoppingCart size={16} />
              افزودن به سبد خرید
            </>
          )}
        </button>
      )}

      {isSold && (
        <div className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
          bg-gray-100 text-gray-400 font-bold text-sm cursor-not-allowed">
          <FiX size={16} />
          فروخته شده
        </div>
      )}

      {isReserved && (
        <div className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
          bg-amber-50 text-amber-600 border border-amber-200 font-bold text-sm">
          رزرو شده — در انتظار پرداخت
        </div>
      )}
    </div>
  );
};

export default UsedProductInfo;