"use client";

import Link from "next/link";
import { Loader2, LogIn } from "lucide-react";
import { useUser } from "@/components/features/auth/UserContext";
import NewTicketForm from "@/components/modules/tickets/NewTicketForm";

/**
 * درگاه پشتیبانی صفحه «تماس با ما».
 *
 * خودِ جریان ثبت تیکت تغییری نکرده است؛ کاربر واردشده همان فرم و API موجود
 * داشبورد را استفاده می‌کند و کاربر مهمان ابتدا برای ورود هدایت می‌شود.
 */
export default function ContactForm({ accent = "#aa4725" }) {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div
        className="h-full min-h-72 flex items-center justify-center rounded-[6px] border border-gray-100 bg-white shadow-xl"
        aria-live="polite"
        aria-label="در حال بررسی وضعیت ورود"
      >
        <Loader2
          size={28}
          className="animate-spin"
          style={{ color: accent }}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full min-h-72 flex flex-col items-center justify-center rounded-[6px] border border-gray-100 bg-white p-7 sm:p-9 text-center shadow-xl">
        <div
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            color: accent,
            background: `color-mix(in srgb, ${accent} 12%, white)`,
          }}
        >
          <LogIn size={26} aria-hidden="true" />
        </div>

        <h3 className="mb-2 text-xl font-black text-[var(--color-text)]">
          برای ارسال پیام، ابتدا وارد حساب خود شوید
        </h3>
        <p className="mb-6 max-w-sm text-sm leading-7 text-gray-500">
          پس از ورود یا ثبت‌نام می‌توانید درخواست خود را به‌صورت تیکت برای تیم
          پشتیبانی ارسال کنید.
        </p>

        <Link
          href="/login-register?callbackUrl=%2Fcontact"
          className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-black text-white transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ background: accent }}
        >
          <LogIn size={18} aria-hidden="true" />
          ورود یا ثبت‌نام
        </Link>
      </div>
    );
  }

  return <NewTicketForm />;
}
