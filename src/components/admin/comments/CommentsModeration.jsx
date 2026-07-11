"use client";

import { getUserFullName } from "base/utils/userName";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  FaRegCommentDots,
  FaCheck,
  FaTimes,
  FaTrash,
  FaStar,
  FaCheckCircle,
  FaUser,
  FaReply,
} from "react-icons/fa";
import RatingStars from "@/components/reviews/RatingStars";

const STATUS_TABS = [
  { key: "pending", label: "در انتظار" },
  { key: "approved", label: "تأییدشده" },
  { key: "rejected", label: "ردشده" },
  { key: "all", label: "همه" },
];

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

const STATUS_BADGE = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
};
const STATUS_LABEL = { pending: "در انتظار", approved: "تأییدشده", rejected: "ردشده" };

export default function CommentsModeration() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [comments, setComments] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/comments?status=${status}&page=${page}&limit=20`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
        setCounts(data.counts ?? { pending: 0, approved: 0, rejected: 0 });
        setPagination(data.pagination ?? { page: 1, pages: 1, total: 0 });
      } else if (res.status === 403) {
        toast.error("دسترسی غیرمجاز");
      } else {
        toast.error("خطا در بارگذاری نظرات");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const changeStatus = async (id, newStatus) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(newStatus === "approved" ? "نظر تأیید شد" : "نظر رد شد");
        // از فهرستِ فیلترِ فعلی حذف می‌شود (مگر در حالت «همه»)
        setComments((prev) =>
          status === "all"
            ? prev.map((c) => (c._id === id ? { ...c, status: newStatus } : c))
            : prev.filter((c) => c._id !== id)
        );
        setCounts((prev) => recountAfterChange(prev, comments, id, newStatus));
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.message || "خطا در بروزرسانی");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setBusyId(null);
    }
  };

  const deleteComment = async (id) => {
    const result = await Swal.fire({
      title: "حذف نظر؟",
      html: `<p style="font-family:Vazirmatn,sans-serif;direction:rtl;font-size:14px;color:#555;">این نظر برای همیشه حذف می‌شود.</p>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف شود",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#aa4725",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/comments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("نظر حذف شد");
        const removed = comments.find((c) => c._id === id);
        setComments((prev) => prev.filter((c) => c._id !== id));
        if (removed?.status in counts) {
          setCounts((prev) => ({ ...prev, [removed.status]: Math.max(0, prev[removed.status] - 1) }));
        }
      } else {
        toast.error("خطا در حذف");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#aa4725]/10">
          <FaRegCommentDots className="text-[#aa4725]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1a1a1a]">مدیریت نظرات</h1>
          <p className="text-xs text-[#9c9189]">تأیید، رد و حذف دیدگاه‌های کاربران</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = status === tab.key;
          const badge = counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                isActive
                  ? "bg-[#aa4725] text-white shadow-sm"
                  : "border border-[#e8e4df] bg-white text-gray-500 hover:border-[#aa4725]/30 hover:text-[#aa4725]"
              }`}
            >
              {tab.label}
              {tab.key !== "all" && badge > 0 && (
                <span
                  className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {badge.toLocaleString("fa-IR")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#aa4725] border-t-transparent" />
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e8e4df] bg-white p-12 text-center">
          <FaRegCommentDots className="mx-auto mb-3 text-4xl text-gray-200" />
          <p className="text-sm font-bold text-gray-400">نظری در این بخش وجود ندارد</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <motion.article
                key={c._id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-xl border border-[#e8e4df] bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Right: content */}
                  <div className="min-w-0 flex-1">
                    {/* user + product */}
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1a1a1a]">
                        <FaUser className="text-xs text-gray-400" />
                        {getUserFullName(c.user, c.user?.phone || "\u06a9\u0627\u0631\u0628\u0631 \u062d\u0630\u0641\u200c\u0634\u062f\u0647")}
                      </span>
                      {c.isVerifiedPurchase && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          <FaCheckCircle className="h-2.5 w-2.5" />
                          خرید تأییدشده
                        </span>
                      )}
                      {c.parent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                          <FaReply className="h-2.5 w-2.5" />
                          پاسخ
                        </span>
                      )}
                      {status === "all" && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[c.status]}`}
                        >
                          {STATUS_LABEL[c.status]}
                        </span>
                      )}
                    </div>

                    {/* product chip */}
                    {c.product && (
                      <a
                        href={c.product.slug ? `/products/${c.product.slug}` : "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-2 inline-flex items-center gap-2 rounded-lg border border-[#e8e4df] bg-[#f5f3f0] px-2.5 py-1.5 transition-colors hover:border-[#aa4725]/30"
                      >
                        {c.product.mainImage && (
                          <img
                            src={c.product.mainImage}
                            alt=""
                            className="h-7 w-7 rounded object-cover"
                          />
                        )}
                        <span className="max-w-[220px] truncate text-xs font-semibold text-gray-600">
                          {c.product.name}
                        </span>
                      </a>
                    )}

                    {/* rating */}
                    {c.rating > 0 && (
                      <div className="mb-2">
                        <RatingStars value={c.rating} size={14} />
                      </div>
                    )}

                    {/* text */}
                    <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
                      {c.text}
                    </p>

                    <p className="mt-2 text-[11px] text-gray-400">{formatDate(c.createdAt)}</p>
                  </div>

                  {/* Left: actions */}
                  <div className="flex flex-shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
                    {c.status !== "approved" && (
                      <button
                        disabled={busyId === c._id}
                        onClick={() => changeStatus(c._id, "approved")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <FaCheck className="text-[10px]" />
                        تأیید
                      </button>
                    )}
                    {c.status !== "rejected" && (
                      <button
                        disabled={busyId === c._id}
                        onClick={() => changeStatus(c._id, "rejected")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                      >
                        <FaTimes className="text-[10px]" />
                        رد
                      </button>
                    )}
                    <button
                      disabled={busyId === c._id}
                      onClick={() => deleteComment(c._id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <FaTrash className="text-[10px]" />
                      حذف
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-[#e8e4df] bg-white px-4 py-2 text-xs font-bold text-gray-600 disabled:opacity-40"
              >
                قبلی
              </button>
              <span className="text-xs text-gray-500 tabular-nums">
                صفحه {page.toLocaleString("fa-IR")} از{" "}
                {pagination.pages.toLocaleString("fa-IR")}
              </span>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-[#e8e4df] bg-white px-4 py-2 text-xs font-bold text-gray-600 disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// شمارش‌ها را پس از تغییر وضعیتِ یک نظر به‌روزرسانی می‌کند (برای بَج تب‌ها)
function recountAfterChange(counts, list, id, newStatus) {
  const current = list.find((c) => c._id === id);
  if (!current) return counts;
  const next = { ...counts };
  if (current.status in next) next[current.status] = Math.max(0, next[current.status] - 1);
  if (newStatus in next) next[newStatus] = (next[newStatus] || 0) + 1;
  return next;
}
