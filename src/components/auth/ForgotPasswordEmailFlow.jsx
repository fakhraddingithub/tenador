'use client';

import { useState, useEffect } from 'react';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaKey, FaArrowRight } from 'react-icons/fa';

// همان کلاس‌های AuthForm.jsx — برای هم‌رنگی دقیق با صفحه‌ی ورود/ثبت‌نام
const inputClass = (error) => `
  w-full h-11 pr-10 pl-4 text-sm
  border ${error ? 'border-red-500' : 'border-[hsl(var(--border))]'}
  rounded-[var(--radius)]
  bg-white text-[hsl(var(--foreground))]
  placeholder:text-gray-400
  focus:outline-none
  focus:border-[hsl(var(--primary))]
  transition
`;

const buttonClass = `
  w-full h-11
  bg-[hsl(var(--primary))]
  text-white text-sm font-medium
  rounded-[var(--radius)]
  hover:opacity-90
  transition
  disabled:opacity-50
`;

const PASSWORD_PATTERN = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$ %^&*-]).{8,}$/;
const RESEND_COOLDOWN_SECONDS = 45;

export default function ForgotPasswordEmailFlow({ onBack, callbackUrl = '/' }) {
  const [step, setStep] = useState('email'); // email | code | password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const submitEmail = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('ایمیل الزامی است');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'خطا در ارسال کد');
        return;
      }
      setResetToken(data.resetToken);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep('code');
    } catch {
      setError('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{5}$/.test(code)) {
      setError('کد باید ۵ رقم باشد');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password-email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'کد نامعتبر است');
        return;
      }
      setStep('password');
    } catch {
      setError('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password-email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'خطا در ارسال مجدد کد');
        return;
      }
      setResetToken(data.resetToken);
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('رمز عبور حداقل ۸ کاراکتر باشد');
      return;
    }
    if (!PASSWORD_PATTERN.test(password)) {
      setError('رمز عبور باید شامل حروف بزرگ، کوچک، عدد و کاراکتر ویژه باشد');
      return;
    }
    if (password !== confirmPassword) {
      setError('رمز عبور و تکرار آن یکسان نیستند');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password-email/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'خطا در تغییر رمز عبور');
        return;
      }
      window.location.href = callbackUrl || '/';
    } catch {
      setError('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 text-right">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 mb-2"
      >
        <FaArrowRight className="text-[10px]" />
        بازگشت به ورود
      </button>

      {step === 'email' && (
        <form onSubmit={submitEmail} className="space-y-4">
          <p className="text-sm text-slate-500">
            ایمیل حساب کاربری خود را وارد کنید تا کد بازیابی رمز عبور برایتان ارسال شود.
          </p>
          <div className="relative">
            <FaEnvelope className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              disabled={loading}
              placeholder="ایمیل"
              dir="ltr"
              autoComplete="email"
              className={inputClass(error) + ' text-left'}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'در حال ارسال…' : 'ارسال کد'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={submitCode} className="space-y-4">
          <p className="text-sm text-slate-500">کد ۵ رقمی ارسال‌شده به ایمیل خود را وارد کنید.</p>
          <div className="relative">
            <FaKey className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 5)); setError(''); }}
              disabled={loading}
              placeholder="کد ۵ رقمی"
              inputMode="numeric"
              dir="ltr"
              className={inputClass(error) + ' text-center tracking-widest'}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'در حال بررسی…' : 'تأیید کد'}
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || loading}
            className="w-full text-xs font-medium text-[#aa4725] hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
          >
            {cooldown > 0 ? `ارسال مجدد کد (${cooldown} ثانیه)` : 'ارسال مجدد کد'}
          </button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={submitPassword} className="space-y-4">
          <p className="text-sm text-slate-500">رمز عبور جدید خود را وارد کنید.</p>
          <div className="relative">
            <FaLock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              disabled={loading}
              placeholder="رمز عبور جدید"
              autoComplete="new-password"
              className={inputClass(error) + ' pl-10'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          <div className="relative">
            <FaLock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              disabled={loading}
              placeholder="تکرار رمز عبور"
              autoComplete="new-password"
              className={inputClass(error) + ' pl-10'}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'در حال ثبت…' : 'تغییر رمز عبور'}
          </button>
        </form>
      )}
    </div>
  );
}
