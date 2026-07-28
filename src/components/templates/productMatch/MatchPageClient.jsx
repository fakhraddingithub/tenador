'use client';

import CategoryGrid from '@/components/templates/productMatch/CategoryGrid';

export default function MatchPageClient({ categories }) {
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

        {categories.length > 0 ? (
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
