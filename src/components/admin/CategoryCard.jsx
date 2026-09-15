'use client';

import { getCategoryLabel } from "base/utils/categoryLabel";
import Link from 'next/link';

export default function CategoryCard({ category, productCount }) {
  return (
    <Link href={`/p-admin/admin-categories/category-products/${category._id}`} className="block">
      <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 hover:border-gray-200 transform hover:-translate-y-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{getCategoryLabel(category)}</h3>
          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
            {productCount} محصول
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            <span className="font-medium">اسلاگ:</span> {category.slug}
          </p>
          <p className="text-sm text-gray-500">
            <span className="font-medium">دسته والد:</span> {getCategoryLabel(category.parent) || 'ندارد'}
          </p>
          <p className="text-sm text-gray-500">
            <span className="font-medium">ویژگی‌ها:</span> {category.attributes?.length || 0} عدد
          </p>
        </div>
      </div>
    </Link>
  );
}
