'use client';

import { useState } from 'react';
import { FaEye, FaEyeSlash, FaPhone, FaLock, FaUser } from 'react-icons/fa';

export default function AuthForm({ isLogin, onSubmit, loading }) {
  const [form, setForm] = useState({
    phone: '',
    password: '',
    confirmPassword: '',
    name: '',
    lastName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // تبدیل ارقام فارسی/عربی به ارقام انگلیسی
  const toEnglishDigits = (str) =>
    str
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // فارسی
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)); // عربی

  const update = (e) => {
    const { name, value } = e.target;
    let nextValue = value;

    // فیلد شماره تلفن: ارقام فارسی/عربی را انگلیسی کن و هر چیز غیر از رقم را حذف کن
    if (name === 'phone') {
      nextValue = toEnglishDigits(value).replace(/\D/g, '');
    }

    setForm({ ...form, [name]: nextValue });
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const validate = () => {
    const err = {};

    if (!/^09\d{9}$/.test(form.phone)) {
      err.phone = 'شماره تلفن معتبر نیست';
    }

    if (form.password.length < 8) {
      err.password = 'رمز عبور حداقل ۸ کاراکتر';
    }

    if (!isLogin) {
      if (form.confirmPassword.length < 8) {
        err.confirmPassword = 'رمز عبور حداقل ۸ کاراکتر';
      } else if (form.password !== form.confirmPassword) {
        err.confirmPassword = 'رمز عبور و تکرار آن یکسان نیستند';
      }
    }

    if (!isLogin && !form.name.trim()) {
      err.name = '\u0646\u0627\u0645 \u0631\u0627 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f';
    }
    if (!isLogin && !form.lastName.trim()) {
      err.lastName = '\u0646\u0627\u0645 \u062e\u0627\u0646\u0648\u0627\u062f\u06af\u06cc \u0631\u0627 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f';
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit?.(form);
  };

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

  return (
    <form onSubmit={submit} className="space-y-4 text-right">
      {!isLogin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative">
            <FaUser className="absolute right-3 top-[22px] -translate-y-1/2 text-gray-400 text-sm" />
            <input
              name="name"
              placeholder={"\u0646\u0627\u0645"}
              value={form.name}
              onChange={update}
              disabled={loading}
              autoComplete="given-name"
              className={inputClass(errors.name)}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div className="relative">
            <FaUser className="absolute right-3 top-[22px] -translate-y-1/2 text-gray-400 text-sm" />
            <input
              name="lastName"
              placeholder={"\u0646\u0627\u0645 \u062e\u0627\u0646\u0648\u0627\u062f\u06af\u06cc"}
              value={form.lastName}
              onChange={update}
              disabled={loading}
              autoComplete="family-name"
              className={inputClass(errors.lastName)}
            />
            {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
          </div>
        </div>
      )}

      <div className="relative">
        <FaPhone className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input
          name="phone"
          placeholder="شماره تلفن"
          value={form.phone}
          onChange={update}
          disabled={loading}
          inputMode="numeric"
          className={inputClass(errors.phone)}
        />
        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
      </div>

      <div className="relative">
        <FaLock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input
          type={showPassword ? 'text' : 'password'}
          name="password"
          placeholder="رمز عبور"
          value={form.password}
          onChange={update}
          disabled={loading}
          className={inputClass(errors.password) + ' pl-10'}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
      </div>

      {!isLogin && (
        <div className="relative">
          <FaLock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirmPassword"
            placeholder={"\u062a\u06a9\u0631\u0627\u0631 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631"}
            value={form.confirmPassword}
            onChange={update}
            disabled={loading}
            autoComplete="new-password"
            className={inputClass(errors.confirmPassword) + ' pl-10'}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={"\u0646\u0645\u0627\u06cc\u0634 \u06cc\u0627 \u067e\u0646\u0647\u0627\u0646 \u06a9\u0631\u062f\u0646 \u062a\u06a9\u0631\u0627\u0631 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631"}
          >
            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
          {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="
          w-full h-11
          bg-[hsl(var(--primary))]
          text-white text-sm font-medium
          rounded-[var(--radius)]
          hover:opacity-90
          transition
          disabled:opacity-50
        "
      >
        {loading ? 'در حال پردازش…' : isLogin ? 'ورود' : 'ثبت‌نام'}
      </button>
    </form>
  );
}
