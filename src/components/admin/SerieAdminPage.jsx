"use client";

import { useState, useEffect } from "react";
import {
  FaLayerGroup,
  FaEdit,
  FaTrash,
  FaPlus,
  FaArrowRight,
  FaChevronLeft,
  FaTag,
  FaCodeBranch,
  FaCrown,
} from "react-icons/fa";

import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import Link from "next/link";

export default function SerieChildrenAdminPage({ serieId,brandId }) {
  const router = useRouter();

  const [serie, setSerie] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (serieId) {
      fetchSerieData();
    }
  }, [serieId]);

  const fetchSerieData = async () => {
    try {
      setLoading(true);

      // اطلاعات خود سری
      const serieRes = await fetch(`/api/series/${serieId}`);
      const serieData = await serieRes.json();

      if (!serieRes.ok) {
        toast.error("خطا در دریافت اطلاعات سری");
        return;
      }

      if (!serieRes.ok) {
        throw new Error("Serie fetch failed");
      }
      
      const currentSerie = serieData?.data || serieData;
      

      setSerie(currentSerie);

      // دریافت زیرسری‌ها
      const childrenRes = await fetch(
        `/api/series/${serieId}/children`
      );

      const childrenData = await childrenRes.json();
      if (childrenRes.ok) {
        setChildren(childrenData.children || []);
      }
    } catch (error) {
      toast.error("خطا در بارگذاری اطلاعات");
    } finally {
      setLoading(false);
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
      } catch (error) {
        toast.error("خطای سرور");
      }
    }
  };

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-black/10 border-t-black rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 text-xs font-bold tracking-[0.3em] uppercase">
            Loading Serie Structure...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-10 pb-20">
      {/* Top Bar */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => router.back()}
          className="group flex items-center gap-2 bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-gray-100 text-sm font-bold text-gray-600 hover:bg-black hover:text-white transition-all"
        >
          <FaChevronLeft
            className="group-hover:-translate-x-1 transition-transform"
            size={12}
          />
          <span>بازگشت</span>
        </button>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden bg-black rounded-[3rem] p-10 text-white shadow-2xl">
        <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-10">
          <div className="flex items-start gap-6">
            <div className="w-28 h-28 rounded-[2rem] overflow-hidden bg-white/10 border border-white/10 p-3 flex items-center justify-center">
              <img
                src={serie?.image || "/placeholder.jpg"}
                alt=""
                className="w-full h-full object-cover rounded-[1.5rem]"
              />
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-bold">
                  Parent Serie
                </p>

                <h1 className="text-5xl font-black tracking-tight">
                  {serie?.title}
                </h1>

                <p className="text-gray-400 uppercase text-xs tracking-[0.3em] mt-2">
                  {serie?.name}
                </p>
              </div>

              <p className="max-w-2xl text-gray-300 leading-8 text-sm">
                {serie?.description}
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                {serie?.tag === "limited-edition" && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold">
                    <FaCrown />
                    LIMITED EDITION
                  </div>
                )}

                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold">
                  <FaCodeBranch />
                  {children.length} CHILD SERIES
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Link
              href={`/p-admin/admin-brands/${brandId}/add-serie`}
            >
              <button className="bg-white text-black px-7 py-4 rounded-2xl font-bold text-xs flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                <FaPlus />
                ایجاد زیرسری جدید
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Children Grid */}
      <div className="space-y-8">
        <div className="flex items-end justify-between px-2">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              زیرسری‌های این مدل
            </h2>

            <p className="text-gray-400 text-sm mt-2">
              تمام نسخه‌ها و نسل‌های مرتبط با این سری
            </p>
          </div>
        </div>

        {children.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-[3rem] p-20 text-center">
            <div className="w-24 h-24 rounded-full bg-gray-100 mx-auto flex items-center justify-center">
              <FaLayerGroup className="text-3xl text-gray-300" />
            </div>

            <h3 className="mt-8 text-2xl font-bold text-gray-800">
              هیچ زیرسری‌ای وجود ندارد
            </h3>

            <p className="text-gray-400 mt-3 max-w-md mx-auto leading-7">
              هنوز هیچ نسخه یا نسل جدیدی برای این سری ثبت نشده است.
            </p>

            <Link
              href={`/p-admin/admin-series/${serieId}/add-child`}
            >
              <button className="mt-8 bg-black text-white px-8 py-4 rounded-2xl font-bold text-sm inline-flex items-center gap-3 hover:scale-105 transition-all">
                <FaPlus />
                ایجاد اولین زیرسری
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {children.map((child) => (
              <div
                key={child._id}
                onClick={() =>
                  router.push(`/admin/series/${child._id}`)
                }
                className="group bg-white rounded-[3.5rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer"
              >
                {/* Image */}
                <div className="relative h-64 overflow-hidden bg-gray-50">
                  <img
                    src={child.image || "/placeholder.jpg"}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
                    <span className="text-white text-xs font-bold flex items-center gap-2">
                      MANAGE SUB SERIE
                      <FaArrowRight />
                    </span>
                  </div>

                  {child.tag === "limited-edition" && (
                    <div className="absolute top-5 left-5 bg-yellow-400 text-black px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl">
                      <FaCrown />
                      Limited
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-8">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 group-hover:text-[var(--color-primary)] transition-colors">
                        {child.title}
                      </h3>

                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.25em] mt-2">
                        {child.name}
                      </p>
                    </div>

                    <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center p-2">
                      <img
                        src={child.logo}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  <p className="mt-6 text-sm text-gray-500 leading-7 line-clamp-3 min-h-[80px]">
                    {child.description}
                  </p>

                  {/* Colors */}
                  <div className="flex items-center gap-3 mt-6">
                    <div
                      className="w-7 h-7 rounded-full border-2 border-white shadow-md"
                      style={{
                        backgroundColor:
                          child?.colors?.primary || "#000",
                      }}
                    />

                    <div
                      className="w-7 h-7 rounded-full border-2 border-white shadow-md"
                      style={{
                        backgroundColor:
                          child?.colors?.secondary || "#fff",
                      }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-6 mt-6 border-t border-gray-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();

                        router.push(
                          `/p-admin/admin-brands/${serie.brand}/${child._id}/edit`
                        );
                      }}
                      className="flex-1 py-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-black transition-all"
                    >
                      <FaEdit className="mx-auto" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSerie(child._id);
                      }}
                      className="flex-1 py-4 rounded-2xl bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <FaTrash className="mx-auto" />
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