"use client";

/**
 * AdminTicketChat — صفحه‌ی گفتگوی یک تیکت در پنل ادمین
 *
 * تاریخچه‌ی کامل پیام‌ها (ادمین/کاربر متمایز)، اطلاعات کاربر و سفارش/پرداخت
 * مرتبط (با لینک به صفحات ادمین)، کامپوزر پاسخ با پیوست و گزینه‌ی
 * «در انتظار پاسخ کاربر»، بستن/بازکردن تیکت با تأیید SweetAlert2.
 * اولین پاسخ‌دهنده به‌صورت خودکار کارشناسِ تیکت می‌شود (سمت سرور).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  FaArrowRight,
  FaPaperPlane,
  FaPaperclip,
  FaLock,
  FaLockOpen,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaBoxOpen,
  FaMoneyBillWave,
  FaUserCheck,
  FaHeadset,
  FaFilePdf,
  FaTimes,
  FaSpinner,
  FaInbox,
} from "react-icons/fa";
import {
  DEPARTMENT_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "base/utils/ticketMeta";

const POLL_INTERVAL = 15000;
const MAX_FILES = 6;
const MAX_SIZE = 5 * 1024 * 1024;

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

/** PDFهای خصوصی ImageKit از طریق پراکسیِ امضاشده باز می‌شوند */
function attachmentHref(att) {
  if (att?.type === "pdf") {
    return `/api/files/pdf?url=${encodeURIComponent(att.url)}`;
  }
  return att?.url || "#";
}

/* ─── آپلودر پیوست (استایل ادمین) ────────────────────────────────────── */
// برای پاک‌شدن پیوست‌ها بعد از ارسال، والد با تغییر prop `key` این کامپوننت را remount می‌کند
function AdminAttachmentUploader({ onChange, disabled }) {
  const [items, setItems] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    onChange(
      items
        .filter((i) => i.url)
        .map((i) => ({
          url: i.url,
          type: i.isPdf ? "pdf" : "image",
          filename: i.filename,
          size: i.size,
        }))
    );
  }, [items]); // eslint-disable-line

  const uploading = items.some((i) => i.uploading);

  const uploadFile = async (file) => {
    const isPdf =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (!file.type.startsWith("image/") && !isPdf) {
      toast.error("فقط تصویر یا PDF مجاز است");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("حجم فایل نباید بیشتر از ۵ مگابایت باشد");
      return;
    }
    const id = crypto.randomUUID();
    setItems((prev) => [
      ...prev,
      { id, isPdf, filename: file.name, size: file.size, url: null, uploading: true },
    ]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "tickets");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در آپلود");
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, url: data.url, uploading: false } : i))
      );
    } catch {
      toast.error("آپلود پیوست ناموفق بود");
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_FILES - items.length;
    if (remaining <= 0) {
      toast.warning(`حداکثر ${MAX_FILES} پیوست مجاز است`);
    } else {
      await Promise.all(files.slice(0, remaining).map(uploadFile));
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((item) => (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-600 max-w-[160px]"
        >
          {item.isPdf ? <FaFilePdf size={11} className="text-red-400" /> : null}
          <span className="truncate" dir="ltr">
            {item.filename}
          </span>
          {item.uploading ? (
            <FaSpinner size={10} className="animate-spin text-gray-400" />
          ) : (
            <button
              type="button"
              onClick={() =>
                setItems((prev) => prev.filter((i) => i.id !== item.id))
              }
              className="text-gray-400 hover:text-red-500 transition"
            >
              <FaTimes size={10} />
            </button>
          )}
        </span>
      ))}
      <button
        type="button"
        disabled={disabled || uploading || items.length >= MAX_FILES}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50"
      >
        <FaPaperclip size={11} /> پیوست
      </button>
      <input
        ref={inputRef}
        type="file"
        onChange={handleFiles}
        className="hidden"
        accept="image/*,.pdf,application/pdf"
        multiple
      />
    </div>
  );
}

/* ─── حباب پیام ──────────────────────────────────────────────────────── */
function MessageBubble({ message }) {
  const mine = message.senderRole === "admin";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${mine ? "justify-start" : "justify-end"}`}
    >
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div
          className={`flex items-center gap-1.5 mb-1 text-[11px] font-black ${
            mine ? "text-[var(--color-primary)]" : "text-gray-400 justify-end"
          }`}
        >
          {mine ? (
            <>
              <FaHeadset size={10} />
              {fullName(message.sender) || "پشتیبانی"}
            </>
          ) : (
            <>
              {fullName(message.sender) || "کاربر"}
              <FaUser size={10} />
            </>
          )}
        </div>
        <div
          className={`px-3.5 py-2.5 text-sm leading-7 whitespace-pre-line break-words rounded-xl ${
            mine
              ? "text-white rounded-tr-[4px]"
              : "bg-white border border-gray-100 text-gray-700 shadow-sm rounded-tl-[4px]"
          }`}
          style={mine ? { background: "var(--color-primary)" } : {}}
        >
          {message.body}
          {message.attachments?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.attachments.map((att, i) =>
                att.type === "pdf" ? (
                  <a
                    key={i}
                    href={attachmentHref(att)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition ${
                      mine
                        ? "bg-white/15 border-white/25 text-white hover:bg-white/25"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <FaFilePdf size={11} />
                    <span className="max-w-[140px] truncate" dir="ltr">
                      {att.filename || "فایل PDF"}
                    </span>
                  </a>
                ) : (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-24 h-24 rounded-lg overflow-hidden border border-black/10 hover:opacity-90 transition"
                  >
                    <img
                      src={att.url}
                      alt={att.filename || "پیوست"}
                      className="w-full h-full object-cover"
                    />
                  </a>
                )
              )}
            </div>
          ) : null}
        </div>
        <p className={`mt-1 text-[10px] text-gray-400 font-bold ${mine ? "" : "text-left"}`}>
          {formatDate(message.createdAt)}
        </p>
      </div>
    </motion.div>
  );
}

/* ─── کامپوننت اصلی ──────────────────────────────────────────────────── */
export default function AdminTicketChat({ ticketId }) {
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [attachmentsResetKey, setAttachmentsResetKey] = useState(0);
  const [awaitUser, setAwaitUser] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const bottomRef = useRef(null);
  const firstLoadRef = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      try {
        const res = await fetch(`/api/admin/tickets/${ticketId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTicket(data.ticket);
        setMessages(data.messages || []);
        setError(false);
      } catch {
        if (!silent) setError(true);
      } finally {
        setLoading(false);
      }
    },
    [ticketId]
  );

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!messages.length) return;
    bottomRef.current?.scrollIntoView({
      behavior: firstLoadRef.current ? "auto" : "smooth",
      block: "end",
    });
    firstLoadRef.current = false;
  }, [messages.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!body.trim() && attachments.length === 0) {
      return toast.error("متن پاسخ یا حداقل یک پیوست الزامی است");
    }
    setSending(true);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: body.trim(), attachments, awaitUser }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "خطا در ارسال پاسخ");
      setBody("");
      setAttachments([]);
      setAttachmentsResetKey((k) => k + 1);
      setAwaitUser(false);
      toast.success("پاسخ ارسال شد");
      await load(true);
    } catch (err) {
      toast.error(err.message || "خطا در ارسال پاسخ");
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    const result = await Swal.fire({
      title: "بستن تیکت؟",
      text: "پس از بستن، کاربر تا بازکردن مجدد امکان ارسال پیام ندارد.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، بسته شود",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    if (!result.isConfirmed) return;
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "close" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "خطا در بستن تیکت");
      toast.success("تیکت بسته شد");
      await load(true);
    } catch (err) {
      toast.error(err.message || "خطا در بستن تیکت");
    } finally {
      setStatusBusy(false);
    }
  };

  const handleReopen = async () => {
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "reopen" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "خطا در بازکردن تیکت");
      toast.success("تیکت دوباره باز شد");
      await load(true);
    } catch (err) {
      toast.error(err.message || "خطا در بازکردن تیکت");
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400 font-bold" dir="rtl">
        در حال بارگذاری…
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div dir="rtl">
        <Link
          href="/p-admin/support?tab=tickets"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[var(--color-primary)] transition-colors"
        >
          <FaArrowRight size={11} /> بازگشت به تیکت‌ها
        </Link>
        <div className="py-24 text-center">
          <FaInbox size={40} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400 font-bold">تیکت یافت نشد.</p>
        </div>
      </div>
    );
  }

  const isClosed = ticket.status === "closed";
  const orderId = ticket.relatedOrder?._id;
  const paymentOrderId = ticket.relatedPayment?.order;

  return (
    <div dir="rtl">
      {/* هدر */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-black text-gray-800 truncate">
              {ticket.subject}
            </h1>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                STATUS_BADGE[ticket.status] || STATUS_BADGE.open
              }`}
            >
              {STATUS_LABELS[ticket.status] || ticket.status}
            </span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                PRIORITY_BADGE[ticket.priority] || PRIORITY_BADGE.medium
              }`}
            >
              {PRIORITY_LABELS[ticket.priority] || ticket.priority}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 font-bold mt-1">
            {DEPARTMENT_LABELS[ticket.department] || ticket.department} · ثبت:{" "}
            {formatDate(ticket.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isClosed ? (
            <button
              onClick={handleReopen}
              disabled={statusBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50"
            >
              <FaLockOpen size={11} /> بازکردن مجدد
            </button>
          ) : (
            <button
              onClick={handleClose}
              disabled={statusBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <FaLock size={11} /> بستن تیکت
            </button>
          )}
        </div>
      </div>

      {/* اطلاعات کاربر + موارد مرتبط */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-gray-500">
        <span className="flex items-center gap-1.5">
          <FaUser size={10} className="text-gray-300" />
          {fullName(ticket.user) || "کاربر"}
        </span>
        {ticket.user?.phone ? (
          <a
            href={`tel:${ticket.user.phone}`}
            className="flex items-center gap-1.5 hover:text-[var(--color-primary)]"
          >
            <FaPhone size={10} className="text-gray-300" />
            <span className="font-mono" dir="ltr">
              {ticket.user.phone}
            </span>
          </a>
        ) : null}
        {ticket.user?.email ? (
          <a
            href={`mailto:${ticket.user.email}`}
            className="flex items-center gap-1.5 hover:text-[var(--color-primary)]"
          >
            <FaEnvelope size={10} className="text-gray-300" />
            <span dir="ltr">{ticket.user.email}</span>
          </a>
        ) : null}
        <span className="flex items-center gap-1.5">
          <FaUserCheck
            size={10}
            className={ticket.assignedAdmin ? "text-green-500" : "text-gray-300"}
          />
          کارشناس: {fullName(ticket.assignedAdmin) || "بدون کارشناس"}
        </span>
        {orderId ? (
          <Link
            href={`/p-admin/admin-orders/${orderId}`}
            className="flex items-center gap-1.5 text-[var(--color-primary)] hover:underline"
          >
            <FaBoxOpen size={10} />
            سفارش:{" "}
            <span className="font-mono" dir="ltr">
              {ticket.relatedOrder.trackingCode}
            </span>
          </Link>
        ) : null}
        {ticket.relatedPayment ? (
          paymentOrderId ? (
            <Link
              href={`/p-admin/admin-orders/${paymentOrderId}`}
              className="flex items-center gap-1.5 text-[var(--color-primary)] hover:underline"
            >
              <FaMoneyBillWave size={10} />
              پرداخت:{" "}
              {Number(ticket.relatedPayment.amount || 0).toLocaleString("fa-IR")}{" "}
              تومان ({ticket.relatedPayment.status})
            </Link>
          ) : (
            <span className="flex items-center gap-1.5">
              <FaMoneyBillWave size={10} className="text-gray-300" />
              پرداخت:{" "}
              {Number(ticket.relatedPayment.amount || 0).toLocaleString("fa-IR")}{" "}
              تومان
            </span>
          )
        ) : null}
      </div>

      {/* پیام‌ها */}
      <div
        className="rounded-2xl border border-gray-100 p-4 space-y-4 min-h-[240px] mb-5"
        style={{ background: "var(--admin-bg)" }}
      >
        {messages.map((m) => (
          <MessageBubble key={m._id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* کامپوزر */}
      {isClosed ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-2 text-sm font-bold text-gray-500">
          <FaLock size={13} className="text-gray-300" />
          این تیکت بسته شده است. برای ادامه‌ی گفتگو ابتدا آن را باز کنید.
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3"
        >
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            placeholder="پاسخ خود را بنویسید..."
            className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder:text-gray-300 outline-none focus:border-[var(--color-primary)] transition resize-y"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <AdminAttachmentUploader
              key={attachmentsResetKey}
              onChange={setAttachments}
              disabled={sending}
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={awaitUser}
                  onChange={(e) => setAwaitUser(e.target.checked)}
                  className="accent-[var(--color-primary)]"
                />
                در انتظار پاسخ کاربر
              </label>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--color-primary)" }}
              >
                {sending ? (
                  <FaSpinner size={11} className="animate-spin" />
                ) : (
                  <FaPaperPlane size={11} className="-scale-x-100" />
                )}
                ارسال پاسخ
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 font-bold">
            با ارسال پاسخ، ایمیل اطلاع‌رسانی برای کاربر ارسال می‌شود و در صورت
            نداشتن کارشناس، تیکت به شما ارجاع می‌شود.
          </p>
        </form>
      )}
    </div>
  );
}
