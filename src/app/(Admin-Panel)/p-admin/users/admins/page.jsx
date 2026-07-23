'use client'

/**
 * مدیریت ادمین‌ها — زیربخش «مدیریت اعضا و کاربران»
 *
 * ⚠️ فاز فعلی فقط زیرساخت مدیریت ادمین/نقش/دسترسی است؛ هیچ محدودیتی هنوز
 * در صفحات پنل اعمال نمی‌شود.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'react-toastify'
import Swal from 'sweetalert2'
import {
  UserCog, Users, UserCheck, UserX, Shield, ShieldCheck, Search,
  Plus, Pencil, Trash2, ArrowRight, AtSign, Power,
} from 'lucide-react'

import RolesManager from '@/components/admin/admins/RolesManager'
import AdminLoader from '@/components/admin/AdminLoader'

export default function AdminAdminsManagement() {
  const router = useRouter()

  const [admins, setAdmins] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 })
  const [modules, setModules] = useState([])
  const [rolesCount, setRolesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [rolesOpen, setRolesOpen] = useState(false)

  const fetchData = async () => {
    try {
      const [adminsRes, permsRes, rolesRes] = await Promise.all([
        fetch('/api/admin/admins'),
        fetch('/api/admin/permissions'),
        fetch('/api/admin/roles'),
      ])
      const [adminsData, permsData, rolesData] = await Promise.all([
        adminsRes.json(),
        permsRes.json(),
        rolesRes.json(),
      ])

      if (adminsRes.ok) {
        setAdmins(adminsData.admins || [])
        setStats(adminsData.stats || { total: 0, active: 0, inactive: 0 })
      } else {
        toast.error(adminsData.message || 'خطا در دریافت ادمین‌ها')
      }

      setModules(permsData.modules || [])
      setRolesCount((rolesData.roles || []).length)
    } catch {
      toast.error('خطا در ارتباط با سرور')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // ─── فعال/غیرفعال‌سازی سریع ───
  const handleToggleActive = async (admin) => {
    const nextActive = !admin.isActive
    try {
      const res = await fetch(`/api/admin/admins/${admin._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'خطا در بروزرسانی')

      setAdmins((prev) =>
        prev.map((a) => (a._id === admin._id ? { ...a, isActive: nextActive } : a))
      )
      setStats((s) => ({
        ...s,
        active: s.active + (nextActive ? 1 : -1),
        inactive: s.inactive + (nextActive ? -1 : 1),
      }))
      toast.success(nextActive ? 'حساب ادمین فعال شد' : 'حساب ادمین غیرفعال شد')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (admin) => {
    const result = await Swal.fire({
      title: 'حذف ادمین؟',
      text: `حساب ادمین «${admin.name}» برای همیشه حذف می‌شود.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
    })
    if (!result.isConfirmed) return

    try {
      const res = await fetch(`/api/admin/admins/${admin._id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'خطا در حذف')
      toast.success(data.message)
      fetchData()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const filteredAdmins = admins.filter((admin) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      (admin.name || '').toLowerCase().includes(q) ||
      (admin.username || '').toLowerCase().includes(q) ||
      (admin.email || '').toLowerCase().includes(q) ||
      (admin.title || '').toLowerCase().includes(q) ||
      (admin.role?.name || '').toLowerCase().includes(q)
    const status = admin.isActive ? 'active' : 'inactive'
    const matchesStatus = statusFilter === 'all' || status === statusFilter
    return matchesSearch && matchesStatus
  })

  const kpiCards = [
    { label: 'کل ادمین‌ها', value: stats.total, icon: UserCog, bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'ادمین‌های فعال', value: stats.active, icon: UserCheck, bg: 'bg-emerald-50', color: 'text-emerald-600' },
    { label: 'غیرفعال', value: stats.inactive, icon: UserX, bg: 'bg-red-50', color: 'text-red-500' },
    { label: 'نقش‌های تعریف‌شده', value: rolesCount, icon: Shield, bg: 'bg-violet-50', color: 'text-violet-600' },
  ]

  if (loading) {
    return <AdminLoader />
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border"
        style={{ borderColor: '#e8e4df' }}
      >
        <div>
          <h1 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-1">
            <UserCog className="text-[var(--color-primary)]" size={20} />
            مدیریت ادمین‌ها
          </h1>
          <p className="text-xs font-bold text-gray-400">
            ساخت ادمین با نقش، عنوان و سطح دسترسی سفارشی — دسترسی‌ها در فاز بعدی اعمال می‌شوند
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRolesOpen(true)}
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-[var(--radius)] transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95 text-white"
            style={{ background: '#0d0d0d' }}
          >
            <Shield size={14} style={{ color: 'var(--color-secondary)' }} />
            مدیریت نقش‌ها
          </button>
          <button
            onClick={() => router.push('/p-admin/users/admins/add')}
            className="inline-flex items-center gap-2 text-white text-xs font-bold px-4 py-2.5 rounded-[var(--radius)] transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
            style={{ background: 'var(--color-primary)' }}
          >
            <Plus size={14} />
            افزودن ادمین
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow"
            style={{ borderColor: '#e8e4df' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 block mb-1">{card.label}</span>
                <span className="text-2xl font-bold text-gray-800">{card.value}</span>
              </div>
              <div className={`w-10 h-10 rounded-[var(--radius)] flex items-center justify-center ${card.bg} ${card.color}`}>
                <card.icon size={18} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#e8e4df' }}>
        {/* Filters bar */}
        <div
          className="p-4 border-b flex flex-col md:flex-row md:items-center gap-3"
          style={{ borderColor: '#f0ede9', background: '#faf9f8' }}
        >
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="جستجوی نام، نام کاربری، ایمیل، عنوان یا نقش..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-right rounded-[var(--radius)] border-2 border-gray-200 bg-white px-4 py-2 pr-9 text-xs font-bold focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all"
            />
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-[var(--radius)] text-xs font-bold text-gray-600">
            <Power size={12} className="text-gray-400" />
            <span>وضعیت:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-none font-bold text-gray-800 cursor-pointer"
            >
              <option value="all">همه</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          </div>
        </div>

        {/* Rows */}
        {filteredAdmins.length === 0 ? (
          <div className="py-16 text-center">
            <UserCog size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="text-xs font-bold text-gray-400">
              {admins.length === 0
                ? 'هنوز ادمینی ساخته نشده — با «افزودن ادمین» شروع کنید'
                : 'ادمینی با این فیلترها پیدا نشد'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f0ede9' }}>
            {filteredAdmins.map((admin, idx) => (
              <motion.div
                key={admin._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="p-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-gray-50/60 transition-colors"
              >
                {/* Identity */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                      admin.isActive ? '' : 'opacity-40'
                    }`}
                    style={{ background: 'var(--color-primary)' }}
                  >
                    {(admin.name || '?')[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[13px] font-bold text-gray-800 truncate">{admin.name}</h3>
                      {admin.title && (
                        <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                          {admin.title}
                        </span>
                      )}
                      {admin.role?.name && (
                        <span className="text-[9px] font-bold bg-violet-50 text-violet-600 border border-violet-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Shield size={9} />
                          {admin.role.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] font-bold text-gray-400">
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <AtSign size={10} />
                        {admin.username}
                      </span>
                      {admin.email && <span dir="ltr" className="truncate">{admin.email}</span>}
                    </div>
                  </div>
                </div>

                {/* Permission count + status + actions */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                    <ShieldCheck size={11} />
                    {admin.permissions?.length || 0} دسترسی
                  </span>

                  {/* Status toggle */}
                  <button
                    onClick={() => handleToggleActive(admin)}
                    title={admin.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      admin.isActive ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        admin.isActive ? 'right-0.5' : 'right-[22px]'
                      }`}
                    />
                  </button>
                  <span
                    className={`text-[10px] font-bold w-14 ${
                      admin.isActive ? 'text-emerald-600' : 'text-gray-400'
                    }`}
                  >
                    {admin.isActive ? 'فعال' : 'غیرفعال'}
                  </span>

                  <button
                    onClick={() => router.push(`/p-admin/users/admins/edit/${admin._id}`)}
                    className="w-8 h-8 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-900 hover:text-white transition-all flex items-center justify-center"
                    title="ویرایش ادمین و دسترسی‌ها"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(admin)}
                    className="w-8 h-8 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                    title="حذف ادمین"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Roles modal */}
      <RolesManager
        open={rolesOpen}
        onClose={() => setRolesOpen(false)}
        modules={modules}
        onRolesChanged={fetchData}
      />
    </div>
  )
}
