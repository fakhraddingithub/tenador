'use client';

/**
 * src/components/admin/admins/AdminForm.jsx
 *
 * فرم ساخت/ویرایش ادمین — اطلاعات حساب + نقش + انتخاب دقیق دسترسی‌ها.
 *
 * نکته معماری: انتخاب نقش، دسترسی‌های آن نقش را به‌صورت قالب روی چک‌باکس‌ها
 * اعمال می‌کند؛ ولی آنچه در دیتابیس ذخیره می‌شود همیشه آرایه permissions خودِ
 * ادمین است تا enforcement آینده فقط یک منبع داشته باشد.
 *
 * اگر adminId داده شود فرم در حالت ویرایش است.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';
import {
  UserCog, ArrowRight, Save, BadgeCheck, AtSign, Mail,
  Briefcase, Shield, Power, Wand2,
} from 'lucide-react';

import PermissionPicker from './PermissionPicker';

const emptyForm = {
  name: '',
  username: '',
  email: '',
  title: '',
  role: '',
  isActive: true,
  permissions: [],
};

export default function AdminForm({ adminId = null }) {
  const router = useRouter();
  const isEdit = !!adminId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState(emptyForm);

  // ─── بارگذاری رجیستری دسترسی‌ها، نقش‌ها و (در حالت ویرایش) خود ادمین ───
  useEffect(() => {
    const load = async () => {
      try {
        const requests = [
          fetch('/api/admin/permissions'),
          fetch('/api/admin/roles'),
        ];
        if (isEdit) requests.push(fetch(`/api/admin/admins/${adminId}`));

        const responses = await Promise.all(requests);
        const [permissionsData, rolesData, adminData] = await Promise.all(
          responses.map((res) => res.json())
        );

        setModules(permissionsData.modules || []);
        setRoles(rolesData.roles || []);

        if (isEdit) {
          if (!adminData?.admin) {
            toast.error(adminData?.message || 'ادمین یافت نشد');
            router.replace('/p-admin/users/admins');
            return;
          }
          const a = adminData.admin;
          setFormData({
            name: a.name || '',
            username: a.username || '',
            email: a.email || '',
            title: a.title || '',
            role: a.role?._id || '',
            isActive: a.isActive ?? true,
            permissions: a.permissions || [],
          });
        }
      } catch {
        toast.error('خطا در بارگذاری اطلاعات');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [adminId, isEdit]); // eslint-disable-line

  const updateField = (key, value) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  // انتخاب نقش — دسترسی‌های نقش به‌عنوان قالب روی چک‌باکس‌ها اعمال می‌شود
  const handleRoleChange = (roleId) => {
    updateField('role', roleId);

    if (!roleId) return;

    const role = roles.find((r) => r._id === roleId);
    if (role?.permissions?.length) {
      setFormData((prev) => ({
        ...prev,
        role: roleId,
        permissions: [...new Set([...prev.permissions, ...role.permissions])],
      }));
      toast.info(`دسترسی‌های نقش «${role.name}» اعمال شد — می‌توانید سفارشی‌سازی کنید`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) return toast.error('نام ادمین الزامی است');
    if (!formData.username.trim()) return toast.error('نام کاربری الزامی است');

    setSubmitting(true);

    try {
      const res = await fetch(
        isEdit ? `/api/admin/admins/${adminId}` : '/api/admin/admins',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            role: formData.role || null,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'خطا در ذخیره ادمین');

      toast.success(data.message);
      router.push('/p-admin/users/admins');
      router.refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border"
        style={{ borderColor: '#e8e4df' }}
      >
        <div>
          <Link
            href="/p-admin/users/admins"
            className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 hover:gap-2.5 transition-all"
            style={{ color: 'var(--color-primary)' }}
          >
            <ArrowRight size={12} /> بازگشت به مدیریت ادمین‌ها
          </Link>
          <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <UserCog className="text-[var(--color-primary)]" size={20} />
            {isEdit ? 'ویرایش ادمین' : 'افزودن ادمین جدید'}
          </h1>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 text-white text-xs font-bold px-6 py-3 rounded-[var(--radius)] transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          style={{ background: 'var(--color-primary)' }}
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {isEdit ? 'ذخیره تغییرات' : 'ایجاد ادمین'}
        </button>
      </div>

      {/* Account info */}
      <div
        className="bg-white rounded-2xl border p-5 space-y-4"
        style={{ borderColor: '#e8e4df' }}
      >
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b pb-3" style={{ borderColor: '#f0ede9' }}>
          <BadgeCheck size={16} className="text-[var(--color-primary)]" />
          اطلاعات حساب
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="نام و نام خانوادگی" icon={UserCog} required>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="مثلاً علی محمدی"
              className="field-input"
            />
          </Field>

          <Field label="نام کاربری (انگلیسی)" icon={AtSign} required>
            <input
              type="text"
              dir="ltr"
              value={formData.username}
              onChange={(e) => updateField('username', e.target.value)}
              placeholder="e.g. ali.mohammadi"
              className="field-input text-left"
            />
          </Field>

          <Field label="ایمیل" icon={Mail}>
            <input
              type="email"
              dir="ltr"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="admin@example.com"
              className="field-input text-left"
            />
          </Field>

          <Field label="عنوان/سمت" icon={Briefcase}>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="مثلاً مدیر فروش"
              className="field-input"
            />
          </Field>

          <Field label="نقش (قالب دسترسی)" icon={Shield}>
            <div className="flex items-center gap-2">
              <select
                value={formData.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="field-input flex-1 cursor-pointer"
              >
                <option value="">بدون نقش — دسترسی کاملاً سفارشی</option>
                {roles.map((role) => (
                  <option key={role._id} value={role._id}>
                    {role.name} ({role.permissions?.length || 0} دسترسی)
                  </option>
                ))}
              </select>
              <span
                title="با انتخاب نقش، دسترسی‌های آن به انتخاب فعلی اضافه می‌شود"
                className="w-9 h-9 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center flex-shrink-0"
              >
                <Wand2 size={15} />
              </span>
            </div>
          </Field>

          <Field label="وضعیت حساب" icon={Power}>
            <button
              type="button"
              onClick={() => updateField('isActive', !formData.isActive)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                formData.isActive
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <span
                className={`text-xs font-bold ${formData.isActive ? 'text-emerald-700' : 'text-red-500'}`}
              >
                {formData.isActive ? 'فعال — امکان استفاده از پنل' : 'غیرفعال — دسترسی معلق'}
              </span>
              <span
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  formData.isActive ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    formData.isActive ? 'right-0.5' : 'right-[22px]'
                  }`}
                />
              </span>
            </button>
          </Field>
        </div>
      </div>

      {/* Permissions */}
      <PermissionPicker
        modules={modules}
        selected={formData.permissions}
        onChange={(permissions) => updateField('permissions', permissions)}
      />

      {/* Bottom submit (برای فرم‌های بلند) */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 text-white text-sm font-bold px-6 py-4 rounded-2xl transition-all hover:shadow-lg active:scale-[0.99] disabled:opacity-50"
        style={{ background: '#0d0d0d' }}
      >
        {submitting ? (
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <Save size={15} style={{ color: 'var(--color-secondary)' }} />
        )}
        {isEdit ? 'ذخیره تغییرات ادمین' : 'ایجاد ادمین با دسترسی‌های انتخاب‌شده'}
      </button>

      <style jsx>{`
        .field-input {
          width: 100%;
          border: 2px solid #e5e7eb;
          border-radius: var(--radius);
          background: #fff;
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 700;
          transition: all 0.2s;
        }
        .field-input:focus {
          outline: none;
          border-color: var(--color-primary);
        }
      `}</style>
    </form>
  );
}

function Field({ label, icon: Icon, required = false, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5">
        <Icon size={12} className="text-gray-400" />
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
