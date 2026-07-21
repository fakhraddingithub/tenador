'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import CategoryGrid from '@/components/templates/productMatch/CategoryGrid';

export default function MatchPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/compare/categories');
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (mounted) {
          // فقط دسته‌هایی که حداقل ۲ شاخص فنی دارند قابل تطبیق‌اند
          setCategories(
            (data.categories || []).filter((c) => (c.technicalStats?.length || 0) >= 2)
          );
        }
      } catch (err) {
        console.error('Error fetching match categories:', err);
        if (mounted) toast.error('خطا در دریافت دسته‌بندی‌ها');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-background)] font-sans text-[var(--color-text)]">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="text-center mb-10 space-y-3">
          <h1 className="text-4xl font-bold text-[var(--color-primary)]">محصولی را پیدا کنید که مناسب شماست</h1>
          <p className="text-neutral-500 max-w-2xl mx-auto leading-7">
            دسته‌بندی مورد نظرتان را انتخاب کنید، محصول فعلی خود را مشخص کنید و با تنظیم شاخص‌های
            فنی، نزدیک‌ترین محصولات به سلیقه خودتان را به‌صورت زنده پیدا کنید.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categories.length > 0 ? (
          <CategoryGrid categories={categories} />
        ) : (
          <div className="text-center py-16 text-neutral-500">
            در حال حاضر دسته‌بندی‌ای با شاخص‌های فنی کافی وجود ندارد.
          </div>
        )}
      </div>
    </div>
  );
}
