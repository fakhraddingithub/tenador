"use client";

import { useState, useEffect } from "react";
import {
  FaLayerGroup,
  FaEdit,
  FaTrash,
  FaPlus,
  FaArrowRight,
  FaChevronLeft,
  FaCodeBranch,
  FaCrown,
  FaBox,
} from "react-icons/fa";

import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import Link from "next/link";
import AdminLoader from "@/components/admin/AdminLoader";
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

export default function SerieChildrenAdminPage({ serieId, brandId }) {
  const router = useRouter();

  const [serie, setSerie] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (serieId) fetchSerieData();
  }, [serieId]);

  const fetchSerieData = async () => {
    try {
      setLoading(true);
      const serieRes = await fetch(`/api/series/${serieId}`);
      const serieData = await serieRes.json();

      if (!serieRes.ok) {
        toast.error("خطا در دریافت اطلاعات سری");
        return;
      }
      const currentSerie = serieData?.data || serieData;
      setSerie(currentSerie);

      const childrenRes = await fetch(`/api/series/${serieId}/children`);
      const childrenData = await childrenRes.json();
      if (childrenRes.ok) setChildren(childrenData.children || []);
    } catch (error) {
      toast.error("خطا در بارگذاری اطلاعات");
    } finally {
      setLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = children.findIndex((c) => c._id === active.id);
    const newIndex = children.findIndex((c) => c._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(children, oldIndex, newIndex).map(
      (item, index) => ({ ...item, order: index })
    );
    setChildren(reordered);

    try {
      const res = await fetch("/api/series/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: reordered.map((c) => ({ id: c._id, order: c.order })),
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("خطا در ذخیره ترتیب زیرسری‌ها");
      fetchSerieData();
    }
  };

  const handleDeleteSerie = async (childSerieId) => {
    const result = await Swal.fire({
      title: "حذف زیرسری؟",
      text: "تمام زیرمجموعه‌های این سری نیز حذف خواهند شد!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "بله حذف کن",
      cancelButtonText: "لغو",
      customClass: { popup: "rounded-2xl font-[Vazirmatn] text-right" },
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/series/${childSerieId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          toast.success("زیرسری حذف شد");
          fetchSerieData();
        } else {
          toast.error("خطا در حذف");
        }
      } catch {
        toast.error("خطای سرور");
      }
    }
  };

  if (loading) return <AdminLoader />;

  return (
    <div dir="rtl" className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end">
        <Link
          href={`/p-admin/admin-brands/${brandId}/add-serie`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
          style={{ background: "var(--color-primary)" }}
        >
          <FaPlus size={12} />
          ایجاد زیرسری جدید
        </Link>
      </div>

      {/* Serie summary card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col md:flex-row items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-100 p-2 flex items-center justify-center overflow-hidden shrink-0">
          <img
            src={serie?.image || "/placeholder.jpg"}
            alt=""
            className="w-full h-full object-cover rounded-xl"
          />
        </div>

        <div className="flex-1 text-center md:text-right min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
            Parent Serie
          </p>
          <h1 className="text-lg md:text-xl font-bold text-gray-900 mt-1 truncate">
            {serie?.title}
          </h1>
          <p className="text-[11px] uppercase tracking-widest text-gray-400 font-bold mt-0.5">
            {serie?.name}
          </p>
          {serie?.description && (
            <p className="mt-2 text-xs text-gray-500 leading-6 line-clamp-2 max-w-2xl">
              {serie.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-center md:justify-end">
          {serie?.tag === "limited-edition" && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[10px] font-bold uppercase tracking-widest bg-yellow-50 border border-yellow-100"
              style={{ color: "var(--color-secondary)" }}
            >
              <FaCrown size={10} /> Limited
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[10px] font-bold uppercase tracking-widest bg-gray-50 border border-gray-100 text-gray-500">
            <FaCodeBranch size={10} /> {children.length} Child
          </span>
        </div>
      </div>

      {/* Children Grid */}
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">زیرسری‌های این مدل</h2>
            <p className="text-xs font-bold text-gray-400 mt-0.5">
              تمام نسخه‌ها و نسل‌های مرتبط با این سری
            </p>
          </div>
        </div>

        {children.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
              <FaLayerGroup size={24} />
            </div>
            <p className="text-gray-400 font-bold text-sm">هیچ زیرسری‌ای وجود ندارد</p>
            <p className="text-gray-400 text-xs mt-1">
              هنوز هیچ نسخه یا نسل جدیدی برای این سری ثبت نشده است
            </p>
            <Link
              href={`/p-admin/admin-brands/${brandId}/add-serie`}
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:-translate-y-0.5 transition-all"
              style={{ background: "var(--color-primary)" }}
            >
              <FaPlus size={12} /> ایجاد اولین زیرسری
            </Link>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={children.map((c) => c._id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {children.map((child) => (
                  <SortableGridItem key={child._id} id={child._id}>
                    <ChildCard
                      child={child}
                      serie={serie}
                      onOpen={() => router.push(`/admin/series/${child._id}`)}
                      onProducts={() =>
                        router.push(
                          `/p-admin/admin-brands/${brandId}/${child._id}/products`
                        )
                      }
                      onEdit={() =>
                        router.push(
                          `/p-admin/admin-brands/${serie.brand}/${child._id}/edit`
                        )
                      }
                      onDelete={() => handleDeleteSerie(child._id)}
                    />
                  </SortableGridItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function ChildCard({ child, onOpen, onProducts, onEdit, onDelete }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="h-1 w-full" style={{ background: "var(--color-primary)" }} />

      <button onClick={onOpen} className="block w-full text-right">
        <div className="relative h-36 bg-gray-50 overflow-hidden">
          <img
            src={child.image || "/placeholder.jpg"}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {child.tag === "limited-edition" && (
            <div
              className="absolute top-3 left-3 px-2.5 py-1 rounded-[var(--radius)] text-[9px] font-bold uppercase tracking-widest bg-white/95 shadow-sm inline-flex items-center gap-1"
              style={{ color: "var(--color-secondary)" }}
            >
              <FaCrown size={9} /> Limited
            </div>
          )}
        </div>
      </button>

      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-[var(--color-primary)] transition-colors">
              {child.title}
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5 truncate">
              {child.name}
            </p>
          </div>
          {child.logo && (
            <div className="w-10 h-10 rounded-[var(--radius)] bg-gray-50 border border-gray-100 p-1.5 shrink-0">
              <img src={child.logo} alt="" className="w-full h-full object-contain opacity-70" />
            </div>
          )}
        </div>

        {child.description && (
          <p className="text-[11px] text-gray-500 leading-6 line-clamp-2 mb-3">
            {child.description}
          </p>
        )}

        <div className="flex items-center gap-1.5 mb-3">
          <span
            className="w-4 h-4 rounded-full border border-white shadow-sm ring-1 ring-gray-100"
            style={{ backgroundColor: child?.colors?.primary || "#000" }}
          />
          <span
            className="w-4 h-4 rounded-full border border-white shadow-sm ring-1 ring-gray-100"
            style={{ backgroundColor: child?.colors?.secondary || "#fff" }}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onProducts();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[var(--radius)] text-xs font-bold bg-gray-50 text-gray-700 hover:bg-[var(--color-primary)] hover:text-white transition-all"
          >
            <FaBox size={12} /> محصولات
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[var(--radius)] text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white transition-all"
          >
            <FaEdit size={12} /> ویرایش
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-[var(--radius)] bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100"
          >
            <FaTrash size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
