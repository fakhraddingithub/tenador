'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import { 
  User, Mail, Phone, Calendar, Edit3, CheckCircle2,
  Copy, Download, Award, ShieldCheck, Save, X, QrCode,
  Upload, Link, Loader2, Users, AlertCircle, FileText
} from 'lucide-react'

// تشخیص اینکه آدرس آپلودشده PDF است یا تصویر (برای نمایش پیش‌نمایش مناسب)
const isPdfUrl = (url) => typeof url === 'string' && /\.pdf(\?|$)/i.test(url)

// نمایش PDF از طریق پراکسی سرور (Cloudinary تحویل مستقیم PDF را مسدود می‌کند)
const pdfViewerUrl = (url) => `/api/files/pdf?url=${encodeURIComponent(url)}`

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

  // استیت‌های مودال تایید انتخاب مربی با کد معرف
  const [coachPreview, setCoachPreview] = useState(null) // اطلاعات مربی پیدا شده
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [uploading, setUploading] = useState({ certificateImage: false, personalImage: false, avatar: false })
  const [applyFormData, setApplyFormData] = useState({ fullName: '', certificateImage: '', personalImage: '' })
  const [submitLoading, setSubmitLoading] = useState(false)

  const [savingProfile, setSavingProfile] = useState(false)

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
    // در حین آپلودِ مدارک، اجازه‌ی ذخیره نده تا URL ناقص ثبت نشود
    if (uploading.avatar || uploading.coachCertificate) {
      return toast.warn('لطفاً تا پایان آپلود فایل صبر کنید')
    }

    setSavingProfile(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          // فیلدهای مربی (سرور برای کاربر غیرمربی نادیده می‌گیرد)
          avatar: formData.avatar,
          certificateImage: formData.coachCertificate,
        }),
      })
      const data = await res.json().catch(() => null)

      if (res.ok) {
        setEditing(false)
        toast.success(data?.message || 'پروفایل با موفقیت بروزرسانی شد')
        // دریافت دیتای قطعی از سرور تا کارت مربیگری/آواتار همگام شود
        fetchUserProfile()
      } else {
        toast.error(data?.message || 'خطا در بروزرسانی اطلاعات')
      }
    } catch {
      toast.error('خطا در اتصال به شبکه')
    } finally {
      setSavingProfile(false)
    }
  }

  // ۱. آپلود فایل (تصویر یا PDF) با مدیریت کامل خطاها.
  // - field: کلید استیت uploading برای کنترل اسپینر همان فیلد
  // - inputEl: المان input برای ریست‌کردن مقدار پس از پایان (تا انتخاب مجددِ همان فایل کار کند)
  // - allowPdf: آیا علاوه‌بر تصویر، PDF هم مجاز است (مدرک/حکم مربیگری)
  // - onSuccess: کال‌بک دریافت URL نهایی برای ذخیره در استیت مربوطه
  // هر مسیر خطا (نوع/حجم نامعتبر، تایم‌اوت، خطای شبکه، خطای سرور) پیام فارسیِ مشخص نشان می‌دهد
  // و در نهایت همیشه اسپینر خاموش می‌شود (بدون اسپینر بی‌نهایت).
  const MAX_UPLOAD = 5 * 1024 * 1024; // ۵ مگابایت
  const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];

  const uploadFile = async (file, field, inputEl, { allowPdf = false, onSuccess }) => {
    if (!file) return;

    // اعتبارسنجی سمت کلاینت: نوع فایل
    const allowedTypes = allowPdf ? [...IMAGE_TYPES, 'application/pdf'] : IMAGE_TYPES;
    const extOk = allowPdf
      ? /\.(jpe?g|png|webp|svg|pdf)$/i.test(file.name || '')
      : /\.(jpe?g|png|webp|svg)$/i.test(file.name || '');
    if (!allowedTypes.includes(file.type) && !extOk) {
      if (inputEl) inputEl.value = '';
      return toast.error(
        allowPdf
          ? 'فرمت فایل نامعتبر است. فقط تصویر (JPG/PNG/WebP) یا PDF مجاز است'
          : 'فرمت فایل نامعتبر است. فقط تصویر (JPG/PNG/WebP) مجاز است'
      );
    }

    // اعتبارسنجی سمت کلاینت: حجم فایل
    if (file.size > MAX_UPLOAD) {
      if (inputEl) inputEl.value = '';
      return toast.error('حجم فایل نباید بیشتر از ۵ مگابایت باشد');
    }

    setUploading((p) => ({ ...p, [field]: true }));

    // تایم‌اوت برای جلوگیری از اسپینر بی‌نهایت در صورت کندی/قطعی شبکه
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'coach-docs');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      });

      // ممکن است سرور پاسخ غیرJSON بدهد (مثلاً محدودیت حجم در لایه‌ی پلتفرم)
      let data = null;
      try { data = await res.json(); } catch { /* پاسخ JSON نبود */ }

      if (!res.ok) {
        const fallback = res.status === 413
          ? 'حجم فایل بیش از حد مجاز است'
          : res.status === 415
            ? 'فرمت فایل مجاز نیست'
            : 'خطای سرور هنگام آپلود فایل';
        throw new Error(data?.error || fallback);
      }

      if (!data?.url) throw new Error('پاسخ نامعتبر از سرور دریافت شد');

      onSuccess(data.url);
      toast.success('فایل با موفقیت آپلود شد');
    } catch (err) {
      if (err?.name === 'AbortError') {
        toast.error('آپلود به دلیل کندی یا قطعی شبکه متوقف شد. دوباره تلاش کنید');
      } else if (err instanceof TypeError) {
        // خطای شبکه‌ی fetch (قطع اینترنت، CORS، عدم دسترسی به سرور)
        toast.error('خطای شبکه؛ اتصال اینترنت خود را بررسی کنید');
      } else {
        toast.error(err?.message || 'آپلود فایل ناموفق بود');
      }
    } finally {
      clearTimeout(timeoutId);
      setUploading((p) => ({ ...p, [field]: false }));
      if (inputEl) inputEl.value = '';
    }
  };

  // هِلپرِ آپلود برای فرم درخواست مربیگری (ذخیره در applyFormData)
  const uploadApplyFile = (file, field, inputEl, allowPdf = false) =>
    uploadFile(file, field, inputEl, {
      allowPdf,
      onSuccess: (url) => setApplyFormData((p) => ({ ...p, [field]: url })),
    });

  // هِلپرِ آپلود برای ویرایش پروفایلِ مربی (ذخیره در formData)
  const uploadProfileFile = (file, field, inputEl, allowPdf = false) =>
    uploadFile(file, field, inputEl, {
      allowPdf,
      onSuccess: (url) => setFormData((p) => ({ ...p, [field]: url })),
    });

  // ۲. ارسال نهایی درخواست مربیگری به سرور
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    // عکس پرسنلی اختیاری است؛ فقط نام و مدرک مربیگری الزامی‌اند
    if (!applyFormData.fullName || !applyFormData.certificateImage) {
      return toast.warn('لطفاً نام و مدرک مربیگری را تکمیل کنید');
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

  // ۳. جستجوی مربی با کد معرف و باز کردن مودال تایید
  const handleLookupCoach = async () => {
    if (!coachCodeInput.trim()) return toast.warn('کد مربی را وارد کنید');
    setLinkLoading(true);

    try {
      const res = await fetch(`/api/profile/coach-lookup?code=${encodeURIComponent(coachCodeInput.trim())}`);
      const data = await res.json();

      if (res.ok) {
        setCoachPreview(data.coach); // باز شدن مودال با اطلاعات مربی
      } else {
        toast.error(data.message || 'مربی با این کد یافت نشد');
      }
    } catch {
      toast.error('خطای ارتباط با سرور');
    } finally {
      setLinkLoading(false);
    }
  };

  // ۴. تایید نهایی و اتصال به مربی انتخاب شده
  const handleConfirmCoach = async () => {
    if (!coachPreview) return;
    setConfirmLoading(true);

    try {
      const res = await fetch('/api/profile/link-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachCode: coachPreview.coachCode })
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message);
        setCoachPreview(null);
        setCoachCodeInput('');
        fetchUserProfile(); // گرفتن اطلاعات جدید کاربر و دیتای مربی متصل شده
      } else {
        toast.error(data.message || 'خطا در ثبت مربی');
      }
    } catch {
      toast.error('خطای ارتباط با سرور');
    } finally {
      setConfirmLoading(false);
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

                {/* فیلدهای مخصوص مربی: فقط برای کاربری که نقش مربی دارد نمایش داده می‌شوند */}
                {user?.isCoach && (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Award size={14} className="text-[#ffbf00]" />
                      مدارک مربیگری
                    </h3>

                    {/* عکس پرسنلی مربی (همان عکس روی کارت) */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500 block">عکس پرسنلی</label>
                      <div className="relative flex items-center justify-center border border-dashed border-slate-200 rounded-[var(--radius)] bg-slate-50/50 p-4 transition-colors hover:bg-slate-50">
                        {formData.avatar ? (
                          <div className="flex items-center justify-between gap-2 w-full text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg">
                            <span className="flex items-center gap-1"><CheckCircle2 size={14}/> عکس پرسنلی ثبت شد</span>
                            <div className="flex items-center gap-2">
                              <img src={formData.avatar} className="h-8 w-8 rounded-full object-cover border"/>
                              <label className="flex items-center gap-1 cursor-pointer text-[11px] font-bold text-[var(--color-primary)] hover:opacity-80 whitespace-nowrap">
                                {uploading.avatar ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13} />}
                                تغییر تصویر
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploading.avatar}
                                  onChange={(e) => uploadProfileFile(e.target.files[0], 'avatar', e.target)}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center gap-1 cursor-pointer w-full">
                            {uploading.avatar ? (
                              <Loader2 size={20} className="animate-spin text-[var(--color-primary)]"/>
                            ) : (
                              <>
                                <Upload size={18} className="text-slate-400" />
                                <span className="text-xs text-slate-500">انتخاب عکس پرسنلی</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploading.avatar}
                              onChange={(e) => uploadProfileFile(e.target.files[0], 'avatar', e.target)}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* حکم/مدرک مربیگری (تصویر یا PDF) */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500 block">حکم یا مدرک مربیگری (تصویر یا PDF)</label>
                      <div className="relative flex items-center justify-center border border-dashed border-slate-200 rounded-[var(--radius)] bg-slate-50/50 p-4 transition-colors hover:bg-slate-50">
                        {formData.coachCertificate ? (
                          <div className="flex items-center justify-between gap-2 w-full text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg">
                            <span className="flex items-center gap-1"><CheckCircle2 size={14}/> مدرک ثبت شد</span>
                            <div className="flex items-center gap-2">
                              {isPdfUrl(formData.coachCertificate) ? (
                                <a href={pdfViewerUrl(formData.coachCertificate)} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-red-500 underline">
                                  <FileText size={16} /> مشاهده PDF
                                </a>
                              ) : (
                                <img src={formData.coachCertificate} className="h-8 w-12 rounded object-cover border"/>
                              )}
                              <label className="flex items-center gap-1 cursor-pointer text-[11px] font-bold text-[var(--color-primary)] hover:opacity-80 whitespace-nowrap">
                                {uploading.coachCertificate ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13} />}
                                تغییر فایل
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  disabled={uploading.coachCertificate}
                                  onChange={(e) => uploadProfileFile(e.target.files[0], 'coachCertificate', e.target, true)}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center gap-1 cursor-pointer w-full">
                            {uploading.coachCertificate ? (
                              <Loader2 size={20} className="animate-spin text-[var(--color-primary)]"/>
                            ) : (
                              <>
                                <Upload size={18} className="text-slate-400" />
                                <span className="text-xs text-slate-500">انتخاب فایل حکم (تصویر یا PDF)</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              disabled={uploading.coachCertificate}
                              onChange={(e) => uploadProfileFile(e.target.files[0], 'coachCertificate', e.target, true)}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={handleUpdate}
                    disabled={savingProfile || uploading.avatar || uploading.coachCertificate}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[var(--color-primary)] hover:opacity-95 rounded-[var(--radius)] shadow-md shadow-[var(--color-primary)]/10 disabled:opacity-50"
                  >
                    {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
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
                    {user?.coachCode || 'TRXXXX'}
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
                    placeholder="مثال: TR4921"
                    value={coachCodeInput}
                    onChange={(e) => setCoachCodeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLookupCoach() }}
                    className="flex-1 text-center font-mono uppercase rounded-[var(--radius)] border border-[hsl(var(--border))] bg-slate-50 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:bg-white focus:outline-none"
                  />
                  <button
                    onClick={handleLookupCoach}
                    disabled={linkLoading}
                    className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-[var(--radius)] transition-colors disabled:opacity-50 flex items-center justify-center min-w-[70px]"
                  >
                    {linkLoading ? <Loader2 size={14} className="animate-spin" /> : 'جستجوی مربی'}
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
                  <label className="text-xs font-semibold text-slate-600 block">
                    تصویر پرسنلی مربی <span className="text-slate-400 font-normal">(اختیاری)</span>
                  </label>
                  <div className="relative flex items-center justify-center border border-dashed border-slate-200 rounded-[var(--radius)] bg-slate-50/50 p-4 transition-colors hover:bg-slate-50">
                    {applyFormData.personalImage ? (
                      <div className="flex items-center justify-between gap-2 w-full text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg">
                        <span className="flex items-center gap-1"><CheckCircle2 size={14}/> عکس پرسنلی آپلود شد</span>
                        <div className="flex items-center gap-2">
                          <img src={applyFormData.personalImage} className="h-8 w-8 rounded-full object-cover border"/>
                          {/* امکان جایگزینی فایل */}
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] font-bold text-[var(--color-primary)] hover:opacity-80 transition-opacity whitespace-nowrap">
                            {uploading.personalImage ? (
                              <Loader2 size={13} className="animate-spin"/>
                            ) : (
                              <Upload size={13} />
                            )}
                            تغییر تصویر
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploading.personalImage}
                              onChange={(e) => uploadApplyFile(e.target.files[0], 'personalImage', e.target)}
                            />
                          </label>
                        </div>
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
                          onChange={(e) => uploadApplyFile(e.target.files[0], 'personalImage', e.target)}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* فیلد آپلود مدرک مربیگری (تصویر یا PDF) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">حکم یا مدرک مربیگری معتبر (تصویر یا PDF)</label>
                  <div className="relative flex items-center justify-center border border-dashed border-slate-200 rounded-[var(--radius)] bg-slate-50/50 p-4 transition-colors hover:bg-slate-50">
                    {applyFormData.certificateImage ? (
                      <div className="flex items-center justify-between gap-2 w-full text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg">
                        <span className="flex items-center gap-1"><CheckCircle2 size={14}/> حکم مربیگری آپلود شد</span>
                        <div className="flex items-center gap-2">
                          {isPdfUrl(applyFormData.certificateImage) ? (
                            <a href={pdfViewerUrl(applyFormData.certificateImage)} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-red-500 underline">
                              <FileText size={16} /> مشاهده PDF
                            </a>
                          ) : (
                            <img src={applyFormData.certificateImage} className="h-8 w-12 rounded object-cover border"/>
                          )}
                          {/* امکان جایگزینی فایل */}
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] font-bold text-[var(--color-primary)] hover:opacity-80 transition-opacity whitespace-nowrap">
                            {uploading.certificateImage ? (
                              <Loader2 size={13} className="animate-spin"/>
                            ) : (
                              <Upload size={13} />
                            )}
                            تغییر فایل
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              disabled={uploading.certificateImage}
                              onChange={(e) => uploadApplyFile(e.target.files[0], 'certificateImage', e.target, true)}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-1 cursor-pointer w-full">
                        {uploading.certificateImage ? (
                          <Loader2 size={20} className="animate-spin text-[var(--color-primary)]"/>
                        ) : (
                          <>
                            <Upload size={18} className="text-slate-400" />
                            <span className="text-xs text-slate-500">انتخاب فایل حکم (تصویر یا PDF)</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          disabled={uploading.certificateImage}
                          onChange={(e) => uploadApplyFile(e.target.files[0], 'certificateImage', e.target, true)}
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

      {/* ========================================================
          مودال تایید انتخاب مربی با کد معرف (نمایش اطلاعات مربی پیدا شده)
      ======================================================== */}
      <AnimatePresence>
        {coachPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !confirmLoading && setCoachPreview(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 z-10 space-y-5 text-center"
            >
              <button
                onClick={() => !confirmLoading && setCoachPreview(null)}
                className="absolute left-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="space-y-1 pt-1">
                <h3 className="text-sm font-bold text-slate-800">تایید انتخاب مربی</h3>
                <p className="text-[11px] text-slate-400">اطلاعات مربی زیر را بررسی و در صورت صحت تایید کنید.</p>
              </div>

              <div className="flex flex-col items-center gap-3 bg-slate-50 p-5 rounded-[var(--radius)] border border-slate-100">
                <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-[var(--color-primary)] bg-white shadow-sm">
                  <img
                    src={coachPreview.avatar || "https://ui-avatars.com/api/?name=" + (coachPreview.name || "Coach") + "&background=101010&color=ffbf00"}
                    alt={coachPreview.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-800">{coachPreview.name}</h4>
                  <span className="inline-block text-[11px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    {coachPreview.coachCode}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold pt-1">
                  <Users size={13} className="text-slate-400" />
                  {(coachPreview.studentsCount ?? 0).toLocaleString('fa-IR')} شاگرد فعال
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleConfirmCoach}
                  disabled={confirmLoading}
                  className="flex-1 py-2.5 bg-[var(--color-primary)] text-white font-bold text-xs rounded-[var(--radius)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {confirmLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  بله، این مربی من است
                </button>
                <button
                  onClick={() => setCoachPreview(null)}
                  disabled={confirmLoading}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-[var(--radius)] transition-colors disabled:opacity-50"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}