'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'react-toastify'
import AdminLoader from '@/components/admin/AdminLoader'
import {
  ArrowRight, User, Mail, Phone, Calendar, Save, Edit3, X,
  Shield, GraduationCap, Wallet, Ban, CheckCircle2, MapPin,
  Package, CreditCard, Users as UsersIcon, Award, Star, ChevronLeft,
  Loader2, Hash
} from 'lucide-react'

const roleOptions = [
  { value: 'user', label: 'کاربر عادی' },
  { value: 'coach', label: 'مربی' },
  { value: 'seller', label: 'فروشنده' },
  { value: 'national_player', label: 'ورزشکار ملی' },
  { value: 'admin', label: 'مدیر کل' },
]

const levelLabels = { 0: 'عادی', 1: 'نقره‌ای', 2: 'طلایی', 3: 'پلاتینیوم' }

const paymentStatusMap = {
  UNPAID: { label: 'پرداخت نشده', cls: 'text-red-600 bg-red-50' },
  PARTIALLY_PAID: { label: 'پرداخت جزئی', cls: 'text-amber-700 bg-amber-50' },
  PAID: { label: 'پرداخت شده', cls: 'text-emerald-700 bg-emerald-50' },
}
const fulfillmentStatusMap = {
  WAITING: { label: 'در انتظار', cls: 'text-gray-600 bg-gray-100' },
  PROCESSING: { label: 'در حال پردازش', cls: 'text-blue-700 bg-blue-50' },
  SENT: { label: 'ارسال شده', cls: 'text-indigo-700 bg-indigo-50' },
  DELIVERED: { label: 'تحویل شده', cls: 'text-emerald-700 bg-emerald-50' },
  CANCELED: { label: 'لغو شده', cls: 'text-red-600 bg-red-50' },
}
const paymentRowStatusMap = {
  PENDING: { label: 'در انتظار', cls: 'text-amber-700 bg-amber-50' },
  PAID: { label: 'موفق', cls: 'text-emerald-700 bg-emerald-50' },
  FAILED: { label: 'ناموفق', cls: 'text-red-600 bg-red-50' },
  REJECTED: { label: 'رد شده', cls: 'text-red-600 bg-red-50' },
}

const fmtToman = (n) => (Number(n) || 0).toLocaleString('fa-IR') + ' تومان'
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fa-IR') : '—')

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border p-5 ${className}`} style={{ borderColor: '#e8e4df' }}>
      {children}
    </div>
  )
}

function SectionTitle({ icon: Icon, title, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={17} className="text-[var(--color-primary)]" />
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      {typeof count === 'number' && (
        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  )
}

export default function AdminUserDetailsPage() {
  const { userId } = useParams()
  const router = useRouter()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      const json = await res.json()
      if (res.ok) {
        setData(json)
        const u = json.user
        setForm({
          name: u.name || '',
          email: u.email || '',
          phone: u.phone || '',
          role: u.role || 'user',
          level: u.level ?? 0,
          walletBalance: u.walletBalance ?? 0,
          isBanned: !!u.isBanned,
        })
      } else {
        toast.error(json.message || 'خطا در دریافت اطلاعات کاربر')
      }
    } catch {
      toast.error('خطا در ارتباط با سرور')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (userId) fetchData() }, [userId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (res.ok) {
        setData((d) => ({ ...d, user: json.user }))
        setEditing(false)
        toast.success(json.message || 'تغییرات ذخیره شد')
      } else {
        toast.error(json.message || 'خطا در ذخیره تغییرات')
      }
    } catch {
      toast.error('خطا در ارتباط با سرور')
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    const u = data.user
    setForm({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || 'user',
      level: u.level ?? 0,
      walletBalance: u.walletBalance ?? 0,
      isBanned: !!u.isBanned,
    })
    setEditing(false)
  }

  if (loading) {
    return <AdminLoader />
  }

  if (!data?.user) {
    return (
      <div className="p-10 text-center" dir="rtl">
        <p className="text-sm font-bold text-gray-500">کاربر یافت نشد.</p>
        <button onClick={() => router.push('/p-admin/users')} className="mt-4 text-xs font-bold text-[var(--color-primary)]">
          بازگشت به لیست کاربران
        </button>
      </div>
    )
  }

  const { user, addresses, orders, payments, students } = data

  return (
    <div className="space-y-5" dir="rtl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border" style={{ borderColor: '#e8e4df' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/p-admin/users')}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius)] hover:bg-gray-100 text-gray-500"
          >
            <ArrowRight size={18} />
          </button>
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white" style={{ background: 'var(--color-primary)' }}>
              {(user.name || '؟').charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
              {user.name || 'بدون نام'}
              {user.isBanned && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  <Ban size={10} /> مسدود
                </span>
              )}
            </h1>
            <p className="text-xs font-bold text-gray-400 font-mono mt-0.5">{user.phone || user.email || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2.5 rounded-[var(--radius)] disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                ذخیره تغییرات
              </button>
              <button
                onClick={cancelEdit}
                className="inline-flex items-center gap-1.5 text-gray-600 bg-gray-100 hover:bg-gray-200 text-xs font-bold px-4 py-2.5 rounded-[var(--radius)]"
              >
                <X size={14} /> انصراف
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2.5 rounded-[var(--radius)]"
              style={{ background: '#0d0d0d' }}
            >
              <Edit3 size={14} /> ویرایش اطلاعات
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left/main column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Profile / editable info */}
          <Card>
            <SectionTitle icon={User} title="اطلاعات حساب کاربری" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'name', label: 'نام و نام خانوادگی', icon: User, type: 'text' },
                { key: 'email', label: 'ایمیل', icon: Mail, type: 'email' },
                { key: 'phone', label: 'شماره تلفن', icon: Phone, type: 'tel' },
              ].map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 block">{f.label}</label>
                  {editing ? (
                    <div className="relative">
                      <input
                        type={f.type}
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full text-right rounded-[var(--radius)] border border-gray-200 bg-gray-50/50 px-3 py-2 pr-9 text-xs font-bold focus:border-[var(--color-primary)] focus:bg-white focus:outline-none"
                      />
                      <f.icon size={14} className="absolute right-3 top-2.5 text-gray-400" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50/60 border border-gray-100 rounded-[var(--radius)] px-3 py-2">
                      <f.icon size={14} className="text-gray-400" />
                      <span className="font-mono">{user[f.key] || 'ثبت نشده'}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Role */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400 block">نقش کاربر</label>
                {editing ? (
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full text-right rounded-[var(--radius)] border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-bold focus:border-[var(--color-primary)] focus:bg-white focus:outline-none cursor-pointer"
                  >
                    {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50/60 border border-gray-100 rounded-[var(--radius)] px-3 py-2">
                    {user.role === 'admin' ? <Shield size={14} className="text-purple-500" /> : user.role === 'coach' ? <GraduationCap size={14} className="text-amber-500" /> : <User size={14} className="text-gray-400" />}
                    {roleOptions.find(r => r.value === user.role)?.label || 'کاربر عادی'}
                  </div>
                )}
              </div>

              {/* Level */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400 block">سطح کاربری (VIP)</label>
                {editing ? (
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
                    className="w-full text-right rounded-[var(--radius)] border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-bold focus:border-[var(--color-primary)] focus:bg-white focus:outline-none cursor-pointer"
                  >
                    {Object.entries(levelLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50/60 border border-gray-100 rounded-[var(--radius)] px-3 py-2">
                    <Star size={14} className="text-amber-400" />
                    {levelLabels[user.level] || 'عادی'}
                  </div>
                )}
              </div>

              {/* Wallet */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400 block">موجودی کیف پول</label>
                {editing ? (
                  <div className="relative">
                    <input
                      type="number"
                      value={form.walletBalance}
                      onChange={(e) => setForm({ ...form, walletBalance: e.target.value })}
                      className="w-full text-right rounded-[var(--radius)] border border-gray-200 bg-gray-50/50 px-3 py-2 pr-9 text-xs font-bold focus:border-[var(--color-primary)] focus:bg-white focus:outline-none"
                    />
                    <Wallet size={14} className="absolute right-3 top-2.5 text-gray-400" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50/60 border border-gray-100 rounded-[var(--radius)] px-3 py-2">
                    <Wallet size={14} className="text-emerald-500" />
                    {fmtToman(user.walletBalance)}
                  </div>
                )}
              </div>

              {/* Ban toggle */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400 block">وضعیت حساب</label>
                {editing ? (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isBanned: !form.isBanned })}
                    className={`w-full flex items-center justify-center gap-1.5 rounded-[var(--radius)] px-3 py-2 text-xs font-bold border transition-colors ${form.isBanned ? 'text-red-600 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}
                  >
                    {form.isBanned ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                    {form.isBanned ? 'مسدود (برای فعال‌سازی کلیک کنید)' : 'فعال (برای مسدودسازی کلیک کنید)'}
                  </button>
                ) : (
                  <div className={`flex items-center gap-2 text-xs font-bold rounded-[var(--radius)] px-3 py-2 border ${user.isBanned ? 'text-red-600 bg-red-50 border-red-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100'}`}>
                    {user.isBanned ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                    {user.isBanned ? 'مسدود شده' : 'فعال'}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-bold text-gray-400" style={{ borderColor: '#f0ede9' }}>
              <span className="flex items-center gap-1"><Calendar size={12} /> عضویت: {fmtDate(user.createdAt)}</span>
              {user.coachCode && <span className="flex items-center gap-1"><Hash size={12} /> کد مربی: <span className="font-mono text-amber-600">{user.coachCode}</span></span>}
              <span className="flex items-center gap-1"><Hash size={12} /> شناسه: <span className="font-mono">{user._id}</span></span>
            </div>
          </Card>

          {/* Orders */}
          <Card>
            <SectionTitle icon={Package} title="سفارش‌ها" count={orders.length} />
            {orders.length > 0 ? (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="text-[11px] font-bold text-gray-400 border-b" style={{ borderColor: '#f0ede9' }}>
                      <th className="p-2.5">کد رهگیری</th>
                      <th className="p-2.5">مبلغ</th>
                      <th className="p-2.5">پرداخت</th>
                      <th className="p-2.5">وضعیت سفارش</th>
                      <th className="p-2.5">تاریخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#f5f3f0' }}>
                    {orders.map((o) => {
                      const ps = paymentStatusMap[o.paymentStatus] || {}
                      const fs = fulfillmentStatusMap[o.fulfillmentStatus] || {}
                      return (
                        <tr
                          key={o._id}
                          onClick={() => router.push(`/p-admin/admin-orders/${o._id}`)}
                          className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                        >
                          <td className="p-2.5 font-mono font-bold text-gray-700 flex items-center gap-1">
                            <ChevronLeft size={12} className="text-gray-300" />
                            {o.trackingCode || '—'}
                          </td>
                          <td className="p-2.5 font-bold text-gray-700">{fmtToman(o.totalPrice)}</td>
                          <td className="p-2.5"><span className={`px-2 py-0.5 rounded-full font-bold ${ps.cls || ''}`}>{ps.label || o.paymentStatus}</span></td>
                          <td className="p-2.5"><span className={`px-2 py-0.5 rounded-full font-bold ${fs.cls || ''}`}>{fs.label || o.fulfillmentStatus}</span></td>
                          <td className="p-2.5 font-mono text-gray-400">{fmtDate(o.createdAt || o.orderDate)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs font-bold text-gray-400 text-center py-6">این کاربر هیچ سفارشی ثبت نکرده است.</p>
            )}
          </Card>

          {/* Payments */}
          <Card>
            <SectionTitle icon={CreditCard} title="پرداخت‌ها" count={payments.length} />
            {payments.length > 0 ? (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="text-[11px] font-bold text-gray-400 border-b" style={{ borderColor: '#f0ede9' }}>
                      <th className="p-2.5">سفارش</th>
                      <th className="p-2.5">روش</th>
                      <th className="p-2.5">مبلغ</th>
                      <th className="p-2.5">وضعیت</th>
                      <th className="p-2.5">تاریخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#f5f3f0' }}>
                    {payments.map((p) => {
                      const st = paymentRowStatusMap[p.status] || {}
                      return (
                        <tr
                          key={p._id}
                          onClick={() => p.orderInfo && router.push(`/p-admin/admin-orders/${p.orderInfo._id}`)}
                          className={`transition-colors ${p.orderInfo ? 'hover:bg-gray-50/60 cursor-pointer' : ''}`}
                        >
                          <td className="p-2.5 font-mono font-bold text-gray-700">{p.orderInfo?.trackingCode || '—'}</td>
                          <td className="p-2.5 font-bold text-gray-600">{p.method === 'ONLINE' ? 'آنلاین' : 'فیش بانکی'}</td>
                          <td className="p-2.5 font-bold text-gray-700">{fmtToman(p.amount)}</td>
                          <td className="p-2.5"><span className={`px-2 py-0.5 rounded-full font-bold ${st.cls || ''}`}>{st.label || p.status}</span></td>
                          <td className="p-2.5 font-mono text-gray-400">{fmtDate(p.createdAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs font-bold text-gray-400 text-center py-6">هیچ پرداختی برای این کاربر ثبت نشده است.</p>
            )}
          </Card>

          {/* Students (coach only) */}
          {user.role === 'coach' && (
            <Card>
              <SectionTitle icon={UsersIcon} title="شاگردان تحت پوشش" count={students.length} />
              {students.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {students.map((s) => (
                    <div
                      key={s._id}
                      onClick={() => router.push(`/p-admin/users/${s._id}`)}
                      className="flex items-center gap-3 p-3 rounded-[var(--radius)] border border-gray-100 bg-gray-50/50 hover:bg-gray-100/60 cursor-pointer transition-colors"
                    >
                      {s.avatar ? (
                        <img src={s.avatar} alt={s.name} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-900 text-[var(--color-primary)] flex items-center justify-center font-bold text-xs">
                          {(s.name || '؟').charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-800 block truncate">{s.name || 'بدون نام'}</span>
                        <span className="text-[10px] font-mono text-gray-400 block">{s.phone || '—'} · {fmtDate(s.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-bold text-gray-400 text-center py-6">این مربی هنوز هیچ شاگردی ندارد.</p>
              )}
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Assigned coach */}
          {user.coach && (
            <Card>
              <SectionTitle icon={Award} title="مربی اختصاصی" />
              <div
                onClick={() => router.push(`/p-admin/users/${user.coach._id}`)}
                className="flex items-center gap-3 p-3 rounded-[var(--radius)] border border-amber-100 bg-amber-50/40 hover:bg-amber-50 cursor-pointer transition-colors"
              >
                {user.coach.avatar ? (
                  <img src={user.coach.avatar} alt={user.coach.name} className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-slate-900 text-[var(--color-primary)] flex items-center justify-center font-bold">
                    {(user.coach.name || 'م').charAt(0)}
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold text-gray-800 block">{user.coach.name}</span>
                  <span className="text-[10px] font-mono text-amber-600 block mt-0.5">{user.coach.coachCode}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Addresses */}
          <Card>
            <SectionTitle icon={MapPin} title="آدرس‌ها" count={addresses.length} />
            {addresses.length > 0 ? (
              <div className="space-y-3">
                {addresses.map((a) => (
                  <div key={a._id} className="p-3 rounded-[var(--radius)] border border-gray-100 bg-gray-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <MapPin size={13} className="text-[var(--color-primary)]" />
                        {a.title}
                      </span>
                      {a.isDefault && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">پیش‌فرض</span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-gray-500 leading-relaxed">
                      {a.city ? `${a.city}، ` : ''}{a.addressLine}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono font-bold text-gray-400 pt-1">
                      <span>{a.fullName}</span>
                      <span>{a.phone}</span>
                      {a.postalCode && <span>کدپستی: {a.postalCode}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-gray-400 text-center py-6">هیچ آدرسی ثبت نشده است.</p>
            )}
          </Card>

          {/* Quick stats */}
          <Card>
            <SectionTitle icon={Star} title="خلاصه فعالیت" />
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-[var(--radius)] bg-gray-50/60 border border-gray-100 text-center">
                <span className="text-lg font-bold text-gray-800 block">{orders.length.toLocaleString('fa-IR')}</span>
                <span className="text-[10px] font-bold text-gray-400">سفارش</span>
              </div>
              <div className="p-3 rounded-[var(--radius)] bg-gray-50/60 border border-gray-100 text-center">
                <span className="text-lg font-bold text-gray-800 block">{addresses.length.toLocaleString('fa-IR')}</span>
                <span className="text-[10px] font-bold text-gray-400">آدرس</span>
              </div>
              <div className="p-3 rounded-[var(--radius)] bg-gray-50/60 border border-gray-100 text-center">
                <span className="text-lg font-bold text-gray-800 block">{payments.length.toLocaleString('fa-IR')}</span>
                <span className="text-[10px] font-bold text-gray-400">پرداخت</span>
              </div>
              <div className="p-3 rounded-[var(--radius)] bg-gray-50/60 border border-gray-100 text-center">
                <span className="text-lg font-bold text-emerald-600 block">{fmtToman(user.walletBalance).replace(' تومان', '')}</span>
                <span className="text-[10px] font-bold text-gray-400">کیف پول (تومان)</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
