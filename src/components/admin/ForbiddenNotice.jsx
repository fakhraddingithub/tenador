/**
 * src/components/admin/ForbiddenNotice.jsx
 *
 * پیامِ «دسترسی ندارید» — یک متن برای هر دو لایه:
 *   • صفحه‌ی /p-admin/403 (مقصدِ rewrite ـِ middleware، بارگذاریِ کامل)
 *   • نگهبانِ کلاینت در Layout (ناوبریِ نرم)
 *
 * بدون "use client": از هر دو سمت قابل رندر است.
 */

import Link from "next/link";
import { FaLock } from "react-icons/fa";

const REASONS = {
  "not-admin": {
    title: "به پنل مدیریت دسترسی ندارید",
    body: "این حساب عضویتِ فعالی در پنل مدیریت ندارد. اگر فکر می‌کنید اشتباهی رخ داده، با مدیر سیستم تماس بگیرید.",
    home: { href: "/", label: "بازگشت به فروشگاه" },
  },
  forbidden: {
    title: "دسترسی به این بخش ندارید",
    body: "نقشِ شما اجازه‌ی باز کردن این صفحه را نمی‌دهد. از منوی کناری می‌توانید به بخش‌هایی بروید که به آن‌ها دسترسی دارید.",
    home: { href: "/p-admin", label: "بازگشت به داشبورد" },
  },
};

export default function ForbiddenNotice({ reason }) {
  const view = REASONS[reason] || REASONS.forbidden;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4" dir="rtl">
      <div
        className="w-full max-w-md rounded-2xl border bg-white p-8 text-center"
        style={{ borderColor: "#e8e4df" }}
      >
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(170,71,37,0.08)", color: "var(--color-primary)" }}
        >
          <FaLock size={22} />
        </div>

        <h1 className="mb-2 text-lg font-bold text-gray-900">{view.title}</h1>
        <p className="text-xs font-bold leading-relaxed text-gray-500">{view.body}</p>

        <Link
          href={view.home.href}
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius)] px-5 py-2.5 text-xs font-bold text-white"
          style={{ background: "var(--color-primary)" }}
        >
          {view.home.label}
        </Link>
      </div>
    </div>
  );
}
