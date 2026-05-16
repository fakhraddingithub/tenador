'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import { 
  Users, UserCheck, UserX, ShieldAlert, Search, Filter, 
  MoreVertical, Shield, Ban, CheckCircle, Trash2, ArrowLeftRight,
  GraduationCap, ChevronLeft, ArrowUpRight, Award, Key
} from 'lucide-react'

export default function AdminUsersManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeMenu, setActiveMenu] = useState(null) // برای کنترل دراپ‌داون هر سطر

  // آمار کلیدی بالای صفحه
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    coaches: 0,
    banned: 0
  })

  useEffect(() => {
    fetchUsersData()
  }, [])

  const fetchUsersData = async () => {
    try {
      // در پروژه واقعی این بخش به API ادمین متصل می‌شود
      // const res = await fetch('/api/admin/users')
      // const data = await res.json()
      
      // دیتای ماک (Mock) فرضی برای نمایش کامل قابلیت‌ها
      const mockUsers = [
        { id: 1, name: 'علیرضا محمدی', email: 'alireza@gmail.com', phone: '09123456789', role: 'user', isCoach: false, status: 'active', createdAt: '1402/10/12' },
        { id: 2, name: 'سارا احمدی', email: 'sara@yahoo.com', phone: '09112223344', role: 'coach', isCoach: true, coachCode: 'TR-4921', status: 'active', createdAt: '1401/05/20' },
        { id: 3, name: 'رضا کریمی', email: 'karimi@gmail.com', phone: '09355556677', role: 'user', isCoach: false, status: 'banned', createdAt: '1402/11/01' },
        { id: 4, name: 'مهسا امینی', email: 'mahsa@gmail.com', phone: '09198887766', role: 'admin', isCoach: false, status: 'active', createdAt: '1400/01/15' },
        { id: 5, name: 'حسین حسینی', email: 'hossein@gmail.com', phone: '09301112233', role: 'user', isCoach: true, coachCode: 'TR-8812', status: 'active', createdAt: '1403/02/10' },
      ]
      
      setUsers(mockUsers)
      calculateStats(mockUsers)
    } catch {
      toast.error('خطا در بارگذاری اطلاعات کاربران')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    setStats({
      total: data.length,
      active: data.filter(u => u.status === 'active').length,
      coaches: data.filter(u => u.isCoach).length,
      banned: data.filter(u => u.status === 'banned').length
    })
  }

  // تغییر وضعیت مسدودیت کاربر
  const handleToggleBlock = (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'banned' : 'active'
    const updated = users.map(u => u.id === userId ? { ...u, status: nextStatus } : u)
    setUsers(updated)
    calculateStats(updated)
    setActiveMenu(null)
    toast.success(`وضعیت کاربر به ${nextStatus === 'banned' ? 'مسدود شده' : 'فعال'} تغییر یافت`)
  }

  // تغییر نقش کاربر (ادمین / کاربر عادی)
  const handleChangeRole = (userId, currentRole) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin'
    const updated = users.map(u => u.id === userId ? { ...u, role: nextRole } : u)
    setUsers(updated)
    setActiveMenu(null)
    toast.success(`نقش کاربر با موفقیت بروزرسانی شد`)
  }

  // فیلتر و جستجوی هوشمند در کلاینت
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery) ||
      (user.coachCode && user.coachCode.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesRole = roleFilter === 'all' || 
      (roleFilter === 'admin' && user.role === 'admin') ||
      (roleFilter === 'coach' && user.isCoach) ||
      (roleFilter === 'user' && user.role === 'user' && !user.isCoach)

    const matchesStatus = statusFilter === 'all' || user.status === statusFilter

    return matchesSearch && matchesRole && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--color-primary)]" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-right select-none" dir="rtl">
      
      {/* هدر اصلی پنل مدیریت */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-[var(--color-primary)]" size={24} />
            مدیریت اعضا و کاربران
          </h1>
          <p className="text-xs text-slate-400">دسترسی کامل به تنظیمات، نقش‌ها، سطوح دسترسی و وضعیت حساب کاربران سامانه</p>
        </div>

        {/* دکمه انتقال به بخش مدیریت مربیان (درخواستی شما) */}
        <button 
          onClick={() => window.location.href = '/p-admin/users/coaches'} // یا استفاده از روتر Next.js
          className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-colors px-5 py-3 rounded-xl text-xs font-bold shadow-md shadow-slate-900/10 group self-start sm:self-center"
        >
          <GraduationCap size={16} className="text-[var(--color-primary)]" />
          <span>بخش مدیریت و ارزیابی مربیان</span>
          <ArrowLeftRight size={14} className="text-slate-400 group-hover:translate-x-[-2px] transition-transform" />
        </button>
      </div>

      {/* باکس‌های آمار سریع (KPI Cards) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'کل کاربران', value: stats.total, icon: Users, color: 'bg-blue-50 text-blue-600 border-blue-100' },
          { label: 'کاربران فعال', value: stats.active, icon: UserCheck, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
          { label: 'مربیان رسمی', value: stats.coaches, icon: Award, color: 'bg-amber-50 text-amber-600 border-amber-100' },
          { label: 'حساب‌های مسدود', value: stats.banned, icon: UserX, color: 'bg-rose-50 text-rose-600 border-rose-100' },
        ].map((card, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 block">{card.label}</span>
              <span className="text-xl font-bold text-slate-800 tracking-tight">{card.value}</span>
            </div>
            <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${card.color}`}>
              <card.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* ابزارهای فیلتر، جستجو و ابزارک جدول */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          
          {/* باکس سرچ پیشرفته */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="جستجوی نام، ایمیل، تلفن یا کد مربی..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-right rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-xs font-medium transition-all focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <Search size={16} className="absolute right-3 top-3 text-slate-400" />
          </div>

          {/* منوهای فیلتر گزینه‌ای */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600">
              <Filter size={14} className="text-slate-400" />
              <span>فیلتر نقش:</span>
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-transparent border-none focus:outline-none pr-1 font-bold text-slate-800 cursor-pointer"
              >
                <option value="all">همه نقش‌ها</option>
                <option value="admin">مدیران (Admin)</option>
                <option value="coach">مربیان</option>
                <option value="user">کاربران عادی</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600">
              <ShieldAlert size={14} className="text-slate-400" />
              <span>وضعیت حساب:</span>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-none focus:outline-none pr-1 font-bold text-slate-800 cursor-pointer"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="active">فعال</option>
                <option value="banned">مسدود شده</option>
              </select>
            </div>
          </div>
        </div>

        {/* جدول اصلی دیتای کاربران */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 text-xs font-bold">
                <th className="p-4">مشخصات کاربر</th>
                <th className="p-4">اطلاعات تماس</th>
                <th className="p-4">نقش سیستمی</th>
                <th className="p-4">تاریخ عضویت</th>
                <th className="p-4">وضعیت</th>
                <th className="p-4 w-16">اقدامات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* نام و تصویر نمایشی */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full border bg-slate-100 flex items-center justify-center font-bold text-slate-600 uppercase text-xs">
                          {user.name.charAt(0)}
                        </div>
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 block text-xs md:text-sm">{user.name}</span>
                          {user.isCoach && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-md font-mono font-bold">
                              {user.coachCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* ایمیل و تلفن */}
                    <td className="p-4 text-xs font-medium space-y-1">
                      <span className="block text-slate-600 font-mono">{user.email}</span>
                      <span className="block text-slate-400 font-mono">{user.phone}</span>
                    </td>

                    {/* نقش */}
                    <td className="p-4">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                          <Shield size={12} /> مدیر کل
                        </span>
                      ) : user.isCoach ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                          <GraduationCap size={12} /> مربی رسمی
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          کاربر عادی
                        </span>
                      )}
                    </td>

                    {/* تاریخ عضویت */}
                    <td className="p-4 text-xs font-mono font-semibold text-slate-500">
                      {user.createdAt}
                    </td>

                    {/* وضعیت فعال یا مسدود */}
                    <td className="p-4">
                      {user.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> فعال
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> مسدود شده
                        </span>
                      )}
                    </td>

                    {/* مدیریت عملیات به صورت Dropdown ایزوله */}
                    <td className="p-4 relative">
                      <button 
                        onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                      >
                        <MoreVertical size={16} />
                      </button>

                      <AnimatePresence>
                        {activeMenu === user.id && (
                          <>
                            {/* لایه پشت کلیک برای بستن منو */}
                            <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                            
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -5 }}
                              className="absolute left-4 top-12 bg-white border border-slate-100 shadow-xl rounded-xl p-1.5 z-20 min-w-[160px] text-right space-y-0.5"
                            >
                              <button
                                onClick={() => handleToggleBlock(user.id, user.status)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-right transition-colors ${
                                  user.status === 'active' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {user.status === 'active' ? <Ban size={14} /> : <CheckCircle size={14} />}
                                {user.status === 'active' ? 'مسدودسازی حساب' : 'رفع مسدودیت'}
                              </button>

                              <button
                                onClick={() => handleChangeRole(user.id, user.role)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg text-right transition-colors"
                              >
                                <Key size={14} className="text-slate-400" />
                                {user.role === 'admin' ? 'تغییر به سطح کاربر' : 'ارتقا به سطح مدیر'}
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-xs text-slate-400 font-medium">
                    هیچ کاربری با فیلترها و مشخصات انتخاب شده پیدا نشد.
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