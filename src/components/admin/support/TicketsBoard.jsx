"use client";

/**
 * TicketsBoard — تب «تیکت‌ها» در مرکز پشتیبانی ادمین
 *
 * لیست همه‌ی تیکت‌ها با فیلتر وضعیت/دپارتمان/اولویت/کارشناس، جستجوی موضوع و
 * مرتب‌سازی (آخرین فعالیت / تاریخ ثبت / اولویت). کلیک روی هر ردیف →
 * صفحه‌ی گفتگوی تیکت (/p-admin/support/tickets/[id]).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  FaTicketAlt,
  FaSearch,
  FaInbox,
  FaUser,
  FaBoxOpen,
  FaMoneyBillWave,
  FaUserCheck,
  FaChevronLeft,
} from "react-icons/fa";
import {
  DEPARTMENT_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_DEPARTMENTS,
  TICKET_PRIORITIES,
} from "base/utils/ticketMeta";

const STATUS_TABS = [
  { key: "", label: "همه" },
  { key: "open", label: STATUS_LABELS.open },
  { key: "answered", label: STATUS_LABELS.answered },
  { key: "pending_user", label: STATUS_LABELS.pending_user },
  { key: "closed", label: STATUS_LABELS.closed },
];

const STATUS_BADGE = {
  open: "bg-amber-50 text-amber-600",
  answered: "bg-green-50 text-green-600",
  pending_user: "bg-blue-50 text-blue-600",
  closed: "bg-gray-100 text-gray-500",
};

const PRIORITY_BADGE = {
  low: "bg-gray-100 text-gray-500",
  medium: "bg-sky-50 text-sky-600",
  high: "bg-orange-50 text-orange-600",
  urgent: "bg-red-50 text-red-600",
};

function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function fullName(u) {
  if (!u) return "";
  return [u.name, u.lastName].filter(Boolean).join(" ");
}

export default function TicketsBoard() {
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({
    open: 0,
    answered: 0,
    pending_user: 0,
    closed: 0,
  });
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedAdmin, setAssignedAdmin] = useState("");
  const [sort, setSort] = useState("lastMessageAt");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (department) params.set("department", department);
      if (priority) params.set("priority", priority);
      if (assignedAdmin) params.set("assignedAdmin", assignedAdmin);
      if (sort) params.set("sort", sort);
      if (debouncedQuery) params.set("q", debouncedQuery);

      const res = await fetch(`/api/admin/tickets?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTickets(data.tickets || []);
      setCounts(data.counts || {});
    } catch {
      toast.error("خطا در بارگذاری تیکت‌ها");
    } finally {
      setLoading(false);
    }
  }, [status, department, priority, assignedAdmin, sort, debouncedQuery]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // گزینه‌های فیلترِ کارشناس از داده‌ی موجود ساخته می‌شود (+ «بدون کارشناس»)
  const adminOptions = useMemo(() => {
    const map = new Map();
    for (const t of tickets) {
      if (t.assignedAdmin?._id && !map.has(t.assignedAdmin._id)) {
        map.set(t.assignedAdmin._id, fullName(t.assignedAdmin));
      }
    }
    return Array.from(map.entries());
  }, [tickets]);

  const totalAll =
    (counts.open || 0) +
    (counts.answered || 0) +
    (counts.pending_user || 0) +
    (counts.closed || 0);

  const selectCls =
    "bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-600 outline-none focus:border-[var(--color-primary)] transition";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
          <FaTicketAlt className="text-[var(--color-primary)]" /> تیکت‌های پشتیبانی
        </h1>
        <p className="text-sm text-gray-400 font-bold mt-1">
          مدیریت تیکت‌های کاربران — پاسخ‌گویی، ارجاع و پیگیری.
        </p>
      </div>

      {/* تب‌های وضعیت */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_TABS.map((t) => {
          const count = t.key === "" ? totalAll : counts[t.key] || 0;
          const active = status === t.key;
          return (
            <button
              key={t.key || "all"}
              onClick={() => setStatus(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                active
                  ? "text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:text-gray-700"
              }`}
              style={active ? { background: "var(--color-primary)" } : {}}
            >
              {t.label}
              <span
                className={`mr-1.5 text-[11px] ${
                  active ? "opacity-90" : "text-[var(--color-primary)]"
                }`}
              >
                ({(count || 0).toLocaleString("fa-IR")})
              </span>
            </button>
          );
        })}
      </div>

      {/* فیلترها + جستجو */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch
            size={12}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در موضوع تیکت‌ها..."
            className="w-full h-9 pr-9 pl-3 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 placeholder:text-gray-300 outline-none focus:border-[var(--color-primary)] transition"
          />
        </div>

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className={selectCls}
        >
          <option value="">همه دپارتمان‌ها</option>
          {TICKET_DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {DEPARTMENT_LABELS[d]}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={selectCls}
        >
          <option value="">همه اولویت‌ها</option>
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>

        <select
          value={assignedAdmin}
          onChange={(e) => setAssignedAdmin(e.target.value)}
          className={selectCls}
        >
          <option value="">همه کارشناس‌ها</option>
          <option value="none">بدون کارشناس</option>
          {adminOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name || "کارشناس"}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className={selectCls}
        >
          <option value="lastMessageAt">آخرین فعالیت</option>
          <option value="createdAt">تاریخ ثبت</option>
          <option value="priority">اولویت</option>
        </select>
      </div>

      {/* لیست */}
      {loading ? (
        <div className="py-24 text-center text-gray-400 font-bold">
          در حال بارگذاری…
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-24 text-center">
          <FaInbox size={40} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400 font-bold">تیکتی با این شرایط یافت نشد.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {tickets.map((t) => (
              <motion.div
                key={t._id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Link
                  href={`/p-admin/support/tickets/${t._id}`}
                  className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-[var(--color-primary)]/30 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-gray-800 truncate">
                          {t.subject}
                        </h3>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            STATUS_BADGE[t.status] || STATUS_BADGE.open
                          }`}
                        >
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            PRIORITY_BADGE[t.priority] || PRIORITY_BADGE.medium
                          }`}
                        >
                          {PRIORITY_LABELS[t.priority] || t.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-bold mt-1">
                        {DEPARTMENT_LABELS[t.department] || t.department} · آخرین
                        فعالیت: {formatDate(t.lastMessageAt)}
                      </p>
                    </div>
                    <FaChevronLeft size={12} className="text-gray-300 mt-1.5" />
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-bold text-gray-500 mt-3 pt-3 border-t border-gray-50">
                    <span className="flex items-center gap-1.5">
                      <FaUser size={10} className="text-gray-300" />
                      {fullName(t.user) || "کاربر"}
                      {t.user?.phone ? (
                        <span className="text-gray-400 font-mono" dir="ltr">
                          {t.user.phone}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FaUserCheck
                        size={10}
                        className={
                          t.assignedAdmin ? "text-green-500" : "text-gray-300"
                        }
                      />
                      {t.assignedAdmin
                        ? fullName(t.assignedAdmin)
                        : "بدون کارشناس"}
                    </span>
                    {t.relatedOrder?.trackingCode ? (
                      <span className="flex items-center gap-1.5">
                        <FaBoxOpen size={10} className="text-gray-300" />
                        <span className="font-mono" dir="ltr">
                          {t.relatedOrder.trackingCode}
                        </span>
                      </span>
                    ) : null}
                    {t.relatedPayment ? (
                      <span className="flex items-center gap-1.5">
                        <FaMoneyBillWave size={10} className="text-gray-300" />
                        {Number(t.relatedPayment.amount || 0).toLocaleString(
                          "fa-IR"
                        )}{" "}
                        تومان
                      </span>
                    ) : null}
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
