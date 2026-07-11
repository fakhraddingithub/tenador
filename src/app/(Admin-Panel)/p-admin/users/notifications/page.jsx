'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import { getUserFullName } from 'base/utils/userName'
import {
  Megaphone, Send, Users, Shield, UserCheck, User as UserIcon,
  Search, X, Check, ArrowRight, AlertTriangle, History, Loader2,
} from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'user', label: 'کاربر عادی' },
  { value: 'coach', label: 'مربی' },
  { value: 'seller', label: 'فروشنده' },
  { value: 'national_player', label: 'ورزشکار ملی' },
  { value: 'store', label: 'فروشگاه' },
  { value: 'admin', label: 'مدیر کل' },
]
const roleLabel = (v) => ROLE_OPTIONS.find((r) => r.value === v)?.label || v

const TARGET_OPTIONS = [
  { value: 'all', label: 'همه‌ی کاربران', desc: 'ارسال همگانی', icon: Users },
  { value: 'role', label: 'بر اساس نقش', desc: 'یک گروه نقشی', icon: Shield },
  { value: 'group', label: 'گروه دلخواه', desc: 'چند کاربر انتخابی', icon: UserCheck },
  { value: 'single', label: 'یک کاربر', desc: 'ارسال تکی', icon: UserIcon },
]

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const fa = (n) => Number(n).toLocaleString('fa-IR')
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'لحظاتی پیش'
  if (min < 60) return `${fa(min)} دقیقه پیش`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${fa(hr)} ساعت پیش`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${fa(day)} روز پیش`
  return new Date(dateStr).toLocaleDateString('fa-IR')
}

function targetSummary(n) {
  if (n.targetType === 'all') return 'همه‌ی کاربران'
  if (n.targetType === 'role') return `نقش: ${roleLabel(n.targetRole)}`
  if (n.targetType === 'single') return 'یک کاربر'
  return 'گروه کاربران'
}

export default function SendUserNotificationPage() {
  const router = useRouter()

  // ── compose ──
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetType, setTargetType] = useState('all')
  const [targetRole, setTargetRole] = useState('user')

  // ── user search/select (group/single) ──
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState([])
  const debounceRef = useRef(null)

  // ── preview / send ──
  const [previewCount, setPreviewCount] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)

  // ── history ──
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const isUserMode = targetType === 'group' || targetType === 'single'
  const recipientEstimate = isUserMode ? selected.length : previewCount

  /* تاریخچه */
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/user-notifications?limit=20')
      const data = await res.json()
      if (res.ok) setHistory(data.notifications || [])
    } catch {
      /* بی‌صدا */
    } finally {
      setHistoryLoading(false)
    }
  }, [])
  useEffect(() => { loadHistory() }, [loadHistory])

  /* پیش‌نمایش تعداد گیرنده برای all/role */
  useEffect(() => {
    if (isUserMode) { setPreviewCount(null); return }
    let active = true
    setPreviewCount(null)
    const params = new URLSearchParams({ targetType })
    if (targetType === 'role') params.set('targetRole', targetRole)
    fetch(`/api/admin/user-notifications/recipients?${params}`)
      .then((r) => (r.ok ? r.json() : { count: null }))
      .then((d) => { if (active) setPreviewCount(d.count) })
      .catch(() => {})
    return () => { active = false }
  }, [targetType, targetRole, isUserMode])

  /* جستجوی کاربر (debounced) */
  useEffect(() => {
    if (!isUserMode) return
    clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        setResults((data.users || []).slice(0, 8))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, isUserMode])

  const isSelected = (id) => selected.some((u) => u._id === id)

  const pickUser = (u) => {
    if (targetType === 'single') {
      setSelected([u]); setQuery(''); setResults([])
      return
    }
    setSelected((prev) =>
      prev.some((x) => x._id === u._id)
        ? prev.filter((x) => x._id !== u._id)
        : [...prev, u]
    )
  }
  const removeUser = (id) => setSelected((prev) => prev.filter((u) => u._id !== id))

  // هنگام تغییر نوع هدف، انتخاب‌ها پاک شوند تا داده‌ی ناسازگار ارسال نشود
  const changeTarget = (t) => {
    setTargetType(t)
    setSelected([]); setQuery(''); setResults([])
  }

  const validate = () => {
    if (!title.trim()) { toast.error('عنوان اعلان را وارد کنید'); return false }
    if (!message.trim()) { toast.error('متن اعلان را وارد کنید'); return false }
    if (targetType === 'group' && selected.length === 0) {
      toast.error('حداقل یک کاربر انتخاب کنید'); return false
    }
    if (targetType === 'single' && selected.length !== 1) {
      toast.error('یک کاربر انتخاب کنید'); return false
    }
    return true
  }

  const openConfirm = () => { if (validate()) setConfirmOpen(true) }

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/admin/user-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          targetType,
          targetRole: targetType === 'role' ? targetRole : undefined,
          targetUserIds: isUserMode ? selected.map((u) => u._id) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'خطا در ارسال اعلان')
      toast.success(data.message || 'اعلان ارسال شد')
      setConfirmOpen(false)
      // ریست فرم (نوعِ هدف حفظ می‌شود برای ارسال‌های پیاپی)
      setTitle(''); setMessage(''); setSelected([]); setQuery('')
      if (data.notification) setHistory((h) => [data.notification, ...h])
      loadHistory()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border" style={{ borderColor: '#e8e4df' }}>
        <div>
          <h1 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-1">
            <Megaphone className="text-[var(--color-primary)]" size={20} />
            ارسال اعلان به کاربران
          </h1>
          <p className="text-xs font-bold text-gray-400">پیام‌ها در زنگوله‌ی نوبارِ سایت برای کاربرانِ هدف نمایش داده می‌شوند</p>
        </div>
        <button
          onClick={() => router.push('/p-admin/users')}
          className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-[var(--radius)] border bg-white hover:bg-gray-50 transition-all"
          style={{ borderColor: '#e8e4df', color: '#6b6259' }}
        >
          بازگشت به کاربران
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Compose ── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border p-5 space-y-5" style={{ borderColor: '#e8e4df' }}>
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">عنوان اعلان</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="مثلاً: جشنواره‌ی فروش ویژه آغاز شد"
              className="w-full text-right rounded-[var(--radius)] border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-bold focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">متن پیام</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="متن کامل اعلان را اینجا بنویسید…"
              className="w-full text-right rounded-[var(--radius)] border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-medium leading-relaxed resize-y focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all"
            />
            <p className="text-[10px] font-bold text-gray-400 mt-1 tabular-nums">
              {Number(message.length).toLocaleString('fa-IR')} / ۲٬۰۰۰
            </p>
          </div>

          {/* Targeting */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">گیرندگان</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TARGET_OPTIONS.map((opt) => {
                const active = targetType === opt.value
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    onClick={() => changeTarget(opt.value)}
                    className={`relative flex flex-col items-start gap-1.5 p-3 rounded-[var(--radius)] border-2 text-right transition-all ${
                      active
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/[0.06]'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-[var(--radius)] flex items-center justify-center ${active ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-500'}`}>
                      <Icon size={15} />
                    </span>
                    <span className={`text-xs font-bold ${active ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>{opt.label}</span>
                    <span className="text-[10px] font-bold text-gray-400">{opt.desc}</span>
                    {active && (
                      <span className="absolute top-2 left-2 w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white">
                        <Check size={10} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Conditional: role */}
          <AnimatePresence mode="wait">
            {targetType === 'role' && (
              <motion.div
                key="role"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-xs font-bold text-gray-600 mb-2">انتخاب نقش</label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setTargetRole(r.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                        targetRole === r.value
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Conditional: group/single search */}
            {isUserMode && (
              <motion.div
                key="search"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3"
              >
                <label className="block text-xs font-bold text-gray-600">
                  {targetType === 'single' ? 'انتخاب کاربر' : 'افزودن کاربران'}
                </label>

                {/* selected chips */}
                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selected.map((u) => (
                      <span key={u._id} className="inline-flex items-center gap-1.5 bg-[var(--color-primary)]/[0.08] text-[var(--color-primary)] text-xs font-bold pr-2 pl-1 py-1 rounded-full border border-[var(--color-primary)]/20">
                        {getUserFullName(u, u.phone || "\u06a9\u0627\u0631\u0628\u0631")}
                        <button onClick={() => removeUser(u._id)} className="w-4 h-4 rounded-full bg-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/30 flex items-center justify-center">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="جستجوی نام، تلفن، ایمیل یا کد مربی…"
                    className="w-full text-right rounded-[var(--radius)] border-2 border-gray-200 bg-white px-4 py-2.5 pr-9 text-xs font-bold focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </span>
                </div>

                {/* results */}
                {query.trim().length >= 2 && (
                  <div className="border rounded-[var(--radius)] overflow-hidden divide-y" style={{ borderColor: '#e8e4df' }}>
                    {searching ? (
                      <p className="text-center text-xs font-bold text-gray-400 py-4">در حال جستجو…</p>
                    ) : results.length === 0 ? (
                      <p className="text-center text-xs font-bold text-gray-400 py-4">کاربری یافت نشد</p>
                    ) : (
                      results.map((u) => {
                        const sel = isSelected(u._id)
                        return (
                          <button
                            key={u._id}
                            onClick={() => pickUser(u)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors ${sel ? 'bg-[var(--color-primary)]/[0.06]' : 'hover:bg-gray-50'}`}
                          >
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="w-8 h-8 rounded-[var(--radius)] object-cover flex-shrink-0" />
                            ) : (
                              <span className="w-8 h-8 rounded-[var(--radius)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: 'var(--color-primary)' }}>
                                {(u.name || '؟').charAt(0)}
                              </span>
                            )}
                            <span className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-bold text-gray-800 truncate">{getUserFullName(u, "\u0628\u062f\u0648\u0646 \u0646\u0627\u0645")}</span>
                              <span className="text-[10px] font-bold text-gray-400 font-mono truncate">{u.phone || u.email || '—'}</span>
                            </span>
                            <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{roleLabel(u.role)}</span>
                            {sel && (
                              <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white flex-shrink-0">
                                <Check size={11} />
                              </span>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer: estimate + send */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: '#f0ede9' }}>
            <p className="text-xs font-bold text-gray-500">
              {recipientEstimate == null ? (
                <span className="text-gray-400">در حال محاسبه…</span>
              ) : (
                <>گیرنده: <span className="text-[var(--color-primary)] tabular-nums">{Number(recipientEstimate).toLocaleString('fa-IR')}</span> کاربر</>
              )}
            </p>
            <button
              onClick={openConfirm}
              className="inline-flex items-center gap-2 text-white text-xs font-bold px-5 py-2.5 rounded-[var(--radius)] transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
              style={{ background: 'var(--color-primary)' }}
            >
              <Send size={14} />
              ارسال اعلان
            </button>
          </div>
        </div>

        {/* ── History ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden flex flex-col" style={{ borderColor: '#e8e4df' }}>
          <div className="flex items-center gap-2 px-4 py-3.5 border-b" style={{ borderColor: '#f0ede9', background: '#faf9f8' }}>
            <History size={15} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-700">اعلان‌های ارسال‌شده</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[560px] divide-y" style={{ borderColor: '#f5f3f0' }}>
            {historyLoading ? (
              <div className="p-4 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-[var(--radius)] animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                <Megaphone size={26} className="text-gray-300" />
                <p className="text-xs font-bold text-gray-400">هنوز اعلانی ارسال نشده است</p>
              </div>
            ) : (
              history.map((n) => (
                <div key={n._id} className="px-4 py-3 hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-gray-800 truncate">{n.title}</p>
                    <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="text-[11px] font-medium text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/[0.08] px-2 py-0.5 rounded-full">
                      {targetSummary(n)}
                    </span>
                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">
                      {Number(n.recipientCount || 0).toLocaleString('fa-IR')} گیرنده
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Confirm modal ── */}
      <AnimatePresence>
        {confirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !sending && setConfirmOpen(false)}
              className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              dir="rtl"
              className="fixed z-[110] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span className={`w-11 h-11 rounded-[var(--radius)] flex items-center justify-center flex-shrink-0 ${targetType === 'all' ? 'bg-amber-50 text-amber-500' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'}`}>
                    {targetType === 'all' ? <AlertTriangle size={20} /> : <Send size={18} />}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">تأیید ارسال اعلان</h3>
                    <p className="text-xs font-bold text-gray-500 leading-relaxed">
                      {targetType === 'all'
                        ? 'این اعلان برای همه‌ی کاربران سایت ارسال می‌شود. این عمل قابل بازگشت نیست.'
                        : 'اعلان برای گیرندگانِ انتخاب‌شده ارسال خواهد شد.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-[var(--radius)] border p-3 space-y-2" style={{ borderColor: '#e8e4df', background: '#faf9f8' }}>
                  <Row label="عنوان" value={title} />
                  <Row label="هدف" value={
                    targetType === 'all' ? 'همه‌ی کاربران'
                      : targetType === 'role' ? `نقش: ${roleLabel(targetRole)}`
                      : targetType === 'single' ? (getUserFullName(selected[0], "\u06cc\u06a9 \u06a9\u0627\u0631\u0628\u0631"))
                      : `${Number(selected.length).toLocaleString('fa-IR')} کاربر`
                  } />
                  <Row label="تعداد گیرنده" value={
                    recipientEstimate == null ? '—' : `${Number(recipientEstimate).toLocaleString('fa-IR')} کاربر`
                  } highlight />
                </div>
              </div>

              <div className="flex gap-2 p-4 border-t" style={{ borderColor: '#f0ede9' }}>
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={sending}
                  className="flex-1 text-xs font-bold px-4 py-2.5 rounded-[var(--radius)] border bg-white hover:bg-gray-50 text-gray-600 transition-all disabled:opacity-50"
                  style={{ borderColor: '#e8e4df' }}
                >
                  انصراف
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 inline-flex items-center justify-center gap-2 text-white text-xs font-bold px-4 py-2.5 rounded-[var(--radius)] transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? 'در حال ارسال…' : 'ارسال نهایی'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">{label}</span>
      <span className={`text-xs font-bold truncate ${highlight ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>{value || '—'}</span>
    </div>
  )
}
