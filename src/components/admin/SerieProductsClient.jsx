"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "@/components/admin";
import SortableGridItem from "@/components/admin/SortableGridItem";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";
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
import { ADMIN_REF_TTL } from "@/hooks/useAdminRefData";
import { optimisticReorder } from "@/lib/adminCache";

// محصولات زیرسری‌ها (در هر عمق) هم در همین لیستِ واحد می‌آیند تا ادمین
// ترتیب کل سلسله‌مراتب سری را یک‌جا تعیین کند
const productsKey = (serieId) =>
  `/api/product?${new URLSearchParams({
    isAdmin: "true",
    all: "true",
    serie: serieId,
    includeDescendants: "true",
  })}`;

export default function SerieProductsClient({ serieId, brandId }) {
  const router = useRouter();
  const { can } = useAdminPermissions();

  const { data: serieRes } = useSWR(
    serieId ? `/api/series/${serieId}` : null,
    ADMIN_REF_TTL,
  );
  const serie = serieRes?.data || serieRes?.serie || serieRes;

  const {
    data: productsRes,
    isLoading: loading,
    mutate: fetchProducts,
  } = useSWR(serieId ? productsKey(serieId) : null, ADMIN_REF_TTL);

  // مرتب‌سازی پایدار بر اساس order — محصولات بدون ترتیب دستی (order=0)
  // همان ترتیب سرور (جدیدترین اول) را حفظ می‌کنند
  const products = (productsRes?.products || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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

    try {
      await optimisticReorder(
        fetchProducts,
        { ...productsRes, products: reordered },
        () =>
          fetch("/api/product/reorder", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              products: reordered.map((p) => ({ id: p._id, order: p.order })),
            }),
          }),
      );
    } catch {
      // ترتیب قبلی توسط SWR بازگردانده شده
      showError("خطا", "ترتیب ذخیره نشد — ترتیب قبلی بازگردانده شد");
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
                {products.length} محصول
                {products.some(
                  (p) => p.serie && String(p.serie._id) !== String(serieId)
                ) && " (شامل زیرسری‌ها)"}
                {" — ترتیب این صفحه، ترتیب نمایش محصولات در کل سایت است"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* راهنمای درگ‌اند‌دراپ */}
      {!loading && products.length > 1 && can("products.edit") && (
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={can("products.edit") ? handleDragEnd : undefined}
        >
          <SortableContext
            items={products.map((p) => p._id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
              {products.map((product) => (
                <SortableGridItem key={product._id} id={product._id}>
                  <div className="relative">
                    {/* برچسب زیرسری — تا در لیستِ ترکیبی معلوم باشد هر محصول متعلق به کدام زیرسری است */}
                    {product.serie &&
                      String(product.serie._id) !== String(serieId) && (
                        <span className="absolute top-3 right-3 z-20 pointer-events-none text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 border border-gray-200 text-gray-600 shadow-sm">
                          {product.serie.title || product.serie.name}
                        </span>
                      )}
                    <ProductCard
                      product={product}
                      onDelete={handleDeleteProduct}
                      onEdit={() => router.push(`/p-admin/admin-products/edit/${product._id}`)}
                      onViewVariants={() =>
                        router.push(`/p-admin/admin-products/${product._id}/variants`)
                      }
                    />
                  </div>
                </SortableGridItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
