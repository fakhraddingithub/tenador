'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiEdit2, FiArrowRight } from 'react-icons/fi';
import ProductSearchBox from '@/components/templates/productMatch/ProductSearchBox';
import AttributeSlider from '@/components/templates/productMatch/AttributeSlider';
import MatchResultCard, {
  BilingualName,
  PriceTag,
} from '@/components/templates/productMatch/MatchResultCard';
import { findClosestProducts } from '@/components/templates/productMatch/matchEngine';
import BestInCategorySection from '@/components/templates/productMatch/BestInCategorySection';
import AttributeGuideSection from '@/components/templates/productMatch/AttributeGuideSection';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// مقدار اولیه هر اسلایدر = مقدار خود محصول پایه (نه وسط بازه)
function buildTarget(baseProduct, categoryStats) {
  const target = {};
  for (const s of categoryStats) {
    const v = baseProduct.technicalStats?.[s.name];
    target[s.name] = Number.isFinite(v) ? clamp(v, s.min, s.max) : Math.round((s.min + s.max) / 2);
  }
  return target;
}

export default function MatchCategoryPage() {
  const { categorySlug } = useParams();

  const [category, setCategory] = useState(null);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [baseProduct, setBaseProduct] = useState(null);
  const [target, setTarget] = useState(null);
  const [products, setProducts] = useState(null); // null = هنوز واکشی نشده
  const productsLoading = Boolean(baseProduct) && products === null;

  // پیدا کردن دسته‌بندی از روی اسلاگ (بدون endpoint جدید)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/compare/categories');
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (mounted) {
          const slug = decodeURIComponent(categorySlug);
          setCategory((data.categories || []).find((c) => c.slug === slug) || null);
        }
      } catch (err) {
        console.error('Error fetching category:', err);
        if (mounted) toast.error('خطا در دریافت اطلاعات دسته‌بندی');
      } finally {
        if (mounted) setCategoryLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [categorySlug]);

  // واکشی محصولات دسته — فقط یک بار، بعد از انتخاب محصول پایه
  useEffect(() => {
    if (!baseProduct || !category || products !== null) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/match/products?categoryId=${category._id}`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (mounted) setProducts(data.products || []);
      } catch (err) {
        console.error('Error fetching match products:', err);
        if (mounted) {
          toast.error('خطا در دریافت محصولات دسته‌بندی');
          setProducts([]);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [baseProduct, category, products]);

  const handleSelectBase = (product) => {
    setBaseProduct(product);
    setTarget(buildTarget(product, category.technicalStats));
  };

  // قیمت تومانی محصول پایه — از لیست واکشی‌شده (API جستجو قیمت تبدیل‌شده ندارد)
  const basePriceToman = products?.find(
    (p) => String(p._id) === String(baseProduct?._id)
  )?.priceToman;

  // محاسبه زنده نزدیک‌ترین محصولات — کاملا سمت کلاینت، بدون درخواست شبکه
  const matches = useMemo(() => {
    if (!target || !products || !baseProduct || !category) return [];
    return findClosestProducts({
      targetStats: target,
      candidateProducts: products,
      categoryStats: category.technicalStats,
      excludeId: baseProduct._id,
    });
  }, [target, products, baseProduct, category]);

  if (categoryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold text-neutral-700">دسته‌بندی مورد نظر یافت نشد</h1>
        <Link
          href="/match"
          className="flex items-center gap-2 text-white bg-[var(--color-primary)] px-6 py-3 rounded-[var(--radius)] font-bold hover:opacity-90 transition"
        >
          بازگشت به دسته‌بندی‌ها
          <FiArrowRight />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] font-sans text-[var(--color-text)]">
      <div className="max-w-7xl mx-auto px-4 py-10 pb-20">
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-primary)]">
          {category.title} خود را ارتقا دهید: ارتقایی را پیدا کنید که مناسب بازی شما باشد
          </h1>
          {!baseProduct && (
            <p className="text-neutral-500">
              محصول فعلی خود را جستجو کنید تا نزدیک‌ترین گزینه‌ها را بر اساس شاخص‌های فنی پیدا کنیم.
            </p>
          )}
        </div>

        {!baseProduct ? (
          <div className="max-w-3xl mx-auto">
            <ProductSearchBox
              categoryId={category._id}
              categoryTitle={category.title}
              onSelect={handleSelectBase}
            />
          </div>
        ) : (
          <>
            {/* نوار خلاصه محصول پایه — یک ردیف افقی فشرده */}
            <div className="mb-8 bg-white border border-neutral-100 shadow-sm rounded-[var(--radius)] p-3 flex items-center gap-4 flex-wrap md:flex-nowrap">
              <Link
                href={`/products/${baseProduct.slug || baseProduct._id}`}
                className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-50 border border-neutral-100 shrink-0"
              >
                <img
                  src={baseProduct.mainImage || '/placeholder.png'}
                  alt={baseProduct.name}
                  className="w-full h-full object-contain p-1 hover:opacity-90 transition-opacity"
                />
              </Link>

              <Link
                href={`/products/${baseProduct.slug || baseProduct._id}`}
                className="hover:text-[var(--color-primary)] transition-colors min-w-0 shrink-0 max-w-[240px]"
              >
                <BilingualName
                  name={baseProduct.name}
                  centered={false}
                  className="font-bold text-sm text-neutral-800"
                />
                <PriceTag priceToman={basePriceToman} className="text-xs mt-0.5" />
              </Link>

              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                {category.technicalStats.map((stat) => {
                  const v = baseProduct.technicalStats?.[stat.name];
                  return (
                    <span
                      key={stat.name}
                      className="bg-neutral-100 text-neutral-700 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                    >
                      {stat.label} {Number.isFinite(v) ? Number(v).toLocaleString('fa-IR') : '—'}
                    </span>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setBaseProduct(null);
                  setTarget(null);
                }}
                className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 px-3 py-2 rounded-[var(--radius)] transition-colors shrink-0 mr-auto"
              >
                <FiEdit2 size={12} />
                تغییر محصول
              </button>
            </div>

            {/* سایدبار اسلایدرها سمت راست (فرزند اول گرید در RTL) + نتایج در بخش اصلی */}
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
              <aside className="bg-white border border-neutral-100 rounded-[var(--radius)] shadow-sm p-5 lg:sticky lg:top-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-neutral-800">شاخص‌های فنی</h2>
                  <button
                    onClick={() => setTarget(buildTarget(baseProduct, category.technicalStats))}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 px-2.5 py-1.5 rounded-[var(--radius)] transition-colors"
                  >
                    <FiRefreshCw size={12} />
                    بازنشانی به محصول پایه
                  </button>
                </div>
                <div className="divide-y divide-neutral-100">
                  {category.technicalStats.map((stat) => (
                    <AttributeSlider
                      key={stat.name}
                      stat={stat}
                      value={target[stat.name]}
                      onChange={(name, value) =>
                        setTarget((prev) => ({ ...prev, [name]: value }))
                      }
                    />
                  ))}
                </div>
              </aside>

              <main>
                {productsLoading ? (
                  <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : matches.length > 0 ? (
                  <>
                    {matches.length < 3 && (
                      <p className="mb-4 text-sm text-neutral-500 bg-neutral-50 border border-neutral-100 rounded-[var(--radius)] px-4 py-3">
                        هنوز محصولات مشابه کافی در این دسته‌بندی وجود ندارد.
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {matches.map(({ product, diffs }) => (
                        <MatchResultCard
                          key={product._id}
                          product={product}
                          diffs={diffs}
                          target={target}
                          categoryStats={category.technicalStats}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  products !== null && (
                    <div className="text-center py-20 text-neutral-500">
                      هنوز محصولات مشابه کافی در این دسته‌بندی وجود ندارد.
                    </div>
                  )
                )}
              </main>
            </div>
          </>
        )}

        {/* بخش‌های پایینی — مستقل از انتخاب محصول پایه، مثل صفحه مقایسه */}
        <BestInCategorySection categoryId={category._id} onSelectProduct={handleSelectBase} />
        <AttributeGuideSection category={category} />
      </div>
    </div>
  );
}
