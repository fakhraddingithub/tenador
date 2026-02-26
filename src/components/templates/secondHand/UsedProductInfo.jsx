"use client";

import Link from "next/link";
import { FiShield, FiTag } from "react-icons/fi";
import ProductHeader from "@/components/templates/product/ProductHeader";

const SCORE_STYLE = (s) => {
  if (s == null) return { color: "text-gray-400", bg: "bg-gray-50 border-gray-100" };
  if (s >= 8)    return { color: "text-green-600", bg: "bg-green-50 border-green-100" };
  if (s >= 5)    return { color: "text-amber-600", bg: "bg-amber-50 border-amber-100" };
  return               { color: "text-red-500",   bg: "bg-red-50 border-red-100"     };
};

const UsedProductInfo = ({ product }) => {
  const { name, price, description, overallScore, status, baseProduct } = product;
  const scoreStyle = SCORE_STYLE(overallScore);

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

      {/* نام محصول دست‌دوم + شرت دیسکریپشن از بیس پروداکت */}
      <ProductHeader
        name={name}
        shortDescription={baseProduct.shortDescription}
      />

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

      {/* توضیحات خود محصول دست‌دوم — جایگزین واریانت */}
      {description && (
        <div className="bg-gray-50/80 border border-gray-100 p-4 rounded-lg text-sm text-gray-600 leading-7 whitespace-pre-line">
          {description}
        </div>
      )}

      {/* وضعیت */}
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
          status === "available" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
        }`}>
          {status === "available" ? "موجود" : "فروخته شده"}
        </span>
        <span className="flex items-center gap-1 text-xs font-bold text-[var(--color-primary)]">
          <FiTag size={11} /> دست‌دوم
        </span>
      </div>

      {/* قیمت */}
      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs text-gray-400 font-bold mb-1">قیمت</p>
        <p className="text-3xl font-black text-[var(--color-primary)]">
          {Number(price).toLocaleString()}
          <small className="text-sm font-normal text-gray-400 mr-1">تومان</small>
        </p>
      </div>

    </div>
  );
};

export default UsedProductInfo;