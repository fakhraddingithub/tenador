'use client';

import { useState, useEffect, useRef } from 'react';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowRight } from 'react-icons/fa';

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

const RESEND_COOLDOWN_SECONDS = 45;
const CODE_LENGTH = 5;

export default function ForgotPasswordEmailFlow({ onBack, callbackUrl = '/' }) {
  const [step, setStep] = useState('email'); // email | code | password
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const digitRefs = useRef([]);
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

  const verifyCode = async (codeValue) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password-email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, code: codeValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'کد نامعتبر است');
        applyDigits(Array(CODE_LENGTH).fill(''));
        digitRefs.current[0]?.focus();
        return;
      }
      setStep('password');
    } catch {
      setError('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  // شاخصِ «آخرین خانه‌ی مجاز برای فوکوس» در یک ref نگه داشته می‌شود (نه state) تا
  // بلافاصله پس از تایپ هر رقم به‌روز باشد — با state، فوکوسِ برنامه‌ای روی خانه‌ی
  // بعدی زودتر از re-render اجرا می‌شد و onFocus آن با مقدار قدیمی digits آن را
  // به عقب برمی‌گرداند (باگ «فوکوس خودکار به خانه‌ی بعد نمی‌رود»).
  const allowedIndexRef = useRef(0);

  const applyDigits = (next) => {
    setDigits(next);
    const idx = next.findIndex((d) => d === '');
    allowedIndexRef.current = idx === -1 ? CODE_LENGTH - 1 : idx;
  };

  const handleDigitFocus = (i) => {
    if (i > allowedIndexRef.current) {
      digitRefs.current[allowedIndexRef.current]?.focus();
    }
  };

  const handleDigitChange = (i, value) => {
    const v = value.replace(/\D/g, '').slice(-1);
    if (!v) return;
    setError('');
    const next = [...digits];
    next[i] = v;
    applyDigits(next);
    if (i < CODE_LENGTH - 1) {
      digitRefs.current[i + 1]?.focus();
    }
    if (next.every((d) => d !== '')) {
      verifyCode(next.join(''));
    }
  };

  const handleDigitKeyDown = (i, e) => {
    if (e.key !== 'Backspace') return;
    e.preventDefault();
    setError('');
    if (digits[i]) {
      const next = [...digits];
      next[i] = '';
      applyDigits(next);
      return;
    }
    if (i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      applyDigits(next);
      digitRefs.current[i - 1]?.focus();
    }
  };

  const handleDigitPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    setError('');
    const next = Array(CODE_LENGTH).fill('');
    for (let idx = 0; idx < pasted.length; idx += 1) next[idx] = pasted[idx];
    applyDigits(next);
    digitRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
    if (next.every((d) => d !== '')) {
      verifyCode(next.join(''));
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
      applyDigits(Array(CODE_LENGTH).fill(''));
      digitRefs.current[0]?.focus();
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
        <div className="space-y-4">
          <p className="text-sm text-slate-500">کد ۵ رقمی ارسال‌شده به ایمیل خود را وارد کنید.</p>
          {/* globals.css دارد `* { direction: rtl }` — dir="ltr" روی این عنصر توسط آن
              قانون author-level بی‌اثر می‌شود، پس با یک کلاس Tailwind با ویژگیِ
              دلخواه ست می‌شود تا اولویتِ بیشتری نسبت به سلکتور همگانی داشته باشد */}
          <div className="flex justify-center gap-2 [direction:ltr]">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { digitRefs.current[i] = el; }}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                onFocus={() => handleDigitFocus(i)}
                onPaste={handleDigitPaste}
                disabled={loading}
                inputMode="numeric"
                maxLength={1}
                className={`w-11 h-11 text-center text-lg font-bold border [direction:ltr] ${error ? 'border-red-500' : 'border-[hsl(var(--border))]'} rounded-[var(--radius)] bg-white text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--primary))] transition`}
              />
            ))}
          </div>
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          {loading && <p className="text-xs text-slate-400 text-center">در حال بررسی…</p>}
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || loading}
            className="w-full text-xs font-medium text-[hsl(var(--primary))] hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
          >
            {cooldown > 0 ? `ارسال مجدد کد (${cooldown} ثانیه)` : 'ارسال مجدد کد'}
          </button>
        </div>
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
