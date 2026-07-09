"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "@/components/admin";
import { showToast } from "@/lib/toast";
import { confirmDelete, showError } from "@/lib/swal";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaArrowRight,
  FaBox,
  FaLayerGroup,
  FaTags,
  FaInfoCircle,
  FaFilter,
  FaTimes,
} from "react-icons/fa";

export default function CategoryProductsClient({ categoryId }) {
  const router = useRouter();

  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // فیلترها
  const [brandFilter, setBrandFilter] = useState("all");
  const [serieFilter, setSerieFilter] = useState("all");

  useEffect(() => {
    fetchCategory();
    fetchProducts();
  }, [categoryId]);

  const fetchCategory = async () => {
    try {
      const res = await fetch(`/api/categories/${categoryId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCategory(data.category);
    } catch {
      showToast.error("خطا در بارگذاری دسته‌بندی");
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/product?isAdmin=true");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      showToast.error("خطا در بارگذاری محصولات");
    } finally {
      setLoading(false);
    }
  };

  const categoryProducts = useMemo(
    () => products.filter((p) => p.category?._id === categoryId),
    [products, categoryId]
  );

  // برندهای موجود در این دسته
  const availableBrands = useMemo(() => {
    const map = new Map();
    categoryProducts.forEach((p) => {
      if (p.brand?._id) map.set(p.brand._id, p.brand);
    });
    return Array.from(map.values());
  }, [categoryProducts]);

  // سری‌های موجود در محصولاتی که با برند انتخاب‌شده تطبیق دارند
  const availableSeries = useMemo(() => {
    const map = new Map();
    categoryProducts
      .filter((p) =>
        brandFilter === "all" ? true : p.brand?._id === brandFilter
      )
      .forEach((p) => {
        if (p.serie?._id) map.set(p.serie._id, p.serie);
      });
    return Array.from(map.values());
  }, [categoryProducts, brandFilter]);

  // اگر برند عوض شد و سری قدیم دیگر معتبر نیست → ریست
  useEffect(() => {
    if (serieFilter !== "all" && !availableSeries.find((s) => s._id === serieFilter)) {
      setSerieFilter("all");
    }
  }, [availableSeries, serieFilter]);

  const filteredProducts = useMemo(() => {
    return categoryProducts.filter((p) => {
      if (brandFilter !== "all" && p.brand?._id !== brandFilter) return false;
      if (serieFilter !== "all" && p.serie?._id !== serieFilter) return false;
      return true;
    });
  }, [categoryProducts, brandFilter, serieFilter]);

  const hasActiveFilter = brandFilter !== "all" || serieFilter !== "all";

  const handleDelete = async () => {
    if (!category) return;
    const confirmed = await confirmDelete(
      "حذف دسته‌بندی",
      `آیا مطمئن هستید که می‌خواهید "${category.title}" را حذف کنید؟ تمام محصولات این دسته بدون دسته‌بندی خواهند ماند.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/categories/${categoryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast.success("دسته‌بندی با موفقیت حذف شد");
      router.push("/p-admin/admin-categories");
    } catch {
      showError("خطا", "خطا در حذف دسته‌بندی");
    }
  };

  const handleDeleteProduct = async (product) => {
    const confirmed = await confirmDelete(
      "حذف محصول",
      `آیا مطمئن هستید که می‌خواهید "${product.name}" را حذف کنید؟`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/product/${product._id}`, { method: "DELETE" });
      if (res.ok) {
        showToast.success("محصول با موفقیت حذف شد");
        fetchProducts();
      } else {
        const data = await res.json();
        showError("خطا", data.error || "خطا در حذف محصول");
      }
    } catch {
      showError("خطا", "خطا در حذف محصول");
    }
  };

  if (!category && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-200">
        <FaInfoCircle size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-bold text-sm">دسته‌بندی مورد نظر یافت نشد</p>
        <Link
          href="/p-admin/admin-categories"
          className="text-[var(--color-primary)] mt-2 underline text-sm font-bold"
        >
          بازگشت به لیست دسته‌ها
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/p-admin/admin-categories"
            className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 hover:gap-2.5 transition-all"
            style={{ color: "var(--color-primary)" }}
          >
            <FaArrowRight size={11} /> بازگشت به دسته‌بندی‌ها
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-[var(--radius)] flex items-center justify-center text-white"
              style={{ background: "var(--color-primary)" }}
            >
              <FaLayerGroup size={16} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{category?.title}</h1>
              <p className="text-xs font-bold text-gray-400 mt-0.5 flex items-center gap-1.5">
                <FaTags style={{ color: "var(--color-secondary)" }} size={10} />
                مدیریت محصولات این مجموعه
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              router.push(
                `/p-admin/admin-categories/category-products/${categoryId}/add-product`
              )
            }
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: "var(--color-primary)" }}
          >
            <FaPlus size={12} /> افزودن محصول
          </button>

          <button
            onClick={() => router.push(`/p-admin/admin-categories/edit/${categoryId}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-all"
          >
            <FaEdit size={12} /> ویرایش دسته
          </button>

          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 transition-all"
          >
            <FaTrash size={12} /> حذف دسته
          </button>
        </div>
      </div>

      {/* Filters + stats */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 shrink-0">
          <FaFilter style={{ color: "var(--color-primary)" }} />
          فیلتر بر اساس:
        </div>

        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <FilterSelect
            label="برند"
            value={brandFilter}
            onChange={(v) => setBrandFilter(v)}
            options={[
              { value: "all", label: "همه برندها" },
              ...availableBrands.map((b) => ({ value: b._id, label: b.title || b.name })),
            ]}
          />

          <FilterSelect
            label="سری"
            value={serieFilter}
            onChange={(v) => setSerieFilter(v)}
            disabled={availableSeries.length === 0}
            options={[
              { value: "all", label: "همه سری‌ها" },
              ...availableSeries.map((s) => ({ value: s._id, label: s.title || s.name })),
            ]}
          />
        </div>

        {hasActiveFilter && (
          <button
            onClick={() => {
              setBrandFilter("all");
              setSerieFilter("all");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius)] text-xs font-bold text-gray-500 bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all"
          >
            <FaTimes size={10} /> پاک کردن
          </button>
        )}

        <div className="flex items-center gap-2 pr-3 lg:border-r border-gray-100 text-xs font-bold text-gray-500 shrink-0">
          <span>نمایش</span>
          <span className="text-sm font-bold text-gray-900">{filteredProducts.length}</span>
          <span>از</span>
          <span className="text-sm font-bold text-gray-900">{categoryProducts.length}</span>
          <span>محصول</span>
        </div>
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
            <FaBox size={22} />
          </div>
          <h3 className="text-gray-700 font-bold text-sm mb-1">
            {hasActiveFilter
              ? "محصولی با این فیلتر یافت نشد"
              : "قفسه این دسته خالی است"}
          </h3>
          <p className="text-gray-400 text-xs mb-4">
            {hasActiveFilter
              ? "فیلترها را تغییر داده یا پاک کنید."
              : `هنوز هیچ محصولی برای دسته‌بندی ${category?.title} ثبت نکرده‌اید.`}
          </p>
          {!hasActiveFilter && (
            <button
              onClick={() =>
                router.push(
                  `/p-admin/admin-categories/category-products/${categoryId}/add-product`
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:-translate-y-0.5 transition-all"
              style={{ background: "var(--color-primary)" }}
            >
              <FaPlus size={12} /> افزودن اولین محصول
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onDelete={handleDeleteProduct}
              onEdit={() => router.push(`/p-admin/admin-products/edit/${product._id}`)}
              onViewVariants={() =>
                router.push(`/p-admin/admin-products/${product._id}/variants`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, disabled = false }) {
  return (
    <label
      className={`flex-1 flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-[var(--radius)] px-3 py-2 focus-within:border-[var(--color-primary)] transition-all ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 shrink-0">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 bg-transparent text-sm font-bold text-gray-800 focus:outline-none cursor-pointer disabled:cursor-not-allowed"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
