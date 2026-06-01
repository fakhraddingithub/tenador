"use client";

import { useEffect, useState } from "react";
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
} from "react-icons/fa";

export default function CategoryProductsClient({ categoryId }) {
  const router = useRouter();

  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const categoryProducts = products.filter(
    (p) => p.category?._id === categoryId,
  );

  const handleDelete = async () => {
    if (!category) return;

    const confirmed = await confirmDelete(
      "حذف دسته‌بندی",
      `آیا مطمئن هستید که می‌خواهید "${category.title}" را حذف کنید؟ تمام محصولات این دسته بدون دسته‌بندی خواهند ماند.`,
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error();

      showToast.success("دسته‌بندی با موفقیت حذف شد");
      router.push("/p-admin/admin-categories");
    } catch {
      showError("خطا", "خطا در حذف دسته‌بندی");
    }
  };

  if (!category && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white rounded-[var(--radius)] shadow-sm border border-dashed">
        <FaInfoCircle size={48} className="text-gray-300 mb-4" />
        <p className="text-gray-500 font-bold">دسته‌بندی مورد نظر یافت نشد</p>
        <Link
          href="/p-admin/admin-categories"
          className="text-[var(--color-primary)] mt-2 underline"
        >
          بازگشت به لیست دسته‌ها
        </Link>
      </div>
    );
  }
  const handleDeleteProduct = async (product) => {
    const confirmed = await confirmDelete(
      "حذف محصول",
      `آیا مطمئن هستید که می‌خواهید "${product.name}" را حذف کنید؟`,
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/product/${product._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast.success("محصول با موفقیت حذف شد");
        fetchProducts();
      } else {
        const data = await res.json();
        showError("خطا", data.error || "خطا در حذف محصول");
      }
    } catch (error) {
      showError("خطا", "خطا در حذف محصول");
    }
  };
  return (
    <div className="min-h-screen bg-[#fcfcfc] pb-20">
      {/* Header & Category Info Section */}
      <div className="bg-white border-b border-gray-100 shadow-sm rounded-b-[2rem] mb-8">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <Link
                href="/p-admin/admin-categories"
                className="flex items-center gap-2 text-[var(--color-primary)] text-sm font-bold group"
              >
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />{" "}
                بازگشت به دسته‌بندی‌ها
              </Link>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-[var(--color-primary)]">
                  <FaLayerGroup size={28} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-[var(--color-text)] tracking-tight">
                    {category?.title}
                  </h1>
                  <p className="text-gray-400 text-sm font-medium flex items-center gap-2">
                    <FaTags className="text-[var(--color-secondary)]" /> مدیریت
                    محصولات این مجموعه
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() =>
                  router.push(
                    `/p-admin/admin-categories/category-products/${categoryId}/add-product`,
                  )
                }
                className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-[var(--radius)] font-bold flex items-center gap-2 shadow-lg shadow-green-100 transition-all active:scale-95"
              >
                <FaPlus /> افزودن محصول
              </button>

              <button
                onClick={() =>
                  router.push(`/p-admin/admin-categories/edit/${categoryId}`)
                }
                className="bg-white border border-gray-200 text-blue-600 px-5 py-2.5 rounded-[var(--radius)] font-bold flex items-center gap-2 hover:bg-blue-50 transition-all active:scale-95"
              >
                <FaEdit /> ویرایش دسته
              </button>

              <button
                onClick={handleDelete}
                className="bg-white border border-red-100 text-red-500 px-5 py-2.5 rounded-[var(--radius)] font-bold flex items-center gap-2 hover:bg-red-50 transition-all active:scale-95"
              >
                <FaTrash /> حذف دسته
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-8 flex gap-8 border-t border-gray-50 pt-6">
            <div className="flex items-center gap-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                تعداد کل محصولات
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)]">
                {categoryProducts.length}
              </div>
            </div>
            <div className="w-[1px] bg-gray-100"></div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-80 bg-gray-100 animate-pulse rounded-[var(--radius)]"
              ></div>
            ))}
          </div>
        ) : categoryProducts.length === 0 ? (
          <div className="bg-white p-20 text-center rounded-[var(--radius)] border-2 border-dashed border-gray-100 animate-fadeIn">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FaBox size={32} className="text-gray-200" />
            </div>
            <h3 className="text-gray-600 font-bold text-xl mb-2">
              قفسه این دسته خالی است!
            </h3>
            <p className="text-gray-400 mb-6">
              هنوز هیچ محصولی برای دسته‌بندی {category?.title} ثبت نکرده‌اید.
            </p>
            <button
              onClick={() =>
                router.push(
                  `/p-admin/admin-categories/category-products/${categoryId}/add-product`,
                )
              }
              className="text-[var(--color-primary)] font-bold hover:underline"
            >
              همین حالا اولین محصول را اضافه کنید
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-8 animate-fadeIn">
            {categoryProducts.map((product) => (
              <div
                key={product._id}
                className="transform transition-all duration-300 hover:-translate-y-2"
              >
                <ProductCard
                  product={product}
                  onDelete={handleDeleteProduct}
                  onEdit={() =>
                    router.push(`/p-admin/admin-products/edit/${product._id}`)
                  }
                  onViewVariants={() =>
                    router.push(
                      `/p-admin/admin-products/${product._id}/variants`,
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
