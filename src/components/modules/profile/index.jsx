'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import { 
  User, Mail, Phone, Calendar, Edit3, CheckCircle2, 
  Copy, Download, Award, ShieldCheck, Save, X, QrCode,
  Upload, Link, Loader2, Users, AlertCircle
} from 'lucide-react'

export default function ProfileModule() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({})
  const [copied, setCopied] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // استیت‌های جدید سناریو مربیگری
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [coachCodeInput, setCoachCodeInput] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [uploading, setUploading] = useState({ certificateImage: false, personalImage: false })
  const [applyFormData, setApplyFormData] = useState({ fullName: '', certificateImage: '', personalImage: '' })
  const [submitLoading, setSubmitLoading] = useState(false)

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/auth/profile')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setFormData(data.user)
      } else {
        toast.error('خطا در بارگذاری پروفایل')
      }
    } catch {
      toast.error('خطا در اتصال به سرور')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setUser({ ...user, ...formData })
        setEditing(false)
        toast.success('پروفایل با موفقیت بروزرسانی شد')
      } else {
        toast.error('خطا در بروزرسانی اطلاعات')
      }
    } catch {
      toast.error('خطا در اتصال به شبکه')
    }
  }

  // ۱. آپلود تصویر در بستر اختصاصی API پروژه
  const uploadImage = async (file, field) => {
    if (!file) return;
    setUploading((p) => ({ ...p, [field]: true }));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'brands');

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApplyFormData((p) => ({ ...p, [field]: data.url }));
      toast.success('تصویر با موفقیت آپلود شد');
    } catch (err) {
      toast.error('آپلود تصویر ناموفق بود');
    } finally {
      setUploading((p) => ({ ...p, [field]: false }));
    }
  };

  // ۲. ارسال نهایی درخواست مربیگری به سرور
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!applyFormData.fullName || !applyFormData.certificateImage || !applyFormData.personalImage) {
      return toast.warn('لطفاً تمامی فیلدها و مدارک را تکمیل کنید');
    }

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/profile/coach-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applyFormData)
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message);
        setIsModalOpen(false);
        // به روزرسانی لوکال وضعیت به pending
        setUser(p => ({ ...p, coachApplicationStatus: 'pending' }));
      } else {
        toast.error(data.message || 'خطایی رخ داد');
      }
    } catch {
      toast.error('خطا در اتصال به سرور');
    } finally {
      setSubmitLoading(false);
    }
  };

  // ۳. متصل شدن به مربی با کد معرف
  const handleLinkCoach = async () => {
    if (!coachCodeInput.trim()) return toast.warn('کد مربی را وارد کنید');
    setLinkLoading(true);

    try {
      const res = await fetch('/api/profile/link-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachCode: coachCodeInput })
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message);
        fetchUserProfile(); // گرفتن اطلاعات جدید کاربر و دیتای مربی متصل شده
        setCoachCodeInput('');
      } else {
        toast.error(data.message || 'کد مربی معتبر نیست');
      }
    } catch {
      toast.error('خطای ارتباط با سرور');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyText = (text, type) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    if (type === 'link') {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000);
    }
    toast.success('کپی شد');
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-[var(--color-primary)]" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 text-right" dir="rtl">
      
      {/* استایل‌های پرینت کارت مربی */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #coach-card, #coach-card * { visibility: visible !important; }
          #coach-card {
            position: absolute !important; left: 50% !important; top: 10% !important;
            transform: translateX(-50%) scale(1.1) !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      
      {/* بخش سمت راست: اطلاعات کاربری */}
      <div className="lg:col-span-2 space-y-5 print:hidden">
        <div className="flex items-center justify-between bg-white p-4 rounded-[var(--radius)] border border-[hsl(var(--border))] shadow-xs">
          <h1 className="flex items-center gap-2 text-base font-bold text-[var(--color-text)]">
            <User className="text-[var(--color-primary)]" size={20} />
            پروفایل کاربری
          </h1>

          <button
            onClick={() => {
              if (editing) setFormData(user)
              setEditing(!editing)
            }}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius)] transition-all
              ${editing 
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                : 'bg-[var(--color-primary)] text-white hover:opacity-90 shadow-sm shadow-[var(--color-primary)]/20'}
            `}
          >
            {editing ? <X size={14} /> : <Edit3 size={14} />}
            {editing ? 'لغو ویرایش' : 'ویرایش مشخصات'}
          </button>
        </div>

        <div className="bg-white border border-[hsl(var(--border))] rounded-[var(--radius)] p-6 shadow-xs">
          <AnimatePresence mode="wait">
            {editing ? (
              <motion.div
                key="edit-form"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    { label: 'نام و نام خانوادگی', key: 'name', type: 'text', icon: User },
                    { label: 'نشانی ایمیل', key: 'email', type: 'email', icon: Mail },
                    { label: 'شماره تلفن همراه', key: 'phone', type: 'tel', icon: Phone },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs font-medium text-slate-500 block">
                        {field.label}
                      </label>
                      <div className="relative">
                        <input
                          type={field.type}
                          value={formData[field.key] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          className="w-full text-right rounded-[var(--radius)] border border-[hsl(var(--border))] bg-slate-50/50 px-3 py-2.5 pr-10 text-sm font-medium transition-all focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                        />
                        <field.icon size={16} className="absolute right-3 top-3.5 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={handleUpdate}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[var(--color-primary)] hover:opacity-95 rounded-[var(--radius)] shadow-md shadow-[var(--color-primary)]/10"
                  >
                    <Save size={14} />
                    ذخیره تغییرات
                  </button>
                  <button
                    onClick={() => {
                      setFormData(user)
                      setEditing(false)
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-[var(--radius)]"
                  >
                    انصراف
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="view-profile"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 gap-y-5 gap-x-6 sm:grid-cols-2 text-sm"
              >
                {[
                  { label: 'نام و نام خانوادگی', value: user?.name || 'ثبت نشده', icon: User },
                  { label: 'نشانی ایمیل', value: user?.email || 'ثبت نشده', icon: Mail },
                  { label: 'شماره تلفن همراه', value: user?.phone || 'ثبت نشده', icon: Phone },
                  { 
                    label: 'تاریخ عضویت', 
                    value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fa-IR') : 'مشخص نیست', 
                    icon: Calendar 
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-[var(--radius)] bg-slate-50/60 border border-slate-100/80">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-white border border-slate-200 text-slate-500 shadow-2xs">
                      <item.icon size={16} />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs text-slate-400 block">{item.label}</span>
                      <span className="font-semibold text-slate-700">{item.value}</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

  {/* بخش سمت چپ: سایدبار مربیگری / مربی کاربر */}
      <div className="space-y-5">
        
        {/* حالت اول: کاربر خودش مربی است -> نمایش کارت دیجیتال مربیگری */}
        {user?.isCoach ? (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-[var(--radius)] border border-[hsl(var(--border))] shadow-xs print:hidden">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Award className="text-[#ffbf00]" size={18} />
                کارت مربیگری دیجیتال
              </h2>
            </div>

            <div id="coach-card" className="relative mx-auto w-full max-w-[290px] aspect-[1/1.55] overflow-hidden rounded-2xl bg-gradient-to-b from-[#1c1c1e] to-[#0d0d0d] p-5 text-white shadow-xl shadow-black/30 border border-neutral-800/60 flex flex-col justify-between">
              <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3 z-10">
                <span className="text-xs font-black tracking-widest text-neutral-400">FIT PANEL</span>
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#ffbf00] tracking-wider bg-[#ffbf00]/10 px-2 py-0.5 rounded-full border border-[#ffbf00]/20">
                  <ShieldCheck size={10} />
                  مربی رسمی
                </div>
              </div>

              <div className="flex flex-col items-center text-center my-auto space-y-3 z-10">
                <div className="relative">
                  <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-[#ffbf00] bg-neutral-800 shadow-lg shadow-black/40">
                    <img 
                      src={user?.avatar || "https://ui-avatars.com/api/?name=" + (user?.name || "Coach") + "&background=101010&color=ffbf00"} 
                      alt={user?.name} 
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#ffbf00] text-black shadow-md">
                    <CheckCircle2 size={12} strokeWidth={3} />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-white tracking-tight">{user?.name}</h3>
                  <p className="text-[11px] text-neutral-400 font-medium">مربی تخصصی مجموعه</p>
                </div>

                <div className="p-2 bg-white rounded-xl shadow-inner border border-neutral-700/50 mt-1">
                  <QrCode size={56} className="text-black" strokeWidth={1.5} />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-neutral-800 pt-3 z-10">
                <div className="text-right">
                  <span className="text-[9px] text-neutral-500 block">کد اختصاصی مربی</span>
                  <span className="text-xs font-mono font-bold text-[#ffbf00] tracking-wider">
                    {user?.coachCode || 'TR-XXXX'}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-[9px] text-neutral-500 block">اعتبار کارت</span>
                  <span className="text-[11px] font-semibold text-neutral-300">دائمی</span>
                </div>
              </div>
            </div>

            {/* دکمه‌های کنترلی کارت مربیگری */}
            <div className="flex flex-col gap-2 max-w-[290px] mx-auto print:hidden">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCopyText(user?.coachCode, 'code')}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-[var(--radius)] text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 transition-colors"
                >
                  <Copy size={14} />
                  {copiedCode ? 'کپی شد!' : 'کپی کد مربی'}
                </button>
                <button
                  onClick={() => handleCopyText(user?.referralLink, 'link')}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-[var(--radius)] text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 transition-colors"
                >
                  <Link size={14} />
                  {copied ? 'کپی شد!' : 'لینک معرف'}
                </button>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-[var(--radius)] text-xs font-bold bg-[var(--color-primary)] hover:opacity-90 text-white transition-opacity shadow-sm"
              >
                <Download size={14} />
                دانلود / چاپ کارت مربیگری
              </button>
            </div>
          </div>
        ) : (
          /* حالت دوم: کاربر مربی نیست */
          <div className="space-y-4">
            
            {/* الف) کامپوننت اتصال به مربی از طریق کد معرف */}
            {user?.coach ? (
              // اگر شاگرد مربی داشته باشد، کارت مشخصات مربی نمایش داده می‌شود
              <div className="bg-white p-5 border border-[hsl(var(--border))] rounded-[var(--radius)] shadow-xs space-y-4">
                <span className="text-xs font-bold text-slate-400 block">مربی اختصاصی شما</span>
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <img 
                    src={user?.coach?.avatar || "https://ui-avatars.com/api/?name=" + (user?.coach?.name || "Coach")} 
                    className="h-12 w-12 rounded-full border border-slate-200 object-cover" 
                    alt={user?.coach?.name} 
                  />
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{user?.coach?.name}</h4>
                    <span className="text-[11px] text-slate-400 block mt-0.5">مشاور و برنامه دهنده تخصصی شما</span>
                  </div>
                </div>
              </div>
            ) : (
              // اگر مربی نداشته باشد، فیلد ثبت کد مربی فعال است
              <div className="bg-white p-5 border border-[hsl(var(--border))] rounded-[var(--radius)] shadow-xs space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Users size={16} className="text-[var(--color-primary)]" />
                    ثبت مربی با کد معرف
                  </h3>
                  <p className="text-xs text-slate-400">اگر از مربیان ما کد همکاری دارید، آن را وارد کنید.</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="مثال: TR-4921"
                    value={coachCodeInput}
                    onChange={(e) => setCoachCodeInput(e.target.value)}
                    className="flex-1 text-center font-mono uppercase rounded-[var(--radius)] border border-[hsl(var(--border))] bg-slate-50 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:bg-white focus:outline-none"
                  />
                  <button
                    onClick={handleLinkCoach}
                    disabled={linkLoading}
                    className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-[var(--radius)] transition-colors disabled:opacity-50 flex items-center justify-center min-w-[70px]"
                  >
                    {linkLoading ? <Loader2 size={14} className="animate-spin" /> : 'ثبت مربی'}
                  </button>
                </div>
              </div>
            )}

            {/* ب) دکمه/وضعیت درخواست مربیگری (فقط در صورتی که کاربر مربی متصل نکرده باشد نمایش داده می‌شود) */}
            {!user?.coach && (
              <>
                {user?.coachApplicationStatus === 'pending' ? (
                  // وضعیت در انتظار تایید
                  <div className="bg-amber-50 border border-amber-200 rounded-[var(--radius)] p-5 text-amber-900 flex items-start gap-3">
                    <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold">درخواست در انتظار تایید ادمین</h4>
                      <p className="text-[11px] text-amber-800/90 leading-relaxed">
                        مدارک مربیگری شما با موفقیت ارسال شده است و پس از بررسی اصالت مدارک توسط کارشناسان، کارت شما صادر خواهد شد.
                      </p>
                    </div>
                  </div>
                ) : (
                  // دکمه باز کردن مودال ثبت نام
                  <div className="bg-gradient-to-br from-slate-900 to-neutral-900 text-white rounded-[var(--radius)] p-6 shadow-md border border-neutral-800 relative overflow-hidden">
                    <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-[var(--color-primary)]/10 blur-2xl" />
                    
                    <div className="relative space-y-4">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30">
                        <Award size={22} />
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white">دریافت پنل و کارت مربیگری</h3>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                          اگر تخصص ورزشی یا مدارک مربیگری معتبر دارید، با احراز هویت می‌توانید کارت رسمی دیجیتال و سیستم اختصاصی کسب درآمد خود را فعال کنید.
                        </p>
                      </div>

                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-full text-center py-2.5 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-xs font-bold text-white rounded-[var(--radius)] transition-all shadow-lg shadow-[var(--color-primary)]/20"
                      >
                        احراز هویت به عنوان مربی
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ========================================================          کامپوننت مودال انیمیشنی ثبت درخواست مربیگری (Premium U======================================================== */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* لایه تاریک پشت مودال */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* بدنه اصلی فرم مودال */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 z-10 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="text-[var(--color-primary)]" size={20} />
                  <h3 className="text-sm font-bold text-slate-800">فرم درخواست رسمی مربیگری</h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleApplySubmit} className="space-y-4">
                {/* فیلد نام کامل مربی */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">نام و نام خانوادگی رسمی (جهت درج روی کارت)</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: علیرضا محمدی"
                    value={applyFormData.fullName}
                    onChange={(e) => setApplyFormData({...applyFormData, fullName: e.target.value})}
                    className="w-full text-right rounded-[var(--radius)] border border-[hsl(var(--border))] bg-slate-50/50 px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* فیلد آپلود عکس پرسنلی */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">تصویر پرسنلی مربی</label>
                  <div className="relative flex items-center justify-center border border-dashed border-slate-200 rounded-[var(--radius)] bg-slate-50/50 p-4 transition-colors hover:bg-slate-50">
                    {applyFormData.personalImage ? (
                      <div className="flex items-center justify-between w-full text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg">
                        <span className="flex items-center gap-1"><CheckCircle2 size={14}/> عکس پرسنلی آپلود شد</span>
                        <img src={applyFormData.personalImage} className="h-8 w-8 rounded-full object-cover border"/>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-1 cursor-pointer w-full">
                        {uploading.personalImage ? (
                          <Loader2 size={20} className="animate-spin text-[var(--color-primary)]"/>
                        ) : (
                          <>
                            <Upload size={18} className="text-slate-400" />
                            <span className="text-xs text-slate-500">انتخاب فایل تصویر پرسنلی</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          disabled={uploading.personalImage}
                          onChange={(e) => uploadImage(e.target.files[0], 'personalImage')}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* فیلد آپلود مدرک مربیگری */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">تصویر مدرک یا حکم مربیگری معتبر</label>
                  <div className="relative flex items-center justify-center border border-dashed border-slate-200 rounded-[var(--radius)] bg-slate-50/50 p-4 transition-colors hover:bg-slate-50">
                    {applyFormData.certificateImage ? (
                      <div className="flex items-center justify-between w-full text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg">
                        <span className="flex items-center gap-1"><CheckCircle2 size={14}/> حکم مربیگری آپلود شد</span>
                        <img src={applyFormData.certificateImage} className="h-8 w-12 rounded object-cover border"/>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-1 cursor-pointer w-full">
                        {uploading.certificateImage ? (
                          <Loader2 size={20} className="animate-spin text-[var(--color-primary)]"/>
                        ) : (
                          <>
                            <Upload size={18} className="text-slate-400" />
                            <span className="text-xs text-slate-500">انتخاب فایل حکم مربیگری</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          disabled={uploading.certificateImage}
                          onChange={(e) => uploadImage(e.target.files[0], 'certificateImage')}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* دکمه ثبت نهایی درخواست */}
                <button
                  type="submit"
                  disabled={submitLoading || uploading.personalImage || uploading.certificateImage}
                  className="w-full py-2.5 bg-[var(--color-primary)] text-white font-bold text-xs rounded-[var(--radius)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 pt-3 shadow-md shadow-[var(--color-primary)]/10"
                >
                  {submitLoading && <Loader2 size={14} className="animate-spin" />}
                  ارسال درخواست و مدارک به مدیریت
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}