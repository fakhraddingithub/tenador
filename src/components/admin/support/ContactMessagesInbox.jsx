"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  FaEnvelopeOpenText,
  FaCheck,
  FaArchive,
  FaTrash,
  FaPhone,
  FaEnvelope,
  FaBuilding,
  FaPaperclip,
  FaInbox,
} from "react-icons/fa";

const TABS = [
  { key: "new", label: "جدید" },
  { key: "read", label: "خوانده‌شده" },
  { key: "archived", label: "بایگانی" },
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

const STATUS_LABEL = { new: "جدید", read: "خوانده‌شده", archived: "بایگانی" };

export default function ContactMessagesInbox() {
  const [status, setStatus] = useState("new");
  const [messages, setMessages] = useState([]);
  const [counts, setCounts] = useState({ new: 0, read: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/contact-messages?status=${status}&limit=50`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages || []);
      setCounts(data.counts || { new: 0, read: 0, archived: 0 });
    } catch {
      toast.error("خطا در بارگذاری پیام‌ها");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const changeStatus = async (id, newStatus) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/contact-messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success("وضعیت پیام به‌روزرسانی شد");
      fetchMessages();
    } catch {
      toast.error("به‌روزرسانی ناموفق بود");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    const result = await Swal.fire({
      title: "حذف پیام؟",
      text: "این عمل قابل بازگشت نیست.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف کن",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    if (!result.isConfirmed) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/contact-messages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast.success("پیام حذف شد");
      fetchMessages();
    } catch {
      toast.error("حذف ناموفق بود");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
          <FaEnvelopeOpenText className="text-[var(--color-primary)]" /> پیام‌های تماس
        </h1>
        <p className="text-sm text-gray-400 font-bold mt-1">
          پیام‌های ارسالی از فرم «تماس با ما».
        </p>
      </div>

      {/* تب‌ها */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => {
          const count = t.key === "all" ? null : counts[t.key];
          const active = status === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                active
                  ? "text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:text-gray-700"
              }`}
              style={active ? { background: "var(--color-primary)" } : {}}
            >
              {t.label}
              {count ? (
                <span
                  className={`mr-1.5 text-[11px] ${
                    active ? "opacity-90" : "text-[var(--color-primary)]"
                  }`}
                >
                  ({count.toLocaleString("fa-IR")})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* لیست */}
      {loading ? (
        <div className="py-24 text-center text-gray-400 font-bold">
          در حال بارگذاری…
        </div>
      ) : messages.length === 0 ? (
        <div className="py-24 text-center">
          <FaInbox size={40} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400 font-bold">پیامی در این بخش وجود ندارد.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {messages.map((m) => (
              <motion.div
                key={m._id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-gray-800">
                        {m.firstName} {m.lastName}
                      </h3>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          m.status === "new"
                            ? "bg-amber-50 text-amber-600"
                            : m.status === "read"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {STATUS_LABEL[m.status]}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                      {formatDate(m.createdAt)}
                    </p>
                  </div>
                </div>

                {/* اطلاعات تماس */}
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-bold text-gray-500 mb-3">
                  <a
                    href={`mailto:${m.email}`}
                    className="flex items-center gap-1.5 hover:text-[var(--color-primary)]"
                    dir="ltr"
                  >
                    <FaEnvelope size={11} /> {m.email}
                  </a>
                  <a
                    href={`tel:${m.phone}`}
                    className="flex items-center gap-1.5 hover:text-[var(--color-primary)]"
                    dir="ltr"
                  >
                    <FaPhone size={11} /> {m.phone}
                  </a>
                  {m.company ? (
                    <span className="flex items-center gap-1.5">
                      <FaBuilding size={11} /> {m.company}
                    </span>
                  ) : null}
                </div>

                {/* متن */}
                <p className="text-sm text-gray-600 leading-7 bg-gray-50 rounded-xl p-3.5 whitespace-pre-line">
                  {m.message}
                </p>

                {/* پیوست */}
                {m.attachmentUrl ? (
                  <a
                    href={m.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[var(--color-primary)] hover:underline"
                  >
                    <FaPaperclip size={11} />
                    {m.attachmentType === "pdf" ? "مشاهده‌ی فایل PDF" : "مشاهده‌ی تصویر پیوست"}
                  </a>
                ) : null}

                {/* اکشن‌ها */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  {m.status !== "read" ? (
                    <ActionBtn
                      onClick={() => changeStatus(m._id, "read")}
                      disabled={busyId === m._id}
                      icon={<FaCheck size={11} />}
                      label="خوانده‌شد"
                    />
                  ) : null}
                  {m.status !== "archived" ? (
                    <ActionBtn
                      onClick={() => changeStatus(m._id, "archived")}
                      disabled={busyId === m._id}
                      icon={<FaArchive size={11} />}
                      label="بایگانی"
                    />
                  ) : null}
                  <ActionBtn
                    onClick={() => remove(m._id)}
                    disabled={busyId === m._id}
                    icon={<FaTrash size={11} />}
                    label="حذف"
                    danger
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, disabled, icon, label, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
        danger
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
      }`}
    >
      {icon} {label}
    </button>
  );
}
