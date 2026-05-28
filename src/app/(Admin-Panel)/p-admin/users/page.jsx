'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Swal from 'sweetalert2'
import {
  Users, UserCheck, UserX, ShieldAlert, Search, Filter,
  MoreVertical, Shield, Ban, CheckCircle, ArrowLeftRight,
  GraduationCap, Award, Key
} from 'lucide-react'

const swalTheme = {
  confirmButtonColor: 'var(--color-primary)',
  cancelButtonColor: '#9ca3af',
  customClass: {
    popup: 'rounded-2xl font-[Vazirmatn] text-right',
    confirmButton: 'rounded-[var(--radius)] font-bold',
    cancelButton: 'rounded-[var(--radius)] font-bold',
  },
  rtl: true,
};

export default function AdminUsersManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeMenu, setActiveMenu] = useState(null)
  const [stats, setStats] = useState({ total: 0, active: 0, coaches: 0, banned: 0 })

  useEffect(() => { fetchUsersData() }, [])

  const fetchUsersData = async () => {
    try {
      const mockUsers = [
        { id: 1, name: 'علیرضا محمدی', email: 'alireza@gmail.com', phone: '09123456789', role: 'user', isCoach: false, status: 'active', createdAt: '۱۴۰۲/۱۰/۱۲' },
        { id: 2, name: 'سارا احمدی', email: 'sara@yahoo.com', phone: '09112223344', role: 'coach', isCoach: true, coachCode: 'TR-4921', status: 'active', createdAt: '۱۴۰۱/۰۵/۲۰' },
        { id: 3, name: 'رضا کریمی', email: 'karimi@gmail.com', phone: '09355556677', role: 'user', isCoach: false, status: 'banned', createdAt: '۱۴۰۲/۱۱/۰۱' },
        { id: 4, name: 'مهسا امینی', email: 'mahsa@gmail.com', phone: '09198887766', role: 'admin', isCoach: false, status: 'active', createdAt: '۱۴۰۰/۰۱/۱۵' },
        { id: 5, name: 'حسین حسینی', email: 'hossein@gmail.com', phone: '09301112233', role: 'user', isCoach: true, coachCode: 'TR-8812', status: 'active', createdAt: '۱۴۰۳/۰۲/۱۰' },
      ]
      setUsers(mockUsers)
      calculateStats(mockUsers)
    } catch { /* handle */ } finally { setLoading(false) }
  }

  const calculateStats = (data) => {
    setStats({
      total: data.length,
      active: data.filter(u => u.status === 'active').length,
      coaches: data.filter(u => u.isCoach).length,
      banned: data.filter(u => u.status === 'banned').length,
    })
  }

  const handleToggleBlock = (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'banned' : 'active'
    const updated = users.map(u => u.id === userId ? { ...u, status: nextStatus } : u)
    setUsers(updated)
    calculateStats(updated)
    setActiveMenu(null)
  }

  const handleChangeRole = (userId, currentRole) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin'
    const updated = users.map(u => u.id === userId ? { ...u, role: nextRole } : u)
    setUsers(updated)
    setActiveMenu(null)
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery) ||
      (user.coachCode && user.coachCode.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'admin' && user.role === 'admin') ||
      (roleFilter === 'coach' && user.isCoach) ||
      (roleFilter === 'user' && user.role === 'user' && !user.isCoach)
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const kpiCards = [
    { label: 'کل کاربران', value: stats.total, icon: Users, bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'کاربران فعال', value: stats.active, icon: UserCheck, bg: 'bg-emerald-50', color: 'text-emerald-600' },
    { label: 'مربیان رسمی', value: stats.coaches, icon: Award, bg: 'bg-amber-50', color: 'text-amber-600' },
    { label: 'حساب‌های مسدود', value: stats.banned, icon: UserX, bg: 'bg-red-50', color: 'text-red-500' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5" dir="rtl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border" style={{ borderColor: '#e8e4df' }}>
        <div>
          <h1 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-1">
            <Users className="text-[var(--color-primary)]" size={20} />
            مدیریت اعضا و کاربران
          </h1>
          <p className="text-xs font-bold text-gray-400">دسترسی کامل به نقش‌ها، سطوح دسترسی و وضعیت حساب‌ها</p>
        </div>
        <button
          onClick={() => window.location.href = '/p-admin/users/coaches'}
          className="inline-flex items-center gap-2 text-white text-xs font-bold px-4 py-2.5 rounded-[var(--radius)] transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
          style={{ background: '#0d0d0d' }}
        >
          <GraduationCap size={15} style={{ color: 'var(--color-secondary)' }} />
          مدیریت مربیان
          <ArrowLeftRight size={13} className="opacity-50" />
        </button>
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

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#e8e4df' }}>
        {/* Filters bar */}
        <div className="p-4 border-b flex flex-col md:flex-row md:items-center gap-3" style={{ borderColor: '#f0ede9', background: '#faf9f8' }}>
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="جستجوی نام، ایمیل، تلفن یا کد مربی..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-right rounded-[var(--radius)] border-2 border-gray-200 bg-white px-4 py-2 pr-9 text-xs font-bold focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all"
            />
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-[var(--radius)] text-xs font-bold text-gray-600">
              <Filter size={12} className="text-gray-400" />
              <span>نقش:</span>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-transparent border-none focus:outline-none font-bold text-gray-800 cursor-pointer">
                <option value="all">همه</option>
                <option value="admin">مدیران</option>
                <option value="coach">مربیان</option>
                <option value="user">کاربران</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-[var(--radius)] text-xs font-bold text-gray-600">
              <ShieldAlert size={12} className="text-gray-400" />
              <span>وضعیت:</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent border-none focus:outline-none font-bold text-gray-800 cursor-pointer">
                <option value="all">همه</option>
                <option value="active">فعال</option>
                <option value="banned">مسدود</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="border-b text-xs font-bold text-gray-500 uppercase" style={{ borderColor: '#f0ede9', background: '#faf9f8' }}>
                <th className="p-4">مشخصات کاربر</th>
                <th className="p-4">اطلاعات تماس</th>
                <th className="p-4">نقش</th>
                <th className="p-4">تاریخ عضویت</th>
                <th className="p-4">وضعیت</th>
                <th className="p-4 w-14">اقدام</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#f5f3f0' }}>
              {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/60 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-[var(--radius)] flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                        style={{ background: 'var(--color-primary)' }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-gray-800 text-xs block">{user.name}</span>
                        {user.isCoach && (
                          <span className="inline-flex items-center gap-1 text-[9px] bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-lg font-bold font-mono mt-0.5">
                            {user.coachCode}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-xs font-bold space-y-0.5">
                    <span className="block text-gray-600 font-mono">{user.email}</span>
                    <span className="block text-gray-400 font-mono">{user.phone}</span>
                  </td>
                  <td className="p-4">
                    {user.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-[var(--radius)] border border-purple-100">
                        <Shield size={11} /> مدیر کل
                      </span>
                    ) : user.isCoach ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-[var(--radius)] border border-amber-100">
                        <GraduationCap size={11} /> مربی
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-[var(--radius)]">
                        کاربر عادی
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-xs font-bold text-gray-400 font-mono">{user.createdAt}</td>
                  <td className="p-4">
                    {user.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> فعال
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> مسدود
                      </span>
                    )}
                  </td>
                  <td className="p-4 relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-[var(--radius)] hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical size={15} />
                    </button>
                    <AnimatePresence>
                      {activeMenu === user.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-4 top-12 bg-white border border-gray-100 shadow-xl rounded-2xl p-1.5 z-20 min-w-[160px] text-right"
                            style={{ borderColor: '#e8e4df' }}
                          >
                            <button
                              onClick={() => handleToggleBlock(user.id, user.status)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-[var(--radius)] transition-colors ${user.status === 'active' ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            >
                              {user.status === 'active' ? <Ban size={13} /> : <CheckCircle size={13} />}
                              {user.status === 'active' ? 'مسدودسازی' : 'رفع مسدودیت'}
                            </button>
                            <button
                              onClick={() => handleChangeRole(user.id, user.role)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-[var(--radius)] transition-colors"
                            >
                              <Key size={13} className="text-gray-400" />
                              {user.role === 'admin' ? 'تغییر به کاربر' : 'ارتقا به مدیر'}
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-xs font-bold text-gray-400">
                    هیچ کاربری با این مشخصات یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}