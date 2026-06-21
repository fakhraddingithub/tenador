"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  FaInstagram,
  FaRegImage,
  FaRegPaperPlane,
  FaCheckDouble,
  FaExclamationTriangle,
} from "react-icons/fa";
import { ArrowRight, X, Loader2, MessageCircle } from "lucide-react";

/* ─── کمک‌تابع‌ها ─────────────────────────────────────────────────── */

// زمانِ نسبیِ فارسی برای فهرستِ گفتگوها
function relativeTime(date) {
  if (!date) return "";
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "الان";
  if (min < 60) return `${min.toLocaleString("fa-IR")} دقیقه`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr.toLocaleString("fa-IR")} ساعت`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day.toLocaleString("fa-IR")} روز`;
  return d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
}

// ساعتِ پیام داخلِ حباب
function clockTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Avatar({ src, name, size = 44 }) {
  const initial = (name || "?").trim().charAt(0) || "?";
  return src ? (
    <img
      src={src}
      alt={name || ""}
      width={size}
      height={size}
      className="rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg,#f9ce34,#ee2a7b 50%,#6228d7)",
        fontSize: size * 0.4,
      }}
    >
      {initial}
    </div>
  );
}

/* ─── کامپوننتِ اصلی ──────────────────────────────────────────────── */

export default function InstagramInbox() {
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState(null);

  const [thread, setThread] = useState(null); // { conversation, messages }
  const [loadingThread, setLoadingThread] = useState(false);

  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState(""); // URL آپلودشده آماده‌ی ارسال
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const activeIdRef = useRef(null);

  // نگه‌داشتنِ آخرین گفتگوی فعال در ref تا پولینگِ بی‌صدا بداند هنوز همان ترِد باز است
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  /* ── واکشیِ فهرستِ گفتگوها ── */
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/instagram/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {
      /* بی‌صدا — پولینگ دوباره تلاش می‌کند */
    } finally {
      setLoadingList(false);
    }
  }, []);

  /* ── واکشیِ ترِدِ فعال ── */
  const loadThread = useCallback(async (id, { silent = false } = {}) => {
    if (!id) return;
    if (!silent) setLoadingThread(true);
    try {
      const res = await fetch(`/api/admin/instagram/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      // فقط اگر هنوز همان گفتگو باز است نتیجه را اعمال کن
      if (activeIdRef.current === id) setThread(data);
    } catch {
      /* بی‌صدا */
    } finally {
      if (!silent) setLoadingThread(false);
    }
  }, []);

  /* ── علامتِ خوانده‌شدن ── */
  const markRead = useCallback(
    async (id) => {
      try {
        await fetch(`/api/admin/instagram/conversations/${id}/read`, {
          method: "POST",
        });
        // به‌روزرسانیِ خوش‌بینانه‌ی شمارش در فهرست
        setConversations((prev) =>
          prev.map((c) => (c._id === id ? { ...c, unreadCount: 0 } : c))
        );
      } catch {
        /* بی‌صدا */
      }
    },
    []
  );

  /* ── بازکردنِ یک گفتگو ── */
  const openConversation = useCallback(
    (id) => {
      setActiveId(id);
      setThread(null);
      setText("");
      setPendingImage("");
      loadThread(id);
      markRead(id);
    },
    [loadThread, markRead]
  );

  /* ── واکشیِ اولیه + پولینگِ فهرست (هر ۱۰ ثانیه) ── */
  useEffect(() => {
    loadConversations();
    const id = setInterval(loadConversations, 10000);
    return () => clearInterval(id);
  }, [loadConversations]);

  /* ── پولینگِ ترِدِ باز (هر ۶ ثانیه، بی‌صدا) ── */
  useEffect(() => {
    if (!activeId) return;
    const id = setInterval(() => {
      loadThread(activeId, { silent: true });
      markRead(activeId);
    }, 6000);
    return () => clearInterval(id);
  }, [activeId, loadThread, markRead]);

  /* ── اسکرول به پایین هنگام تغییرِ پیام‌ها ── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread?.messages?.length, activeId]);

  /* ── آپلودِ تصویر (به Cloudinary) ── */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "instagram-support");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در آپلود تصویر");
      setPendingImage(data.url);
    } catch (err) {
      toast.error(err.message || "خطا در آپلود تصویر");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ── ارسالِ پیام ── */
  const handleSend = async () => {
    const body = { text: text.trim(), imageUrl: pendingImage };
    if (!body.text && !body.imageUrl) return;
    if (sending) return;

    setSending(true);
    try {
      const res = await fetch(
        `/api/admin/instagram/conversations/${activeId}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "ارسال پیام ناموفق بود");
      }
      setText("");
      setPendingImage("");
      await loadThread(activeId, { silent: true });
      loadConversations();
    } catch (err) {
      toast.error(err.message || "ارسال پیام ناموفق بود");
      // ترِد را تازه کن تا پیامِ failed نمایش داده شود
      loadThread(activeId, { silent: true });
    } finally {
      setSending(false);
    }
  };

  const onComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeConvo = thread?.conversation;
  const withinWindow = activeConvo?.withinReplyWindow;

  return (
    <div className="w-full">
      {/* ── سرصفحه‌ی بخش ── */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md"
          style={{ background: "linear-gradient(135deg,#f9ce34,#ee2a7b 50%,#6228d7)" }}
        >
          <FaInstagram size={22} />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 leading-tight">
            پشتیبانی اینستاگرام
          </h1>
          <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
            خواندن و پاسخ به دایرکت‌ها — مستقیم از پنل
          </p>
        </div>
      </div>

      {/* ── قابِ چت دو‌ستونه ── */}
      <div
        className="flex rounded-2xl overflow-hidden border bg-white shadow-sm"
        style={{
          borderColor: "var(--admin-border)",
          height: "calc(100vh - 220px)",
          minHeight: 480,
        }}
      >
        {/* ─── ستونِ فهرستِ گفتگوها (راست در RTL) ─── */}
        <aside
          className={`w-full sm:w-[300px] sm:flex-shrink-0 flex-col border-l ${
            activeId ? "hidden sm:flex" : "flex"
          }`}
          style={{ borderColor: "var(--admin-border)" }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <span className="text-sm font-extrabold text-gray-900">دایرکت‌ها</span>
            <span className="text-[11px] font-bold text-gray-400">
              {conversations.length.toLocaleString("fa-IR")} گفتگو
            </span>
          </div>

          <div className="flex-1 overflow-y-auto admin-scrollbar">
            {loadingList ? (
              <ListSkeleton />
            ) : conversations.length === 0 ? (
              <EmptyList />
            ) : (
              conversations.map((c) => {
                const isActive = c._id === activeId;
                return (
                  <button
                    key={c._id}
                    onClick={() => openConversation(c._id)}
                    className={`w-full text-right flex items-center gap-3 px-3 py-3 transition-colors border-b border-gray-50 ${
                      isActive ? "bg-[rgba(170,71,37,0.06)]" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="relative">
                      <Avatar src={c.profilePic} name={c.name || c.username} />
                      {c.unreadCount > 0 && (
                        <span
                          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white"
                          style={{ background: "var(--color-primary)" }}
                        >
                          {c.unreadCount > 9 ? "۹+" : c.unreadCount.toLocaleString("fa-IR")}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {c.name || c.username || "کاربر اینستاگرام"}
                        </p>
                        <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">
                          {relativeTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          c.unreadCount > 0 ? "font-bold text-gray-700" : "text-gray-400"
                        }`}
                      >
                        {c.lastMessageFrom === "admin" && "شما: "}
                        {c.lastMessageText || "—"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ─── ستونِ پنجره‌ی چت (چپ در RTL) ─── */}
        <section
          className={`flex-1 flex-col min-w-0 bg-[#fafafa] ${
            activeId ? "flex" : "hidden sm:flex"
          }`}
        >
          {!activeId ? (
            <ChatPlaceholder />
          ) : (
            <>
              {/* هدرِ چت */}
              <div
                className="px-4 py-3 border-b bg-white flex items-center gap-3"
                style={{ borderColor: "var(--admin-border)" }}
              >
                <button
                  onClick={() => setActiveId(null)}
                  className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
                  aria-label="بازگشت به فهرست"
                >
                  <ArrowRight size={18} />
                </button>
                <Avatar
                  src={activeConvo?.profilePic}
                  name={activeConvo?.name || activeConvo?.username}
                  size={38}
                />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">
                    {activeConvo?.name || activeConvo?.username || "کاربر اینستاگرام"}
                  </p>
                  {activeConvo?.username && (
                    <p className="text-[11px] font-bold text-gray-400 truncate">
                      @{activeConvo.username}
                    </p>
                  )}
                </div>
              </div>

              {/* ناحیه‌ی پیام‌ها */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto admin-scrollbar px-4 py-4 flex flex-col gap-1.5"
              >
                {loadingThread ? (
                  <ThreadSkeleton />
                ) : (
                  (thread?.messages || []).map((m, i) => (
                    <MessageBubble key={m._id || i} message={m} />
                  ))
                )}
              </div>

              {/* بنرِ پنجره‌ی ۲۴ ساعته */}
              {!withinWindow && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
                  <FaExclamationTriangle size={13} className="text-amber-500 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-amber-700 leading-snug">
                    پنجره‌ی ۲۴ ساعته‌ی پاسخ‌گویی بسته است. اینستاگرام اجازه‌ی ارسالِ پیامِ
                    جدید را تا زمانی که کاربر دوباره پیام بدهد نمی‌دهد.
                  </p>
                </div>
              )}

              {/* پیش‌نمایشِ تصویرِ آماده‌ی ارسال */}
              <AnimatePresence>
                {pendingImage && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 bg-white border-t overflow-hidden"
                    style={{ borderColor: "var(--admin-border)" }}
                  >
                    <div className="py-2 inline-flex relative">
                      <img
                        src={pendingImage}
                        alt="پیش‌نمایش"
                        className="h-20 w-20 object-cover rounded-xl border border-gray-200"
                      />
                      <button
                        onClick={() => setPendingImage("")}
                        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                        aria-label="حذف تصویر"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* نوارِ نوشتنِ پیام */}
              <div
                className="px-3 py-2.5 border-t bg-white flex items-end gap-2"
                style={{ borderColor: "var(--admin-border)" }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || sending}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40"
                  aria-label="افزودن تصویر"
                  title="افزودن تصویر"
                >
                  {uploading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FaRegImage size={18} />
                  )}
                </button>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  rows={1}
                  placeholder="پیام خود را بنویسید…"
                  className="flex-1 resize-none max-h-32 px-4 py-2.5 rounded-2xl bg-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 leading-6"
                  style={{ minHeight: 40 }}
                />

                <button
                  onClick={handleSend}
                  disabled={sending || uploading || (!text.trim() && !pendingImage)}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                  style={{ background: "var(--color-primary)" }}
                  aria-label="ارسال پیام"
                >
                  {sending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FaRegPaperPlane size={16} className="-rotate-45" />
                  )}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─── حبابِ پیام ──────────────────────────────────────────────────── */

function MessageBubble({ message }) {
  const isAdmin = message.sender === "admin";
  const failed = message.status === "failed";

  return (
    <div
      className={`max-w-[78%] sm:max-w-[65%] flex flex-col ${
        isAdmin ? "self-end items-end" : "self-start items-start"
      }`}
    >
      <div
        className={`px-3.5 py-2 rounded-2xl text-sm leading-6 break-words ${
          isAdmin
            ? "text-white rounded-bl-md"
            : "bg-white text-gray-900 border border-gray-200 rounded-br-md"
        }`}
        style={
          isAdmin
            ? {
                background: failed
                  ? "#9ca3af"
                  : "linear-gradient(135deg,#aa4725,#c2562f)",
              }
            : undefined
        }
      >
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt=""
            className="rounded-xl mb-1 max-h-60 w-auto object-cover"
          />
        )}
        {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
      </div>

      <div className="flex items-center gap-1 mt-0.5 px-1">
        <span className="text-[10px] font-bold text-gray-400">
          {clockTime(message.createdAt)}
        </span>
        {isAdmin && !failed && (
          <FaCheckDouble size={10} className="text-gray-400" />
        )}
        {failed && (
          <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5">
            <FaExclamationTriangle size={9} /> ارسال نشد
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── حالت‌های خالی / اسکلتون ─────────────────────────────────────── */

function ChatPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
        style={{ background: "linear-gradient(135deg,#f9ce34,#ee2a7b 50%,#6228d7)" }}
      >
        <FaInstagram size={38} className="text-white" />
      </div>
      <p className="text-base font-extrabold text-gray-800">دایرکت‌های شما</p>
      <p className="text-sm text-gray-400 font-bold mt-1 max-w-xs">
        یک گفتگو را از فهرست انتخاب کنید تا پیام‌ها را ببینید و پاسخ دهید.
      </p>
    </div>
  );
}

function EmptyList() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <MessageCircle size={32} className="text-gray-300 mb-3" />
      <p className="text-sm font-bold text-gray-500">هنوز گفتگویی نیست</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
        به‌محضِ رسیدنِ اولین دایرکت، اینجا نمایش داده می‌شود.
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-11 h-11 rounded-full bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 rounded w-3/4" />
            <div className="h-2.5 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-3">
      {[
        "self-start w-40",
        "self-end w-52",
        "self-start w-32",
        "self-end w-44",
      ].map((cls, i) => (
        <div
          key={i}
          className={`h-9 rounded-2xl bg-gray-200/70 animate-pulse ${cls}`}
        />
      ))}
    </div>
  );
}
