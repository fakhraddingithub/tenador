"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  GraduationCap,
  Users,
  ClipboardList,
  Check,
  X,
  Eye,
  Loader2,
  ZoomIn,
  MessageSquare
} from "lucide-react";

export default function AdminCoachesManagement() {
  const [activeTab, setActiveTab] = useState("list"); // list | applications
  const [coaches, setCoaches] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  // استیت‌های مربوط به نمایش جزئیات مربی و شاگردانش
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [previewImage, setPreviewImage] = useState(null); // { url: '', title: '' }

  // استیت‌های مربوط به ریجکت کردن درخواست
  const [rejectingAppId, setRejectingAppId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

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

  // لود کردن شاگردان یک مربی مشخص
  const handleViewCoachDetails = async (coach) => {
    setSelectedCoach(coach);
    loadingStudents(true);
    try {
      const res = await fetch(`/api/admin/coaches?id=${coach._id}`);
      const data = await res.json();
      setStudents(data.students || []);
    } catch {
      toast.error("خطا در بارگذاری لیست شاگردان");
    } finally {
      setLoadingStudents(false);
    }
  };

  // هندلر تایید مربی شدن کاربر (منطبق با API جدید PUT)
  const handleApprove = async (userId) => {
    try {
      const res = await fetch(
        `/api/admin/coach-applications/${userId}/review`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approved" }),
        },
      );
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

  // هندلر نهایی کردن رد درخواست با دلیل (منطبق با API جدید PUT)
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim())
      return toast.warn("لطفاً دلیل رد درخواست را بنویسید");

    try {
      const res = await fetch(
        `/api/admin/coach-applications/${rejectingAppId}/review`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rejected",
            rejectionReason: rejectReason.trim(),
          }),
        },
      );
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
      {/* هدر صفحه و تب‌ها */}
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

        {/* سوییچ تب‌ها */}
        <div className="flex bg-slate-100 p-1 rounded-[var(--radius)] border border-slate-200/60 self-start">
          <button
            onClick={() => {
              setActiveTab("list");
              setSelectedCoach(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "list" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            <Users size={14} />
            لیست مربیان رسمی
          </button>
          <button
            onClick={() => {
              setActiveTab("applications");
              setSelectedCoach(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "applications" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            <ClipboardList size={14} />
            بررسی درخواست‌ها ({applications.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2
            className="animate-spin text-[var(--color-primary)]"
            size={32}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ستون اصلی سمت راست (لیست‌ها) */}
          <div className="lg:col-span-2 space-y-4">
            {activeTab === "list" ? (
              /* لایوت بخش لیست مربیان */
              <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50/60 border-b border-slate-100 font-bold text-xs text-slate-500">
                  لیست مربیان فعال در سیستم
                </div>
                <div className="divide-y divide-slate-100">
                  {coaches.length > 0 ? (
                    coaches.map((coach) => (
                      <div
                        key={coach._id}
                        className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {coach.avatar ? (
                            <img
                              src={coach.avatar}
                              className="h-10 w-10 rounded-full object-cover border border-slate-200"
                              alt={coach.name}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-slate-900 text-[var(--color-primary)] flex items-center justify-center font-bold text-xs">
                              {coach.name ? coach.name.charAt(0) : "م"}
                            </div>
                          )}
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">
                              {coach.name}
                            </h3>
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded-md font-bold mt-1 inline-block">
                              {coach.coachCode}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleViewCoachDetails(coach)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                        >
                          <Eye size={14} />
                          مشاهده شاگردان
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      هیچ مربی رسمی در سیستم یافت نشد.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* لایوت بخش بررسی درخواست‌های متقاضیان */
              <div className="space-y-5">
                {applications.length > 0 ? applications.map(app => (
                  <div
                    key={app._id}
                    className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] transition-all duration-300 space-y-5 relative overflow-hidden group"
                  >
                    {/* نوار رنگی تزئینی سمت راست کارت */}
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[var(--color-primary)] to-amber-400 opacity-70 group-hover:opacity-100 transition-opacity" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                          <h3 className="text-sm font-bold text-slate-800">
                            {app.coachApplication?.fullName || app.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-2">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">{app.phone}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-400">{app.email}</span>
                        </p>
                      </div>

                      {/* دکمه‌های عملیاتی */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleApprove(app._id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200/60 rounded-[var(--radius)] text-xs font-bold transition-all duration-200 shadow-2xs cursor-pointer"
                        >
                          <Check size={14} /> تایید مربیگری
                        </button>

                        {/* دکمه رد درخواست */}
                        <button
                          type="button"
                          onClick={() => {
                            console.log("کلیک شد روی کاربر:", app._id); // برای اطمینان در کنسول مرورگر
                            setRejectingAppId(app._id);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200/60 rounded-[var(--radius)] text-xs font-bold transition-all duration-200 shadow-2xs cursor-pointer"
                        >
                          <X size={14} /> رد درخواست
                        </button>
                      </div>
                    </div>

                    {/* تصاویر مدارک */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-2 bg-slate-50/50 p-3 rounded-[var(--radius)] border border-slate-100">
                        <span className="text-[11px] text-slate-500 block font-bold">تصویر پرسنلی متقاضی</span>
                        {app.coachApplication?.personalImage ? (
                          <div
                            onClick={() => setPreviewImage({ url: app.coachApplication.personalImage, title: `عکس پرسنلی - ${app.coachApplication?.fullName || app.name}` })}
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
                          <div
                            onClick={() => setPreviewImage({ url: app.coachApplication.certificateImage, title: `مدرک مربیگری - ${app.coachApplication?.fullName || app.name}` })}
                            className="relative h-28 w-full max-w-[200px] mx-auto rounded-[var(--radius)] overflow-hidden border border-slate-200 group/img cursor-pointer shadow-2xs"
                          >
                            <img src={app.coachApplication.certificateImage} className="h-full w-full object-cover group-hover/img:scale-105 transition-transform duration-300" alt="مدرک" />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                              <ZoomIn className="text-white backdrop-blur-xs p-1 rounded-lg bg-white/20" size={24} />
                            </div>
                          </div>
                        ) : (
                          <div className="mx-auto h-28 w-full max-w-[200px] bg-slate-100 rounded-[var(--radius)] flex items-center justify-center text-[10px] text-slate-400 border border-dashed border-slate-200">بدون مدرک آپلود شده</div>
                        )}
                      </div>
                    </div>

                    {/* انتقال مودال به داخل حلقه مپ جهت دسترسی مستقیم بدون تداخل */}
                    <AnimatePresence>
                      {rejectingAppId === app._id && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
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
                              <span>ثبت دلیل رد درخواست {app.coachApplication?.fullName || app.name}</span>
                            </div>

                            <div className="space-y-3">
                              <textarea
                                rows="3"
                                placeholder="علت رد شدن درخواست را بنویسید (این پیام به کاربر نمایش داده می‌شود)..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full rounded-[var(--radius)] border border-slate-200 p-3 text-xs font-medium focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 text-right"
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={(e) => handleRejectSubmit(e)}
                                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                >
                                  ثبت و رد درخواست
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setRejectingAppId(null); setRejectReason(''); }}
                                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  انصراف
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>

                  </div>
                )) : (
                  <div className="bg-white p-12 border border-slate-100 rounded-2xl text-center space-y-3 shadow-2xs">
                    <ClipboardList className="mx-auto text-slate-300" size={40} />
                    <p className="text-xs text-slate-400 font-bold">در حال حاضر هیچ درخواست مربیگری جدیدی در صف انتظار نیست.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ستون سمت چپ: نمایش جزئیات و شاگردان مربی انتخاب شده */}
          <div className="lg:col-span-1">
            <AnimatePresence mode="wait">
              {selectedCoach ? (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs space-y-4 sticky top-6"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold text-slate-800">
                      کارت مربی و هنرجویان
                    </span>
                    <button
                      onClick={() => setSelectedCoach(null)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-[var(--radius)] text-center space-y-2 border border-slate-100">
                    {selectedCoach.avatar ? (
                      <img
                        src={selectedCoach.avatar}
                        className="h-14 w-14 rounded-full object-cover mx-auto shadow-sm border border-slate-200"
                        alt={selectedCoach.name}
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-[var(--color-primary)] text-white mx-auto flex items-center justify-center font-bold text-lg shadow-sm">
                        {selectedCoach.name
                          ? selectedCoach.name.charAt(0)
                          : "م"}
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {selectedCoach.name}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {selectedCoach.email}
                      </p>
                    </div>
                  </div>

                  {/* لیست شاگردان متصل به این مربی */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Users size={14} /> لیست شاگردان تحت پوشش:
                    </span>

                    {loadingStudents ? (
                      <div className="flex py-6 justify-center">
                        <Loader2
                          className="animate-spin text-slate-400"
                          size={18}
                        />
                      </div>
                    ) : students.length > 0 ? (
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {students.map((std) => (
                          <div
                            key={std._id}
                            className="p-2.5 bg-slate-50/60 rounded-[var(--radius)] border border-slate-100 text-right space-y-0.5"
                          >
                            <span className="text-xs font-bold text-slate-700 block">
                              {std.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block">
                              {std.phone} | عضویت:{" "}
                              {std.createdAt
                                ? new Date(std.createdAt).toLocaleDateString(
                                  "fa-IR",
                                )
                                : "نامشخص"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-[11px] text-slate-400 bg-slate-50/50 rounded-[var(--radius)]">
                        این مربی هنوز هیچ شاگردی با کد معرف خود ندارد.
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="hidden lg:block bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 sticky top-6">
                  برای مشاهده اطلاعات تماس کامل و دیتای زنده شاگردان مربیان، روی
                  دکمه «مشاهده شاگردان» کلیک کنید.
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* مودال انیمیشنی وارد کردن دلیل رد درخواست (Rejection Reason Modal) */}
      {/* مودال نمایش تمام صفحه و باکیفیت تصاویر مدارک (Lightbox) */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* لایه تاریک پشت مودال */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImage(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            {/* باکس محتوای عکس */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full z-10 border border-slate-800 shadow-2xl relative"
            >
              {/* هدر لایت‌باکس */}
              <div
                className="bg-slate-900 text-white p-4 flex items-center justify-between"
                dir="rtl"
              >
                <span className="text-xs font-bold text-slate-200">
                  {previewImage.title}
                </span>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* فریم عکس بزرگ شده */}
              <div className="bg-slate-950 p-2 flex items-center justify-center max-h-[75vh] overflow-y-auto">
                <img
                  src={previewImage.url}
                  className="max-w-full h-auto object-contain rounded-lg shadow-md"
                  alt="بزرگنمایی مدرک"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
