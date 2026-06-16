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
  FaChevronLeft,
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

  // لیمیتد ادیشن‌های مخصوص همین برند
  const fetchLimitedEditions = async () => {
    try {
      const res = await fetch(`/api/limited-editions?brand=${brandId}`);
      const data = await res.json();
      setLimitedEditions(data.limitedEditions || []);
    } catch {
      /* نمایش لیمیتد ادیشن‌ها اختیاری است */
    }
  };

  const handleDeleteLimitedEdition = async (limitedEdition) => {
    const result = await Swal.fire({
      title: "حذف لیمیتد ادیشن؟",
      text: `محصولات حذف نمی‌شوند؛ فقط ارتباطشان با «${limitedEdition.title}» برداشته می‌شود.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
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

      // فقط سری‌های لول 0
      const rootSeries =
        data?.brand?.series?.filter(
          (serie) => !serie.parentSerie
        ) || [];

      setBrand({
        ...data.brand,
        series: rootSeries,
      });

      const productsRes = await fetch(`/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: [data.brand.slug] }),
      });

      const productData = await productsRes.json();

      setBrandData(productData.results);
    } catch (error) {
      toast.error("خطا در بارگذاری اطلاعات برند");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBrand = () => {
    Swal.fire({
      title: "آیا مطمئن هستید؟",
      text: "با حذف برند، تمام سری‌های زیرمجموعه نیز حذف خواهند شد!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "بله، حذف شود",
      cancelButtonText: "انصراف",
    }).then(async (result) => {
      if (result.isConfirmed) {
        toast.success("برند با موفقیت حذف شد");
        router.push("/admin/brands");
      }
    });
  };

  // ─── جابه‌جایی سری‌ها (drag & drop) — ترتیب در دیتابیس ذخیره می‌شود ───
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
      title: "حذف سری؟",
      text: "این عمل غیرقابل بازگشت است!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "بله، حذف کن",
      cancelButtonText: "لغو",
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/series/${serieId}`, {
          method: "DELETE",
        });

        if (res.ok) {
          toast.success("سری با موفقیت حذف شد");
          fetchBrandData();
        } else {
          toast.error("خطا در حذف سری");
        }
      } catch (error) {
        toast.error("خطای اتصال به سرور");
      }
    }
  };

  if (loading) return <AdminLoader />;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-10 pb-20">
      {/* 0. Top Navigation & Back Button */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => router.back()}
          className="group flex items-center gap-2 bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-gray-100 text-sm font-bold text-gray-600 hover:bg-black hover:text-white transition-all"
        >
          <FaChevronLeft
            className="group-hover:-translate-x-1 transition-transform"
            size={12}
          />
          <span>بازگشت به لیست</span>
        </button>
      </div>

      {/* 1. Statistics Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">
              Total Series
            </p>

            <h4 className="text-5xl font-bold italic">
              {brand?.series?.length || 0}
            </h4>
          </div>

          <FaLayerGroup className="text-white/10 text-8xl absolute -right-5 group-hover:rotate-12 transition-transform" />
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 flex justify-between items-center shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">
              Total Products
            </p>

            <h4 className="text-5xl font-bold text-gray-900 italic">
              {brandData.length}
            </h4>
          </div>

          <FaBox className="text-gray-50 text-8xl absolute -right-5 group-hover:-rotate-12 transition-transform" />
        </div>

        <div className="bg-[var(--color-primary)] text-white p-8 rounded-[2.5rem] text-black flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-bold opacity-50">
              <FaGlobeAmericas /> COUNTRY
            </div>

            <p className="font-bold text-xl uppercase">
              {brand?.country || "Global"}
            </p>
          </div>

          <div className="h-full w-px bg-black/10 mx-4" />

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-bold opacity-50">
              <FaCalendarAlt /> FOUNDED
            </div>

            <p className="font-bold text-xl">
              {brand?.foundedYear || "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Brand Management Bar */}
      <div className="bg-white p-7 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-[2rem] border-4 border-gray-50 overflow-hidden bg-white p-2 flex items-center justify-center">
            <img
              src={brand?.logo}
              className="w-full h-full object-contain"
              alt={brand?.title}
            />
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tighter text-gray-900">
              {brand?.title}
            </h1>

            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">
              {brand?.name}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() =>
              router.push(`/p-admin/admin-brands/edit/${brandId}`)
            }
            className="px-7 py-4 bg-gray-50 text-gray-900 rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-gray-200 transition-all"
          >
            <FaEdit /> ویرایش برند
          </button>

          <button
            onClick={handleDeleteBrand}
            className="px-7 py-4 bg-red-50 text-red-600 rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-red-100 transition-all"
          >
            <FaTrash /> حذف برند
          </button>
        </div>
      </div>

      {/* 3. Series Grid */}
      <div className="space-y-8">
        <div className="flex justify-between items-end px-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 italic underline underline-offset-8 decoration-4 decoration-[var(--color-primary)]">
              مدل های برند
            </h3>
          </div>

          <Link href={`${brandId}/add-serie`}>
            <button className="bg-black text-white px-7 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gray-200">
              <FaPlus /> ایجاد سری جدید
            </button>
          </Link>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
        <SortableContext
          items={(brand?.series || []).map((s) => s._id)}
          strategy={rectSortingStrategy}
        >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {brand?.series?.map((serie) => (
            <SortableGridItem key={serie._id} id={serie._id}>
            <div
              onClick={() =>
                router.push(`/p-admin/admin-brands/${brandId}/${serie._id}`)
              }
              className="group bg-white rounded-[3.5rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer relative"
            >
              <div className="h-56 bg-gray-50 relative overflow-hidden">
                <img
                  src={serie.image || "/placeholder.jpg"}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  alt=""
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-10">
                  <span className="text-white font-bold text-xs flex items-center gap-2">
                    VIEW SERIES ASSETS <FaArrowRight />
                  </span>
                </div>
              </div>

              <div className="p-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase">
                      {serie.title}
                    </h4>

                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
                      {serie.name}
                    </p>
                  </div>

                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 p-2">
                    <img
                      src={serie.logo}
                      className="w-full h-full object-contain grayscale opacity-50"
                      alt=""
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-6 border-t border-gray-50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();

                      router.push(
                        `/p-admin/admin-brands/${serie.brand}/${serie._id}/edit`
                      );
                    }}
                    className="flex-1 py-4 bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 rounded-2xl transition-all"
                  >
                    <FaEdit className="mx-auto" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSerie(serie._id);
                    }}
                    className="flex-1 py-4 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                  >
                    <FaTrash className="mx-auto" />
                  </button>
                </div>
              </div>
            </div>
            </SortableGridItem>
          ))}
        </div>
        </SortableContext>
        </DndContext>
      </div>

      {/* 4. Limited Editions (لیمیتد ادیشن‌های این برند) */}
      <div className="space-y-8">
        <div className="flex justify-between items-end px-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 italic underline underline-offset-8 decoration-4 decoration-[var(--color-primary)]">
              لیمیتد ادیشن‌ها
            </h3>
            <p className="text-gray-400 font-bold text-xs mt-2">
              {limitedEditions.length} لیمیتد ادیشن برای این برند ثبت شده
            </p>
          </div>

          <Link href={`/p-admin/admin-brands/${brandId}/limited-editions/add`}>
            <button className="bg-black text-white px-7 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gray-200">
              <FaPlus /> افزودن لیمیتد ادیشن
            </button>
          </Link>
        </div>

        {limitedEditions.length === 0 ? (
          <div className="bg-white rounded-[3rem] border-2 border-dashed border-gray-200 py-16 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-200">
              <FaCrown size={26} />
            </div>
            <p className="text-gray-400 font-bold">
              هنوز لیمیتد ادیشنی برای این برند ثبت نشده
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {limitedEditions.map((le) => (
              <div
                key={le._id}
                className="group relative bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* نوار رنگی لیمیتد ادیشن */}
                <div
                  className="h-1.5 w-full"
                  style={{
                    background: `linear-gradient(to left, ${le.colors?.primary || "var(--color-primary)"}, ${le.colors?.secondary || "var(--color-secondary)"})`,
                  }}
                />

                <div className="px-6 pt-7 pb-4 flex justify-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center overflow-hidden p-3 group-hover:scale-105 transition-transform">
                    {le.logo || le.image ? (
                      <img
                        src={le.logo || le.image}
                        alt={le.name}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-gray-200">
                        {le.name?.[0]}
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-6 pb-5">
                  <h2 className="text-base font-bold text-gray-800 text-center group-hover:text-[var(--color-primary)] transition-colors">
                    {le.title}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 text-center mb-4">
                    {le.name}
                  </p>

                  <div className="flex gap-2">
                    <Link
                      href={`/p-admin/admin-brands/${brandId}/limited-editions/${le._id}/edit`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white transition-all"
                    >
                      <FaEdit size={12} /> ویرایش
                    </Link>
                    <button
                      onClick={() => handleDeleteLimitedEdition(le)}
                      className="w-10 h-10 flex items-center justify-center rounded-2xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100"
                    >
                      <FaTrash size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}