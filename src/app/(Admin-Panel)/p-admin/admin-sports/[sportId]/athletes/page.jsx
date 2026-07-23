"use client";

/**
 * قهرمانانِ یک ورزش (فاز ۲).
 * فهرست ورزشکاران فیلترشده بر اساس sportId، با همان الگو/UI کارت‌های
 * صفحه‌ی «مدیریت قهرمانان» (پس از حذف فیلدهای قد/وزن/تولد/افتخارات در فاز ۱).
 * دکمه‌های افزودن/ویرایش کماکان روت‌های موجودِ /admin-athletes/add و /edit/[id]
 * را فراخوانی می‌کنند تا هیچ منطق CRUD خراب نشود.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import {
  FaPlus, FaEdit, FaTrash, FaArrowRight,
  FaUserCircle, FaGlobe, FaSearch,
} from "react-icons/fa";

import AdminLoader from "@/components/admin/AdminLoader";

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

export default function SportAthletesPage() {
  const { sportId } = useParams();

  const [athletes, setAthletes] = useState([]);
  const [sport, setSport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!sportId) return;
    (async () => {
      try {
        const [aRes, sRes] = await Promise.all([
          fetch("/api/athletes"),
          fetch(`/api/sports/${sportId}`),
        ]);
        const aData = await aRes.json();
        const sData = await sRes.json().catch(() => ({}));
        setAthletes(aData.athletes || []);
        setSport(sData?.sport || null);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [sportId]);

  const scoped = useMemo(
    () =>
      (athletes || []).filter((a) => {
        const sid = a?.sport?._id || a?.sport;
        return String(sid || "") === String(sportId || "");
      }),
    [athletes, sportId]
  );

  const filtered = scoped.filter(
    (a) =>
      a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      ...swalTheme,
      title: "حذف ورزشکار؟",
      text: "این عمل پروفایل ورزشکار را کاملاً حذف می‌کند!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف کن",
      cancelButtonText: "انصراف",
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/athletes/${id}`, { method: "DELETE" });
      if (res.ok) {
        Swal.fire({ ...swalTheme, title: "حذف شد", icon: "success" });
        setAthletes((prev) => prev.filter((a) => a._id !== id));
      }
    } catch {
      /* ignore */
    }
  };

  const sportName = sport?.title || sport?.name || "ورزش";

  return (
    <div dir="rtl">
      {/* Header — منطبق بر الگوی صفحه‌ی «دسته‌بندی‌های ورزش» */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--admin-text)" }}>
            قهرمانانِ <span style={{ color: "var(--color-primary)" }}>{sportName}</span>
          </h1>
          <p className="text-sm font-bold mt-0.5" style={{ color: "var(--admin-text-muted)" }}>
            {scoped.length} ورزشکار ثبت‌شده در این ورزش
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="جستجوی سریع..."
              className="pr-9 pl-4 py-2.5 text-sm font-bold bg-white border-2 border-gray-200 w-56 focus:outline-none focus:border-[var(--color-primary)] transition-all"
              style={{ borderRadius: "var(--admin-radius)" }}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link
            href={`/p-admin/admin-athletes/add?sportId=${sportId}`}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}
          >
            <FaPlus size={14} /> افزودن قهرمان
          </Link>
        </div>
      </div>

      {loading ? (
        <AdminLoader />
      ) : filtered.length === 0 ? (
        <div
          className="bg-white border-2 border-dashed py-20 text-center"
          style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}
        >
          <p className="font-bold" style={{ color: "var(--admin-text-muted)" }}>
            هنوز قهرمانی برای این ورزش ثبت نشده است
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-5">
          {filtered.map((athlete, i) => (
            <motion.div
              key={athlete._id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="group bg-white border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
              style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}
            >
              <div className="relative h-48 overflow-hidden bg-gray-900">
                {athlete.photo ? (
                  <img
                    src={athlete.photo}
                    alt={athlete.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gradient-to-br from-gray-800 to-gray-900">
                    <FaUserCircle size={56} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-4 right-4 left-4">
                  <h2 className="text-white font-bold text-lg mb-0.5 leading-tight">{athlete.title}</h2>
                  <p className="text-gray-300 text-xs flex items-center gap-1 font-bold">
                    <FaGlobe style={{ color: "var(--color-secondary)" }} size={10} />
                    {athlete.nationality || "ملیت نامشخص"}
                  </p>
                </div>
              </div>

              <div className="px-4 py-4 flex gap-2">
                <Link
                  href={`/p-admin/admin-athletes/edit/${athlete._id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white transition-all border border-gray-100"
                  style={{ borderRadius: "var(--admin-radius)" }}
                >
                  <FaEdit size={12} /> ویرایش پروفایل
                </Link>
                <button
                  onClick={() => handleDelete(athlete._id)}
                  className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100"
                  style={{ borderRadius: "var(--admin-radius)" }}
                >
                  <FaTrash size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}