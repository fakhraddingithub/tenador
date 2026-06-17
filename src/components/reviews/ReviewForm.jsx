"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { FiLock, FiCheckCircle, FiEdit3 } from "react-icons/fi";
import { useUser } from "@/components/features/auth/UserContext";
import RatingStars from "./RatingStars";

const MIN_TEXT = 3;
const MAX_TEXT = 1000;

/**
 * فرم ثبت نظر در صفحه‌ی محصول (نظر عمومی — بدون اتصال به سفارش).
 * فقط برای کاربرِ واردشده نمایش داده می‌شود؛ مهمان‌ها به ورود هدایت می‌شوند.
 */
export default function ReviewForm({ productId }) {
  const { user, loading } = useUser();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) {
    return (
      <div className="h-32 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
    );
  }

  // مهمان — هدایت به ورود
  if (!user) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-8 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#aa4725]/10">
          <FiLock className="h-5 w-5 text-[#aa4725]" />
        </div>
        <p className="text-sm font-bold text-gray-700">
          برای ثبت نظر وارد حساب کاربری خود شوید
        </p>
        <Link
          href="/login-register"
          className="rounded-lg bg-[#aa4725] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#933d1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725]/50"
        >
          ورود / ثبت‌نام
        </Link>
      </div>
    );
  }

  // پس از ثبت موفق
  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-6 py-8 text-center">
        <FiCheckCircle className="h-7 w-7 text-emerald-600" />
        <p className="text-sm font-bold text-emerald-800">نظر شما ثبت شد</p>
        <p className="text-xs text-emerald-700/80">
          پس از تأیید مدیر، نظرتان روی این صفحه نمایش داده می‌شود.
        </p>
      </div>
    );
  }

  const trimmedLen = text.trim().length;
  const valid = trimmedLen >= MIN_TEXT && trimmedLen <= MAX_TEXT;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          product: productId,
          text: text.trim(),
          rating: rating || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setDone(true);
        toast.success(data.message || "نظر شما ثبت شد");
      } else if (res.status === 401) {
        toast.error("ابتدا وارد حساب کاربری شوید");
      } else if (res.status === 409) {
        toast.info("شما قبلاً برای این محصول نظر ثبت کرده‌اید");
        setDone(true);
      } else {
        toast.error(data.message || "خطا در ثبت نظر");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-100 bg-white p-4 sm:p-5"
      dir="rtl"
    >
      <div className="mb-3 flex items-center gap-2">
        <FiEdit3 className="h-4 w-4 text-[#aa4725]" />
        <h4 className="text-sm font-bold text-[#1a1a1a]">دیدگاه خود را بنویسید</h4>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500">امتیاز شما:</span>
        <RatingStars value={rating} onChange={setRating} size={22} />
      </div>

      <label htmlFor="review-text" className="sr-only">
        متن نظر
      </label>
      <textarea
        id="review-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_TEXT}
        rows={4}
        placeholder="تجربه‌ی خود از این محصول را با دیگران به اشتراک بگذارید…"
        className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm leading-relaxed text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#aa4725]/40 focus:bg-white focus:ring-2 focus:ring-[#aa4725]/15"
      />

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-gray-400 tabular-nums">
          {trimmedLen}/{MAX_TEXT}
        </span>
        <button
          type="submit"
          disabled={!valid || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-[#aa4725] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#933d1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725]/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {submitting ? "در حال ثبت…" : "ثبت نظر"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        نظر شما پس از تأیید مدیر نمایش داده می‌شود.
      </p>
    </form>
  );
}
