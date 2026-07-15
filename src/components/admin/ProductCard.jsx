'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FaEdit, FaTrash, FaImage } from 'react-icons/fa';

/**
 * کارت محصول (پنل ادمین) — نسخهٔ فاز ۱
 * دقیقاً هم‌فرم کارت محصولِ سایت (components/modules/cart/ProductCard.js) با تفاوت‌ها:
 *   • قیمت به یورو (به‌جای تومان)
 *   • دو دکمهٔ ویرایش/حذف به‌جای اکشن‌های سبد/علاقه‌مندی و بدون دکمهٔ واریانت‌ها
 *   • نام دو خطی: خط بالا فارسی، خط پایین انگلیسی (splitName مانند کارت سایت)
 *   • روی کارت: دسته‌بندی و ورزش (به‌جای برند)
 * توکن‌ها از admin-scope (پریمری = سبز درباری، رادیوس = ۶ پیکسل)
 */
export default function ProductCard({ product, onEdit, onDelete }) {
  const { mainImage, name, slug, category, sport, brand, basePrice } = product;

  const splitName = (text = '') => {
    const match = text.match(/[a-zA-Z(].*/);
    if (match) {
      return {
        farsi: text.substring(0, match.index).trim(),
        english: match[0].trim(),
      };
    }
    return { farsi: text, english: '' };
  };
  const { farsi, english } = splitName(name || '');

  const priceEur = Number(basePrice || 0);
  const formattedEur = priceEur.toLocaleString('en-US', {
    minimumFractionDigits: priceEur % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      className="group relative bg-white flex flex-col h-full overflow-hidden transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,66,37,0.08)] hover:-translate-y-1"
      style={{
        border: '1px solid var(--admin-border)',
        borderRadius: 'var(--admin-radius)',
      }}
    >
      {/* لینک سراسری کارت → صفحهٔ محصول در سایت (مثل کارت محصولِ سایت) */}
      {slug && <Link href={`/products/${slug}`} className="absolute inset-0 z-10" />}

      {/* بج برند (سمت چپ‌بالا) — اختیاری */}
      {brand?.icon && (
        <div className="absolute top-3 left-3 z-20">
          <Image src={brand.icon} alt="brand" width={30} height={30} className="object-contain" />
        </div>
      )}

      {/* تصویر مربعی (contain، پس‌زمینهٔ روشن — مثل کارت سایت) */}
      <div
        className="relative w-full aspect-square overflow-hidden"
        style={{ background: '#fcfcfc' }}
      >
        {mainImage ? (
          <Image
            src={mainImage}
            alt={name || 'product'}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-3 transition-all duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: 'var(--admin-border-strong)' }}>
            <FaImage size={32} />
            <span className="text-xs font-bold">بدون تصویر</span>
          </div>
        )}
      </div>

      {/* نوار متاداده — دسته‌بندی و ورزش (جایگزین سوآچ‌های واریانتِ کارت سایت) */}
      <div
        className="flex items-center justify-between px-4 h-[40px] text-[11px] font-bold border-t"
        style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text-muted)' }}
      >
        <span className="truncate max-w-[45%]" title={category?.title || '-'}>
          {category?.title || 'بدون دسته'}
        </span>
        <span
          className="truncate max-w-[45%] text-left"
          title={sport?.name || '-'}
          style={{ color: 'var(--color-primary)' }}
        >
          {sport?.name || 'بدون ورزش'}
        </span>
      </div>

      {/* محتوا — نام دو خطی + قیمت یورو + اکشن‌ها */}
      <div className="p-4 pt-3 flex flex-col items-center text-center flex-1">
        <div className="mb-4 h-[60px] flex flex-col justify-start w-full">
          <h3
            className="text-[14px] font-bold leading-6 mb-1 line-clamp-1"
            style={{ color: 'var(--admin-text)' }}
          >
            {farsi || '—'}
          </h3>
          <p
            dir="ltr"
            className="text-[12px] font-medium leading-4 line-clamp-1"
            style={{ color: 'var(--admin-text-muted)' }}
          >
            {english}
          </p>
        </div>

        {/* قیمت یورو */}
        <div className="mt-auto flex flex-col items-center mb-4" dir="ltr">
          <span
            className="text-[20px] font-black leading-none"
            style={{ color: 'var(--color-primary)' }}
          >
            € {formattedEur}
          </span>
        </div>

        {/* اکشن‌ها — ویرایش (پُر) + حذف (آیکون) */}
        <div className="relative z-20 flex gap-2 w-full">
          <button
            onClick={() => onEdit?.(product)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-all active:scale-95"
            style={{
              borderRadius: 'var(--admin-radius)',
              background: 'var(--color-primary)',
              color: '#fff',
              border: '1px solid var(--color-primary)',
            }}
          >
            <FaEdit size={12} /> ویرایش
          </button>
          <button
            onClick={() => onDelete?.(product)}
            className="w-10 h-10 inline-flex items-center justify-center transition-all active:scale-95"
            style={{
              borderRadius: 'var(--admin-radius)',
              background: '#fbe9ea',
              color: 'var(--admin-danger)',
              border: '1px solid #f2c8ca',
            }}
            title="حذف"
          >
            <FaTrash size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
