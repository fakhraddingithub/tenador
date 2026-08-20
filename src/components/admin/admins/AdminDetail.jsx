"use client";

/**
 * src/components/admin/admins/AdminDetail.jsx
 *
 * صفحه‌ی جزئیاتِ یک ادمین (فاز ۶): هویت، وضعیت، نقش، دسترسیِ مؤثر،
 * صفحه‌هایی که واقعاً می‌تواند باز کند، و خطِ زمانیِ فعالیتش.
 *
 * دسترسیِ مؤثر همین‌جا از رجیستری محاسبه می‌شود (همان تابعی که سرور استفاده
 * می‌کند) تا «آنچه نشان داده می‌شود» و «آنچه اعمال می‌شود» یکی بماند.
 */

import Link from "next/link";
import useSWR from "swr";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCheckCircle,
  FiEdit3,
  FiFileText,
  FiShield,
  FiSlash,
  FiUser,
} from "react-icons/fi";

import AdminLoader from "@/components/admin/AdminLoader";
import ActivityTimeline from "@/components/admin/admins/ActivityTimeline";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";
import {
  ADMIN_ROUTE_PERMISSIONS,
  canAccessAdminRoute,
  computeEffectivePermissions,
  getVisibleSections,
} from "@/lib/permissions";

function Card({ title, icon: Icon, children, className = "" }) {
  return (
    <section
      className={`bg-white rounded-2xl border overflow-hidden ${className}`}
      style={{ borderColor: "#e8e4df" }}
    >
      <header
        className="flex items-center gap-2 border-b p-4 text-sm font-bold text-gray-800"
        style={{ borderColor: "#f0ede9" }}
      >
        {Icon ? <Icon size={15} className="text-[var(--color-primary)]" /> : null}
        {title}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Row({ label, value, dir }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[11px] font-bold text-gray-400">{label}</span>
      <span className="truncate text-xs font-bold text-gray-800" dir={dir}>
        {value || "—"}
      </span>
    </div>
  );
}

export default function AdminDetail({ adminId }) {
  const { can, canRoute } = useAdminPermissions();
  const { data, isLoading, error } = useSWR(`/api/admin/admins/${adminId}`);

  if (isLoading) return <AdminLoader />;

  if (error || !data?.admin) {
    return (
      <div className="mx-auto max-w-md py-24 text-center" dir="rtl">
        <p className="text-sm font-bold text-gray-500">ادمین یافت نشد</p>
        <Link
          href="/p-admin/users/admins"
          className="mt-3 inline-block text-xs font-bold text-[var(--color-primary)]"
        >
          بازگشت به فهرست ادمین‌ها
        </Link>
      </div>
    );
  }

  const admin = data.admin;
  const user = admin.user || null;

  // همان محاسبه‌ای که resolveAdminContext روی سرور انجام می‌دهد.
  const effective = computeEffectivePermissions({
    rolePermissions: admin.role?.permissions || [],
    grants: admin.permissionGrants || [],
    denials: admin.permissionDenials || [],
    fullAccess: !!admin.role?.isFullAccess,
  });

  const sections = getVisibleSections(effective);
  const openablePages = Object.keys(ADMIN_ROUTE_PERMISSIONS).filter((route) =>
    canAccessAdminRoute(effective, route)
  );

  // عضویتی که کاربرِ متصل ندارد یا کاربرش مسدود است، عملاً غیرقابل‌استفاده است.
  const unusable = !user || user.isBanned || !admin.isActive;

  return (
    <div className="space-y-5" dir="rtl">
      {/* ─── سربرگ ─── */}
      <div
        className="flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "#e8e4df" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/p-admin/users/admins"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:text-[var(--color-primary)]"
            aria-label="بازگشت"
          >
            <FiArrowRight size={14} />
          </Link>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-base font-bold text-gray-900">
              {admin.name || "بدون نام"}
              {admin.isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <FiCheckCircle size={10} /> فعال
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  <FiSlash size={10} /> لغو‌شده
                </span>
              )}
            </h1>
            <p className="truncate text-[11px] font-bold text-gray-400">
              {admin.title || "بدون عنوان"}
            </p>
          </div>
        </div>

        {canRoute(`/p-admin/users/admins/edit/${adminId}`) ? (
          <Link
            href={`/p-admin/users/admins/edit/${adminId}`}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-xs font-bold text-white"
            style={{ background: "var(--color-primary)" }}
          >
            <FiEdit3 size={13} /> ویرایش ادمین
          </Link>
        ) : null}
      </div>

      {unusable ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">
          <FiAlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          <span>
            {!user
              ? "این عضویت به هیچ کاربری متصل نیست، پس به هیچ نشستی نگاشت نمی‌شود و قابل استفاده نیست."
              : user.isBanned
                ? "کاربرِ متصل مسدود است؛ تا رفع مسدودیت هیچ دسترسی‌ای ندارد."
                : "این عضویت لغو شده است؛ دسترسی‌های زیر تا فعال‌سازی دوباره اعمال نمی‌شوند."}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ─── هویت ─── */}
        <Card title="هویت" icon={FiUser}>
          <Row label="نام" value={admin.name} />
          <Row label="نام کاربری" value={admin.username} dir="ltr" />
          <Row label="شماره تماس" value={user?.phone} dir="ltr" />
          <Row label="ایمیل" value={user?.email} dir="ltr" />
          <Row
            label="کاربرِ متصل"
            value={
              user && canRoute(`/p-admin/users/${user._id}`) ? (
                <Link href={`/p-admin/users/${user._id}`} className="text-[var(--color-primary)] underline underline-offset-4">
                  مشاهده پروفایل
                </Link>
              ) : user ? (
                "متصل"
              ) : (
                "ندارد"
              )
            }
          />
        </Card>

        {/* ─── نقش و دسترسی ─── */}
        <Card title="نقش و دسترسی" icon={FiShield}>
          <Row label="نقش" value={admin.role?.name} />
          <Row
            label="نوع نقش"
            value={admin.role?.isFullAccess ? "دسترسی کامل" : admin.role ? "معمولی" : "بدون نقش"}
          />
          <Row
            label="کلیدهای مؤثر"
            value={effective.length.toLocaleString("fa-IR")}
          />
          <Row
            label="دسترسی اختصاصی"
            value={`${(admin.permissionGrants || []).length.toLocaleString("fa-IR")} افزوده · ${(
              admin.permissionDenials || []
            ).length.toLocaleString("fa-IR")} برداشته`}
          />
          <Row label="صفحه‌های قابل باز کردن" value={openablePages.length.toLocaleString("fa-IR")} />
        </Card>

        {/* ─── بخش‌های در دسترس ─── */}
        <Card title="بخش‌های در دسترس" icon={FiFileText}>
          {sections.length ? (
            <ul className="space-y-2">
              {sections.map((section) => (
                <li key={section.key}>
                  <p className="text-xs font-bold text-gray-800">{section.title}</p>
                  <p className="text-[10px] font-bold text-gray-400">
                    {section.modules.map((mod) => mod.title).join("، ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-bold text-gray-400">به هیچ بخشی دسترسی ندارد</p>
          )}
        </Card>
      </div>

      {/* ─── خطِ زمانی ─── */}
      {can("admins.viewActivity") ? (
        <ActivityTimeline
          actorUser={user?._id ? String(user._id) : null}
          title={`تاریخچه فعالیت ${admin.name || ""}`.trim()}
          lastLoginAt={admin.lastLoginAt || null}
        />
      ) : (
        <div
          className="rounded-2xl border bg-white p-6 text-center text-xs font-bold text-gray-400"
          style={{ borderColor: "#e8e4df" }}
        >
          دسترسی مشاهده تاریخچه فعالیت را ندارید
        </div>
      )}
    </div>
  );
}
