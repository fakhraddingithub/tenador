'use client';

import { useState, useEffect } from 'react';

// برترین‌های دسته — همان ظاهر بخش مشابه در صفحه مقایسه، اما کلیک = انتخاب به‌عنوان محصول پایه
export default function BestInCategorySection({ categoryId, onSelectProduct }) {
    const [bests, setBests] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchBests() {
            if (!categoryId) return;
            setLoading(true);
            try {
                const res = await fetch(`/api/compare/best-in-category?categoryId=${categoryId}`);
                const data = await res.json();
                setBests(data.bests || {});
            } catch (err) {
                console.error("خطا در دریافت برترین‌ها", err);
            } finally {
                setLoading(false);
            }
        }
        fetchBests();
    }, [categoryId]);

    if (loading) return <div className="p-10 text-center animate-pulse text-neutral-400">در حال یافتن برترین‌های کل فروشگاه...</div>;
    if (Object.keys(bests).length === 0) return null;

    return (
        <div className="mt-10">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-[var(--color-primary)]">
                <span className="w-2 h-7 bg-[var(--color-secondary)] rounded-full"></span>
                برترین‌های کل دسته‌بندی
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(bests).map(([statName, data]) => (
                    <div
                        key={statName}
                        onClick={() => onSelectProduct(data.product)}
                        className="group cursor-pointer relative bg-white border border-neutral-100 p-4 rounded-[var(--radius)] shadow-sm hover:shadow-xl hover:border-[var(--color-primary)] transition-all duration-300"
                    >
                        {/* امتیاز بزرگ در پس زمینه */}
                        <div className="absolute top-2 left-3 text-3xl font-bold opacity-10 text-[var(--color-primary)] group-hover:opacity-30 transition-opacity">
                            {data.score}
                        </div>

                        <div className="mb-2">
                            <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-tighter bg-[var(--color-primary)]/20 px-2 py-0.5 rounded">
                                بهترین در {data.label}
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-white border border-neutral-50">
                                <img
                                    src={data.product.mainImage || '/placeholder.png'}
                                    alt={data.product.name}
                                    className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform duration-500"
                                />
                            </div>

                            <div className="flex flex-col min-w-0">
                                <h4 className="font-bold text-sm truncate leading-tight text-[var(--color-text)] mb-1">
                                    {data.product.title || data.product.name}
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-[var(--color-primary)] font-bold">
                                        امتیاز: {data.score} از ۱۰۰
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-center w-full py-1 border-t border-dashed border-neutral-100 text-[10px] font-bold text-neutral-400 group-hover:text-[var(--color-primary)] transition-colors">
                            کلیک برای انتخاب به‌عنوان محصول پایه
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
