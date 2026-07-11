"use client";

import { getUserFullName } from "base/utils/userName";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import AdminLoader from "@/components/admin/AdminLoader";
import {
  GraduationCap,
  Users,
  ClipboardList,
  Check,
  X,
  ZoomIn,
  MessageSquare,
  ChevronLeft,
  Wallet,
  Clock,
  FileText,
} from "lucide-react";

// تشخیص PDF بودن مدرک آپلودشده (برای نمایش به‌جای تصویر)
const isPdfUrl = (url) => typeof url === "string" && /\.pdf(\?|$)/i.test(url);

// نمایش PDF از طریق پراکسی سرور (Cloudinary تحویل مستقیم PDF را مسدود می‌کند)
const pdfViewerUrl = (url) => `/api/files/pdf?url=${encodeURIComponent(url)}`;

export default function AdminCoachesManagement() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("list");
  const [coaches, setCoaches] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);
  const [rejectingAppId, setRejectingAppId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // باز شدن مستقیم تب درخواست‌ها از طریق ?tab=applications (لینک اعلان)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "applications") setActiveTab("applications");
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "list") {
        const res = await fetch("/api/admin/coaches");
        const data = await res.json();
        setCoaches(data.coaches || []);
      } else {
        const res = await fetch("/api/admin/coach-applications");
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      const res = await fetch(`/api/admin/coach-applications/${userId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approved" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "مربی با موفقیت تایید شد");
        setApplications((p) => p.filter((item) => item._id !== userId));
      } else {
        toast.error(data.message || "خطا در تایید درخواست");
      }
    } catch {
      toast.error("اتصال با سرور برقرار نشد");
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return toast.warn("لطفاً دلیل رد درخواست را بنویسید");
    try {
      const res = await fetch(`/api/admin/coach-applications/${rejectingAppId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rejected", rejectionReason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "درخواست مربیگری رد شد");
        setApplications((p) => p.filter((item) => item._id !== rejectingAppId));
        setRejectingAppId(null);
        setRejectReason("");
      } else {
        toast.error(data.message || "خطا در ثبت اطلاعات");
      }
    } catch {
      toast.error("خطا در ثبت اطلاعات");
    }
  };

  const totalUnreviewed = coaches.reduce((sum, c) => sum + (c.unreviewedOrderCount || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
        <div className="space-y-0.5">
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap className="text-[var(--color-primary)]" size={22} />
            مدیریت و ارزیابی مربیان
          </h1>
          <p className="text-xs text-slate-400">
            بررسی صلاحیت متقاضیان مربیگری و رصد مربیان فعال به همراه هنرجویان
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-[var(--radius)] border border-slate-200/60 self-start">
          <button
            onClick={() => setActiveTab("list")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "list" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            <Users size={14} />
            لیست مربیان رسمی
          </button>
          <button
            onClick={() => setActiveTab("applications")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "applications" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            <ClipboardList size={14} />
            بررسی درخواست‌ها ({applications.length})
          </button>
        </div>
      </div>

      {loading ? (
        <AdminLoader />
      ) : activeTab === "list" ? (
        /* ── Coaches List ─────────────────────────────────────────────── */
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-500">لیست مربیان فعال در سیستم</span>
            {totalUnreviewed > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500 text-white px-2.5 py-1 rounded-full">
                <Clock size={10} />
                {totalUnreviewed} سفارش بررسی نشده
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {coaches.length > 0 ? (
              coaches.map((coach) => (
                <button
                  key={coach._id}
                  onClick={() => router.push(`/p-admin/users/coaches/${coach._id}`)}
                  className={`w-full flex items-center gap-3 p-4 text-right transition-all group cursor-pointer ${
                    coach.hasUnreviewed
                      ? "bg-amber-50/50 hover:bg-amber-50 border-r-4 border-amber-400"
                      : "hover:bg-slate-50/60"
                  }`}
                >
                  {/* Avatar */}
                  {coach.avatar ? (
                    <img
                      src={coach.avatar}
                      className="h-10 w-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                      alt={getUserFullName(coach)}
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-900 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {getUserFullName(coach) ? getUserFullName(coach).charAt(0) : "م"}
                    </div>
                  )}

                  {/* Name + code + unreviewed badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-800 truncate">{getUserFullName(coach)}</h3>
                      {coach.hasUnreviewed && (
                        <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                          {coach.unreviewedOrderCount} سفارش جدید
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded-md font-bold inline-block mt-0.5">
                      {coach.coachCode}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-800">
                        {(coach.studentCount || 0).toLocaleString("fa-IR")}
                      </p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-center">
                        <Users size={9} /> شاگرد
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-emerald-600">
                        {(coach.walletBalance || 0).toLocaleString("fa-IR")}
                      </p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-center">
                        <Wallet size={9} /> تومان
                      </p>
                    </div>
                  </div>

                  <ChevronLeft
                    size={14}
                    className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0"
                  />
                </button>
              ))
            ) : (
              <div className="p-10 text-center text-xs text-slate-400">
                هیچ مربی رسمی در سیستم یافت نشد.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Applications ─────────────────────────────────────────────── */
        <div className="space-y-5">
          {applications.length > 0 ? (
            applications.map((app) => (
              <div
                key={app._id}
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] transition-all duration-300 space-y-5 relative overflow-hidden group"
              >
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[var(--color-primary)] to-amber-400 opacity-70 group-hover:opacity-100 transition-opacity" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <h3 className="text-sm font-bold text-slate-800">
                        {app.coachApplication?.fullName || getUserFullName(app)}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-2">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">{app.phone}</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-400">{app.email}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleApprove(app._id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200/60 rounded-[var(--radius)] text-xs font-bold transition-all duration-200 shadow-2xs cursor-pointer"
                    >
                      <Check size={14} /> تایید مربیگری
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingAppId(app._id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200/60 rounded-[var(--radius)] text-xs font-bold transition-all duration-200 shadow-2xs cursor-pointer"
                    >
                      <X size={14} /> رد درخواست
                    </button>
                  </div>
                </div>

                {/* Application images */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-2 bg-slate-50/50 p-3 rounded-[var(--radius)] border border-slate-100">
                    <span className="text-[11px] text-slate-500 block font-bold">تصویر پرسنلی متقاضی</span>
                    {app.coachApplication?.personalImage ? (
                      <div
                        onClick={() => setPreviewImage({ url: app.coachApplication.personalImage, title: `عکس پرسنلی - ${app.coachApplication?.fullName || getUserFullName(app)}` })}
                        className="relative h-28 w-28 mx-auto rounded-[var(--radius)] overflow-hidden border border-slate-200 group/img cursor-pointer shadow-2xs"
                      >
                        <img src={app.coachApplication.personalImage} className="h-full w-full object-cover group-hover/img:scale-105 transition-transform duration-300" alt="پرسنلی" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <ZoomIn className="text-white backdrop-blur-xs p-1 rounded-lg bg-white/20" size={24} />
                        </div>
                      </div>
                    ) : (
                      <div className="mx-auto h-28 w-28 bg-slate-100 rounded-[var(--radius)] flex items-center justify-center text-[10px] text-slate-400 border border-dashed border-slate-200">بدون تصویر پرسنلی</div>
                    )}
                  </div>

                  <div className="space-y-2 bg-slate-50/50 p-3 rounded-[var(--radius)] border border-slate-100">
                    <span className="text-[11px] text-slate-500 block font-bold">حکم یا مدرک رسمی مربیگری</span>
                    {app.coachApplication?.certificateImage ? (
                      isPdfUrl(app.coachApplication.certificateImage) ? (
                        // مدرک PDF: باز کردن در تب جدید (پیش‌نمایش تصویری ممکن نیست)
                        <a
                          href={pdfViewerUrl(app.coachApplication.certificateImage)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative h-28 w-full max-w-[200px] mx-auto rounded-[var(--radius)] overflow-hidden border border-slate-200 group/img cursor-pointer shadow-2xs bg-rose-50 flex flex-col items-center justify-center gap-1.5 text-rose-600 hover:bg-rose-100 transition-colors"
                        >
                          <FileText size={28} />
                          <span className="text-[11px] font-bold">مشاهده مدرک PDF</span>
                        </a>
                      ) : (
                        <div
                          onClick={() => setPreviewImage({ url: app.coachApplication.certificateImage, title: `مدرک مربیگری - ${app.coachApplication?.fullName || getUserFullName(app)}` })}
                          className="relative h-28 w-full max-w-[200px] mx-auto rounded-[var(--radius)] overflow-hidden border border-slate-200 group/img cursor-pointer shadow-2xs"
                        >
                          <img src={app.coachApplication.certificateImage} className="h-full w-full object-cover group-hover/img:scale-105 transition-transform duration-300" alt="مدرک" />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                            <ZoomIn className="text-white backdrop-blur-xs p-1 rounded-lg bg-white/20" size={24} />
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="mx-auto h-28 w-full max-w-[200px] bg-slate-100 rounded-[var(--radius)] flex items-center justify-center text-[10px] text-slate-400 border border-dashed border-slate-200">بدون مدرک آپلود شده</div>
                    )}
                  </div>
                </div>

                {/* Reject modal */}
                <AnimatePresence>
                  {rejectingAppId === app._id && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setRejectingAppId(null)}
                        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="bg-white rounded-2xl p-5 max-w-sm w-full z-10 space-y-4 relative border border-slate-100 shadow-2xl"
                      >
                        <div className="flex items-center gap-1.5 text-rose-600 font-bold text-sm border-b border-slate-100 pb-2.5">
                          <MessageSquare size={16} />
                          <span>ثبت دلیل رد درخواست {app.coachApplication?.fullName || getUserFullName(app)}</span>
                        </div>
                        <div className="space-y-3">
                          <textarea
                            rows="3"
                            placeholder="علت رد شدن درخواست را بنویسید..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full rounded-[var(--radius)] border border-slate-200 p-3 text-xs font-medium focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 text-right"
                          />
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={handleRejectSubmit}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer">
                              ثبت و رد درخواست
                            </button>
                            <button type="button" onClick={() => { setRejectingAppId(null); setRejectReason(""); }}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer">
                              انصراف
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            ))
          ) : (
            <div className="bg-white p-12 border border-slate-100 rounded-2xl text-center space-y-3 shadow-2xs">
              <ClipboardList className="mx-auto text-slate-300" size={40} />
              <p className="text-xs text-slate-400 font-bold">در حال حاضر هیچ درخواست مربیگری جدیدی در صف انتظار نیست.</p>
            </div>
          )}
        </div>
      )}

      {/* Image lightbox */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPreviewImage(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full z-10 border border-slate-800 shadow-2xl relative"
            >
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between" dir="rtl">
                <span className="text-xs font-bold text-slate-200">{previewImage.title}</span>
                <button onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>
              <div className="bg-slate-950 p-2 flex items-center justify-center max-h-[75vh] overflow-y-auto">
                <img src={previewImage.url} className="max-w-full h-auto object-contain rounded-lg shadow-md" alt="بزرگنمایی مدرک" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
