"use client";

import { useState, useEffect } from "react";
import {
  FaBox,
  FaLayerGroup,
  FaEdit,
  FaTrash,
  FaPlus,
  FaArrowRight,
  FaGlobeAmericas,
  FaCalendarAlt,
  FaCrown,
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

const swalTheme = {
  confirmButtonColor: "var(--color-primary)",
  cancelButtonColor: "#9ca3af",
  customClass: {
    popup: "rounded-2xl font-[Vazirmatn] text-right",
    confirmButton: "rounded-[var(--radius)] font-bold",
    cancelButton: "rounded-[var(--radius)] font-bold",
  },
  rtl: true,
};

export default function BrandAdminPage({ brandId }) {
  const router = useRouter();

  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [brandData, setBrandData] = useState([]);
  const [limitedEditions, setLimitedEditions] = useState([]);

  useEffect(() => {
    fetchBrandData();
    fetchLimitedEditions();
  }, [brandId]);

  const fetchLimitedEditions = async () => {
    try {
      const res = await fetch(`/api/limited-editions?brand=${brandId}`);
      const data = await res.json();
      setLimitedEditions(data.limitedEditions || []);
    } catch {
      /* اختیاری */
    }
  };

  const handleDeleteLimitedEdition = async (limitedEdition) => {
    const result = await Swal.fire({
      ...swalTheme,
      title: "حذف لیمیتد ادیشن؟",
      text: `محصولات حذف نمی‌شوند؛ فقط ارتباطشان با «${limitedEdition.title}» برداشته می‌شود.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف کن",
      cancelButtonText: "انصراف",
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/limited-editions/${limitedEdition._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("لیمیتد ادیشن حذف شد");
        fetchLimitedEditions();
      } else {
        const data = await res.json();
        toast.error(data.error || "خطا در حذف");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    }
  };

  const fetchBrandData = async () => {
    try {
      const res = await fetch(`/api/brands/${brandId}`);
      const data = await res.json();

      const rootSeries =
        data?.brand?.series?.filter((serie) => !serie.parentSerie) || [];

      setBrand({ ...data.brand, series: rootSeries });

      const productsRes = await fetch(`/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: [data.brand.slug] }),
      });
      const productData = await productsRes.json();
      setBrandData(productData.results || []);
    } catch (error) {
      toast.error("خطا در بارگذاری اطلاعات برند");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBrand = () => {
    Swal.fire({
      ...swalTheme,
      title: "آیا مطمئن هستید؟",
      text: "با حذف برند، تمام سری‌های زیرمجموعه نیز حذف خواهند شد!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف شود",
      cancelButtonText: "انصراف",
    }).then(async (result) => {
      if (result.isConfirmed) {
        toast.success("برند با موفقیت حذف شد");
        router.push("/p-admin/admin-brands");
      }
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const series = brand?.series || [];
    const oldIndex = series.findIndex((s) => s._id === active.id);
    const newIndex = series.findIndex((s) => s._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(series, oldIndex, newIndex).map(
      (item, index) => ({ ...item, order: index })
    );
    setBrand((prev) => ({ ...prev, series: reordered }));

    try {
      const res = await fetch("/api/series/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: reordered.map((s) => ({ id: s._id, order: s.order })),
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("خطا در ذخیره ترتیب سری‌ها");
      fetchBrandData();
    }
  };

  const handleDeleteSerie = async (serieId) => {
    const result = await Swal.fire({
      ...swalTheme,
      title: "حذف سری؟",
      text: "این عمل غیرقابل بازگشت است!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف کن",
      cancelButtonText: "لغو",
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/series/${serieId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("سری با موفقیت حذف شد");
        fetchBrandData();
      } else {
        toast.error("خطا در حذف سری");
      }
    } catch {
      toast.error("خطای اتصال به سرور");
    }
  };

  if (loading) return <AdminLoader />;

  return (
    <div dir="rtl" className="w-full space-y-6">
      {/* Header — همان الگوی صفحه لیست برندها */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/p-admin/admin-brands"
            className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 hover:gap-2.5 transition-all"
            style={{ color: "var(--color-primary)" }}
          >
            <FaArrowRight size={11} /> بازگشت به مرکز برندها
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            برند <span style={{ color: "var(--color-primary)" }}>{brand?.title}</span>
          </h1>
          <p className="text-sm font-bold text-gray-400 mt-0.5">
            {brand?.series?.length || 0} سری • {brandData.length} محصول
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/p-admin/admin-brands/edit/${brandId}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-all"
          >
            <FaEdit size={12} /> ویرایش برند
          </button>
          <button
            onClick={handleDeleteBrand}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 transition-all"
          >
            <FaTrash size={12} /> حذف برند
          </button>
        </div>
      </div>

      {/* Brand Identity + Stats */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col lg:flex-row items-center gap-6 shadow-sm">
        <div className="w-16 h-16 rounded-2xl border border-gray-100 bg-gray-50 p-2 flex items-center justify-center shrink-0">
          {brand?.logo ? (
            <img src={brand.logo} alt={brand?.title} className="w-full h-full object-contain" />
          ) : (
            <span className="text-2xl font-bold text-gray-300">{brand?.title?.[0]}</span>
          )}
        </div>

        <div className="flex-1 text-center lg:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{brand?.name}</p>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-1 text-xs font-bold text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <FaGlobeAmericas style={{ color: "var(--color-secondary)" }} />
              {brand?.country || "Global"}
            </span>
            <span className="w-1 h-1 bg-gray-200 rounded-full" />
            <span className="inline-flex items-center gap-1.5">
              <FaCalendarAlt style={{ color: "var(--color-secondary)" }} />
              {brand?.foundedYear || "---"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full lg:w-auto">
          <StatMini icon={FaLayerGroup} label="سری‌ها" value={brand?.series?.length || 0} />
          <StatMini icon={FaBox} label="محصولات" value={brandData.length} />
        </div>
      </div>

      {/* Series section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">
            سری‌های برند
          </h2>
          <Link
            href={`${brandId}/add-serie`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: "var(--color-primary)" }}
          >
            <FaPlus size={12} /> ایجاد سری جدید
          </Link>
        </div>

        {(brand?.series?.length ?? 0) === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
              <FaLayerGroup size={24} />
            </div>
            <p className="text-gray-400 font-bold">هنوز سری‌ای برای این برند ثبت نشده</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={(brand?.series || []).map((s) => s._id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {brand.series.map((serie) => (
                  <SortableGridItem key={serie._id} id={serie._id}>
                    <SerieCard
                      serie={serie}
                      brandId={brandId}
                      onOpen={() =>
                        router.push(`/p-admin/admin-brands/${brandId}/${serie._id}`)
                      }
                      onEdit={() =>
                        router.push(`/p-admin/admin-brands/${brandId}/${serie._id}/edit`)
                      }
                      onDelete={() => handleDeleteSerie(serie._id)}
                    />
                  </SortableGridItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {/* Limited Editions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">لیمیتد ادیشن‌ها</h2>
            <p className="text-xs font-bold text-gray-400 mt-0.5">
              {limitedEditions.length} لیمیتد ادیشن ثبت شده
            </p>
          </div>
          <Link
            href={`/p-admin/admin-brands/${brandId}/limited-editions/add`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: "var(--color-primary)" }}
          >
            <FaPlus size={12} /> افزودن لیمیتد ادیشن
          </Link>
        </div>

        {limitedEditions.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
              <FaCrown size={24} />
            </div>
            <p className="text-gray-400 font-bold">هنوز لیمیتد ادیشنی ثبت نشده</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {limitedEditions.map((le) => (
              <LimitedEditionCard
                key={le._id}
                item={le}
                brandId={brandId}
                onDelete={() => handleDeleteLimitedEdition(le)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Sub components ─── */

function StatMini({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius)] bg-gray-50 border border-gray-100">
      <div className="w-9 h-9 rounded-[var(--radius)] bg-white border border-gray-100 flex items-center justify-center text-[var(--color-primary)]">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-base font-bold text-gray-900 leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function SerieCard({ serie, brandId, onOpen, onEdit, onDelete }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="h-1 w-full" style={{ background: "var(--color-primary)" }} />

      <button onClick={onOpen} className="block w-full text-right">
        <div className="relative h-36 bg-gray-50 overflow-hidden">
          {serie.image ? (
            <img
              src={serie.image}
              alt={serie.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-200">
              <FaLayerGroup size={36} />
            </div>
          )}
        </div>
      </button>

      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-[var(--color-primary)] transition-colors">
              {serie.title}
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5 truncate">
              {serie.name}
            </p>
          </div>
          {serie.logo && (
            <div className="w-10 h-10 rounded-[var(--radius)] bg-gray-50 border border-gray-100 p-1.5 shrink-0">
              <img
                src={serie.logo}
                alt=""
                className="w-full h-full object-contain opacity-70"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2">
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

function LimitedEditionCard({ item, brandId, onDelete }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div
        className="h-1 w-full"
        style={{
          background: `linear-gradient(to left, ${item.colors?.primary || "var(--color-primary)"}, ${
            item.colors?.secondary || "var(--color-secondary)"
          })`,
        }}
      />

      <div className="px-5 pt-5 pb-3 flex justify-center">
        <div className="w-16 h-16 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center overflow-hidden p-2 group-hover:scale-105 transition-transform">
          {item.logo || item.image ? (
            <img
              src={item.logo || item.image}
              alt={item.name}
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <span className="text-xl font-bold text-gray-300">{item.name?.[0]}</span>
          )}
        </div>
      </div>

      <div className="px-5 pb-4">
        <h3 className="text-sm font-bold text-gray-900 text-center group-hover:text-[var(--color-primary)] transition-colors">
          {item.title}
        </h3>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mt-0.5 mb-3">
          {item.name}
        </p>

        <div className="flex gap-2">
          <Link
            href={`/p-admin/admin-brands/${brandId}/limited-editions/${item._id}/edit`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[var(--radius)] text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white transition-all"
          >
            <FaEdit size={12} /> ویرایش
          </Link>
          <button
            onClick={onDelete}
            className="w-10 h-10 flex items-center justify-center rounded-[var(--radius)] bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100"
          >
            <FaTrash size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
