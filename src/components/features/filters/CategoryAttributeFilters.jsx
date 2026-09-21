"use client";

import { useId } from "react";
import AttributeFilters from "@/components/features/filters/AttributeFilters";

export default function CategoryAttributeFilters({ categories = [], categoryId = "", fixedCategory = false, attributes = {}, onCategoryChange, onAttributesChange }) {
  const id = useId();
  const category = categories.find((c) => String(c._id) === String(categoryId));
  return (
    <div className="bg-white rounded-[6px] border border-gray-100 shadow-sm overflow-hidden">
      {!fixedCategory && (
        <div className="p-5 border-b border-gray-50">
          <label htmlFor={id} className="block text-sm font-bold mb-3">نوع محصول</label>
          <select id={id} value={categoryId || ""} onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full min-h-11 rounded border border-gray-200 bg-white px-3 text-sm">
            <option value="">همه دسته‌بندی‌ها</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
          {!category && <p className="text-xs text-gray-500 mt-3">برای فیلتر ویژگی‌ها، نوع محصول را انتخاب کنید.</p>}
        </div>
      )}
      <AttributeFilters attrMeta={category?.attributeMeta || []} attrFilters={attributes} setAttrFilters={onAttributesChange} />
    </div>
  );
}
