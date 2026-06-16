"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  FaPlus, FaSearch, FaEdit, FaTrash, FaCopy, FaArchive,
  FaCalendarAlt, FaPlay, FaPause, FaEye,
} from "react-icons/fa";
import AdminLoader from "@/components/admin/AdminLoader";

const statusConfig = {
  active:    { label: "فعال",           color: "bg-green-100 text-green-700" },
  scheduled: { label: "زمان‌بندی‌شده", color: "bg-blue-100 text-blue-700" },
  paused:    { label: "متوقف",          color: "bg-yellow-100 text-yellow-700" },
  draft:     { label: "پیش‌نویس",       color: "bg-gray-100 text-gray-600" },
  ended:     { label: "پایان‌یافت",     color: "bg-red-100 text-red-600" },
  archived:  { label: "بایگانی",        color: "bg-gray-100 text-gray-400" },
};

const tabs = [
  { key: "", label: "همه" },
  { key: "active", label: "فعال" },
  { key: "scheduled", label: "زمان‌بندی‌شده" },
  { key: "draft", label: "پیش‌نویس" },
  { key: "archived", label: "بایگانی" },
];

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/events?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      toast.error("خطا در بارگذاری رویدادها");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Defer to a microtask so the synchronous setLoading(true) inside fetchEvents
  // doesn't run directly in the effect body (avoids cascading-render warning).
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) fetchEvents();
    });
    return () => {
      cancelled = true;
    };
  }, [fetchEvents]);

  const changeStatus = async (event, status) => {
    try {
      const res = await fetch(`/api/admin/events/${event._id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success("وضعیت رویداد تغییر کرد");
        fetchEvents();
      } else {
        const d = await res.json();
        toast.error(d.error || "خطا");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    }
  };

  const duplicate = async (event) => {
    try {
      const res = await fetch(`/api/admin/events/${event._id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("رویداد کپی شد");
        fetchEvents();
      } else {
        toast.error(data.error || "خطا در کپی");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    }
  };

  const remove = async (event) => {
    const result = await Swal.fire({
      title: "حذف رویداد؟",
      text: `رویداد «${event.name}» به‌طور دائمی حذف می‌شود.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "بله، حذف کن",
      cancelButtonText: "انصراف",
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/events/${event._id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("رویداد حذف شد");
        fetchEvents();
      } else {
        const d = await res.json();
        toast.error(d.error || "خطا در حذف");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    }
  };

  const filtered = events.filter(
    (e) =>
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.slug?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FaCalendarAlt style={{ color: "var(--color-secondary)" }} size={18} />
            مدیریت <span style={{ color: "var(--color-primary)" }}>کمپین‌ها</span>
          </h1>
          <p className="text-sm font-bold text-gray-400 mt-0.5">
            {events.length} کمپین ثبت‌شده
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="search"
              placeholder="جستجو..."
              className="pr-9 pl-4 py-2.5 text-sm font-bold bg-white border-2 border-gray-200 rounded-[var(--radius)] w-52 focus:outline-none focus:border-[var(--color-primary)] transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link
            href="/p-admin/admin-events/campaigns/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: "var(--color-primary)" }}
          >
            <FaPlus size={13} /> کمپین جدید
          </Link>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 bg-gray-50 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === tab.key
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminLoader />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <FaCalendarAlt size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-bold">کمپینی یافت نشد</p>
          <Link
            href="/p-admin/admin-events/campaigns/new"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold"
            style={{ color: "var(--color-primary)" }}
          >
            <FaPlus size={12} /> ساخت اولین کمپین
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((event, i) => {
            const sc = statusConfig[event.status] || statusConfig.draft;
            const primary = event.theme?.primaryColor || "var(--color-primary)";
            const secondary = event.theme?.secondaryColor || "var(--color-secondary)";

            return (
              <motion.div
                key={event._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Color bar */}
                <div
                  className="h-0.5 w-full"
                  style={{ background: `linear-gradient(to right, ${primary}, ${secondary})` }}
                />

                <div className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  {/* Cover thumbnail */}
                  <div
                    className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ background: event.theme?.backgroundColor || "#f3f4f6" }}
                  >
                    {event.visualIdentity?.coverImage || event.visualIdentity?.logo ? (
                      <img
                        src={event.visualIdentity.coverImage || event.visualIdentity.logo}
                        alt={event.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FaCalendarAlt size={20} style={{ color: primary }} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-black text-gray-900 truncate">{event.name}</h2>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.color}`}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-bold mt-0.5">/{event.slug}</p>
                    {(event.startDate || event.endDate) && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {event.startDate && new Date(event.startDate).toLocaleDateString("fa-IR")}
                        {event.startDate && event.endDate && " — "}
                        {event.endDate && new Date(event.endDate).toLocaleDateString("fa-IR")}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {event.status === "active" ? (
                      <button
                        onClick={() => changeStatus(event, "paused")}
                        title="توقف"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-500 hover:text-white transition-all border border-yellow-100 text-xs"
                      >
                        <FaPause size={11} />
                      </button>
                    ) : event.status !== "archived" && event.status !== "ended" ? (
                      <button
                        onClick={() => changeStatus(event, "active")}
                        title="فعال‌سازی"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-500 hover:text-white transition-all border border-green-100"
                      >
                        <FaPlay size={11} />
                      </button>
                    ) : null}

                    <Link
                      href={`/events/${event.slug}`}
                      target="_blank"
                      title="پیش‌نمایش"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-all border border-blue-100"
                    >
                      <FaEye size={12} />
                    </Link>

                    <button
                      onClick={() => duplicate(event)}
                      title="کپی"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-900 hover:text-white transition-all border border-gray-100"
                    >
                      <FaCopy size={11} />
                    </button>

                    <Link
                      href={`/p-admin/admin-events/campaigns/${event._id}`}
                      title="ویرایش"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-900 hover:text-white transition-all border border-gray-100"
                    >
                      <FaEdit size={12} />
                    </Link>

                    {event.status !== "archived" && (
                      <button
                        onClick={() => changeStatus(event, "archived")}
                        title="بایگانی"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white transition-all border border-orange-100"
                      >
                        <FaArchive size={11} />
                      </button>
                    )}

                    <button
                      onClick={() => remove(event)}
                      title="حذف"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100"
                    >
                      <FaTrash size={11} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
