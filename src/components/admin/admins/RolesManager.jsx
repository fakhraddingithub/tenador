'use client';

/**
 * src/components/admin/admins/RolesManager.jsx
 *
 * مدیریت نقش‌ها (مجموعه دسترسی‌های نام‌دار) — مودال روی صفحه مدیریت ادمین‌ها.
 * هر نقش با PermissionPicker همان UI گروه‌بندی‌شده دسترسی‌ها را دارد.
 */

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  X, Shield, Plus, Pencil, Trash2, ArrowRight, Save, Users,
} from 'lucide-react';

import PermissionPicker from './PermissionPicker';

const emptyRole = { name: '', description: '', permissions: [] };

export default function RolesManager({ open, onClose, modules, onRolesChanged }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // null = حالت لیست | { _id? , name, description, permissions } = فرم ساخت/ویرایش
  const [editingRole, setEditingRole] = useState(null);

  useEffect(() => {
    if (open) {
      fetchRoles();
      setEditingRole(null);
    }
  }, [open]);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/roles');
      const data = await res.json();
      if (res.ok) setRoles(data.roles || []);
      else toast.error(data.message || 'خطا در دریافت نقش‌ها');
    } catch {
      toast.error('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRole = async () => {
    if (!editingRole?.name?.trim()) return toast.error('نام نقش الزامی است');

    setSubmitting(true);
    try {
      const isEdit = !!editingRole._id;
      const res = await fetch(
        isEdit ? `/api/admin/roles/${editingRole._id}` : '/api/admin/roles',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editingRole.name,
            description: editingRole.description,
            permissions: editingRole.permissions,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'خطا در ذخیره نقش');

      toast.success(data.message);
      setEditingRole(null);
      fetchRoles();
      onRolesChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (role) => {
    const result = await Swal.fire({
      title: 'حذف نقش؟',
      text: `نقش «${role.name}» حذف می‌شود. ادمین‌ها حذف نمی‌شوند.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/roles/${role._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'خطا در حذف نقش');
      toast.success(data.message);
      fetchRoles();
      onRolesChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 md:p-8 overflow-y-auto" dir="rtl">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-4xl bg-[#faf9f8] rounded-3xl shadow-2xl my-4">
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b bg-white rounded-t-3xl sticky top-0 z-10"
          style={{ borderColor: '#f0ede9' }}
        >
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Shield size={17} className="text-[var(--color-primary)]" />
            {editingRole
              ? editingRole._id
                ? `ویرایش نقش «${editingRole.name}»`
                : 'ساخت نقش جدید'
              : 'مدیریت نقش‌ها'}
          </h2>
          <div className="flex items-center gap-2">
            {editingRole && (
              <button
                onClick={() => setEditingRole(null)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-[var(--radius)] bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-800 hover:text-white transition-all"
              >
                <ArrowRight size={13} />
                بازگشت به لیست نقش‌ها
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-gray-50 text-gray-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* ─── فرم ساخت/ویرایش نقش ─── */}
          {editingRole ? (
            <>
              <div
                className="bg-white rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
                style={{ borderColor: '#e8e4df' }}
              >
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500">نام نقش *</label>
                  <input
                    type="text"
                    value={editingRole.name}
                    onChange={(e) => setEditingRole((p) => ({ ...p, name: e.target.value }))}
                    placeholder="مثلاً مدیر محصولات"
                    className="w-full border-2 border-gray-200 rounded-[var(--radius)] bg-white px-4 py-2.5 text-xs font-bold focus:border-[var(--color-primary)] focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500">توضیحات</label>
                  <input
                    type="text"
                    value={editingRole.description}
                    onChange={(e) =>
                      setEditingRole((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="شرح کوتاه مسئولیت‌های این نقش"
                    className="w-full border-2 border-gray-200 rounded-[var(--radius)] bg-white px-4 py-2.5 text-xs font-bold focus:border-[var(--color-primary)] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <PermissionPicker
                modules={modules}
                selected={editingRole.permissions}
                onChange={(permissions) =>
                  setEditingRole((p) => ({ ...p, permissions }))
                }
              />

              <button
                onClick={handleSaveRole}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 text-white text-sm font-bold px-6 py-3.5 rounded-2xl transition-all hover:shadow-lg active:scale-[0.99] disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                {editingRole._id ? 'ذخیره تغییرات نقش' : 'ایجاد نقش'}
              </button>
            </>
          ) : (
            /* ─── لیست نقش‌ها ─── */
            <>
              <button
                onClick={() => setEditingRole({ ...emptyRole })}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-2xl py-4 text-xs font-bold text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all bg-white"
              >
                <Plus size={15} />
                ساخت نقش جدید (مجموعه دسترسی نام‌دار)
              </button>

              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-7 h-7 border-2 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin" />
                </div>
              ) : roles.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
                  <Shield size={28} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-xs font-bold text-gray-400">
                    هنوز نقشی ساخته نشده — نقش‌ها قالب‌های آماده دسترسی برای ساخت سریع‌تر ادمین‌ها هستند
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {roles.map((role) => (
                    <div
                      key={role._id}
                      className="bg-white rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      style={{ borderColor: '#e8e4df' }}
                    >
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-bold text-gray-800 flex items-center gap-2">
                          {role.name}
                          {role.isSystem && (
                            <span className="text-[9px] font-bold bg-violet-50 text-violet-600 border border-violet-100 px-2 py-0.5 rounded-full">
                              سیستمی
                            </span>
                          )}
                        </h3>
                        {role.description && (
                          <p className="text-[11px] font-bold text-gray-400 mt-0.5 truncate">
                            {role.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                          {role.permissions?.length || 0} دسترسی
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-100 px-2.5 py-1 rounded-full">
                          <Users size={11} />
                          {role.adminCount || 0} ادمین
                        </span>
                        <button
                          onClick={() =>
                            setEditingRole({
                              _id: role._id,
                              name: role.name,
                              description: role.description || '',
                              permissions: role.permissions || [],
                            })
                          }
                          className="w-8 h-8 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-900 hover:text-white transition-all flex items-center justify-center"
                          title="ویرایش نقش"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteRole(role)}
                          className="w-8 h-8 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                          title="حذف نقش"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
