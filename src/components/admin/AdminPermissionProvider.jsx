"use client";

/**
 * src/components/admin/AdminPermissionProvider.jsx
 *
 * تنها منبعِ دسترسیِ سمتِ کلاینت در پنل — همان دسترسیِ مؤثری که سرور محاسبه
 * کرده (resolveAdminContext) از layout پاس داده می‌شود، پس هیچ fetch ای لازم
 * نیست و هیچ «پرشِ hydration» (اول نشان بده، بعد پنهان کن) رخ نمی‌دهد.
 *
 * ⚠️ این لایه امنیت نیست؛ فقط UI است. اجرای واقعی در middleware
 * (ناوبری) و requireAdminPermission (API) است.
 */

import { createContext, useContext } from "react";
import { canAccessAdminRoute, hasPermission } from "@/lib/permissions";

const AdminPermissionContext = createContext(null);

/** خارج از Provider: هیچ‌چیز مجاز نیست (fail-closed). */
const DENY_ALL = {
  permissions: [],
  permissionSet: new Set(),
  isFullAccess: false,
  admin: null,
  can: () => false,
  canRoute: () => false,
};

export function AdminPermissionProvider({
  permissions,
  isFullAccess = false,
  admin = null,
  children,
}) {
  const permissionSet = new Set(Array.isArray(permissions) ? permissions : []);

  const value = {
    permissions: [...permissionSet],
    permissionSet,
    isFullAccess,
    admin,
    /** can("products.edit") | can(["a","b"], { mode: "any" }) */
    can: (required, options) => hasPermission(permissionSet, required, options),
    /** canRoute("/p-admin/admin-products/edit/123") — روتِ ناشناخته → false */
    canRoute: (route) => canAccessAdminRoute(permissionSet, route),
  };

  return (
    <AdminPermissionContext.Provider value={value}>
      {children}
    </AdminPermissionContext.Provider>
  );
}

export function useAdminPermissions() {
  return useContext(AdminPermissionContext) || DENY_ALL;
}

/**
 * فیلترِ آرایه‌ی آیتم‌های ناوبری بر اساس `href`.
 * آرایه را *قبل از* رندر کوتاه می‌کند تا جای خالی/placeholder غیرفعال نماند.
 */
export function useVisibleByRoute(items, getHref = (item) => item.href) {
  const { canRoute } = useAdminPermissions();
  return (items || []).filter((item) => canRoute(getHref(item)));
}
