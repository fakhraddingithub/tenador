"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "@/components/admin";
import SortableGridItem from "@/components/admin/SortableGridItem";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { showToast } from "@/lib/toast";
import { confirmDelete, showError } from "@/lib/swal";
import {
  FaBox,
  FaChevronLeft,
  FaLayerGroup,
  FaArrowsAlt,
} from "react-icons/fa";

export default function SerieProductsClient({ serieId, brandId }) {
  const router = useRouter();

  const [serie, setSerie] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSerie = useCallback(async () => {
    try {
      const res = await fetch(`/api/series/${serieId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSerie(data?.data || data?.serie || data);
    } catch {
      showToast.error("خطا در بارگذاری سری");
    }
  }, [serieId]);

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        isAdmin: "true",
        all: "true",
        serie: serieId,
      });
      const res = await fetch(`/api/product?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      // مرتب‌سازی پایدار بر اساس order — محصولات بدون ترتیب دستی (order=0)
      // همان ترتیب سرور (جدیدترین اول) را حفظ می‌کنند
      setProducts(
        (data.products || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      );
    } catch {
      showToast.error("خطا در بارگذاری محصولات");
    } finally {
      setLoading(false);
    }
  }, [serieId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSerie();
      fetchProducts();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSerie, fetchProducts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = products.findIndex((p) => p._id === active.id);
    const newIndex = products.findIndex((p) => p._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(products, oldIndex, newIndex).map(
      (item, index) => ({ ...item, order: index })
    );
    setProducts(reordered);

    try {
      const res = await fetch("/api/product/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: reordered.map((p) => ({ id: p._id, order: p.order })),
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      showError("خطا", "خطا در ذخیره ترتیب محصولات");
      fetchProducts();
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

  return (
    <div dir="rtl" className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href={`/p-admin/admin-brands/${brandId}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 hover:gap-2.5 transition-all"
            style={{ color: "var(--color-primary)" }}
          >
            <FaChevronLeft size={11} /> بازگشت به برند
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-[var(--radius)] flex items-center justify-center text-white"
              style={{ background: "var(--color-primary)" }}
            >
              <FaLayerGroup size={16} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                محصولات سری {serie?.title || ""}
              </h1>
              <p className="text-xs font-bold text-gray-400 mt-0.5">
                {products.length} محصول — ترتیب این صفحه، ترتیب نمایش محصولات در کل سایت است
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* راهنمای درگ‌اند‌دراپ */}
      {!loading && products.length > 1 && (
        <div className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-[var(--radius)] bg-gray-50 text-gray-500 border border-gray-100">
          <FaArrowsAlt size={12} />
          برای تغییر ترتیب نمایش محصولات در سایت، کارت‌ها را بکشید و جابه‌جا کنید.
        </div>
      )}

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
            <FaBox size={22} />
          </div>
          <h3 className="text-gray-700 font-bold text-sm mb-1">
            محصولی برای این سری ثبت نشده است
          </h3>
          <p className="text-gray-400 text-xs">
            محصولات را از بخش مدیریت محصولات به این سری اختصاص دهید.
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={products.map((p) => p._id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
              {products.map((product) => (
                <SortableGridItem key={product._id} id={product._id}>
                  <ProductCard
                    product={product}
                    onDelete={handleDeleteProduct}
                    onEdit={() => router.push(`/p-admin/admin-products/edit/${product._id}`)}
                    onViewVariants={() =>
                      router.push(`/p-admin/admin-products/${product._id}/variants`)
                    }
                  />
                </SortableGridItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
