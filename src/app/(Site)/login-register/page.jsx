'use client';

import { useState, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import GoogleButton from '@/components/auth/GoogleButton';
import { useForgotPassword } from '@/components/auth/useForgotPassword';
import { showToast } from '@/lib/toast';
import { loginAction } from 'base/actions/authActions';

function AuthContent() {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const { forgotPassword } = useForgotPassword();

  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      if (mode === 'login') {
        // Server Action — کوکی سمت سرور ست می‌شود، سپس کلاینت hard-navigation می‌کند
        const result = await loginAction({ ...data, callbackUrl });

        if (result?.error) {
          showToast.error(result.error);
        } else if (result?.success) {
          // hard navigation: جزیره‌ی UserProvider با وضعیت جدید مانت می‌شود
          window.location.href = result.redirectUrl || '/';
          return;
        }
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const result = await res.json();

        if (!res.ok) {
          showToast.error(result.message || 'خطا در عملیات');
          return;
        }

        // ورود خودکار پس از ثبت‌نام موفق — همان مکانیزم ورود عادی (loginAction)
        const loginResult = await loginAction({
          phone: data.phone,
          password: data.password,
          callbackUrl,
        });

        if (loginResult?.error) {
          // ثبت‌نام موفق بود ولی ورود خودکار ناموفق — کاربر را به تب ورود می‌بریم
          showToast.success('ثبت‌نام با موفقیت انجام شد، لطفاً وارد شوید');
          setMode('login');
          return;
        }

        showToast.success('ثبت‌نام با موفقیت انجام شد');
        // hard-navigation مشابه مسیر ورود عادی
        window.location.href = loginResult?.redirectUrl || '/';
        return;
      }
    }catch (error) {
      // redirect() در Next.js یه error خاص throw میکنه — نباید بهش دست بزنیم
      if (error?.digest?.startsWith('NEXT_REDIRECT')) throw error;
      showToast.error('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    document.cookie = `oauth_callback=${encodeURIComponent(callbackUrl)}; path=/; SameSite=Lax; Max-Age=300`;
    window.location.href = `/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  };

  return (
    <div className="w-full max-w-md bg-white border border-[hsl(var(--border))] rounded-2xl p-6 shadow-xl shadow-slate-200/50">
      {/* Tabs */}
      <div className="flex justify-center gap-10 mb-8 text-sm font-bold relative">
        {['login', 'register'].map((item) => (
          <button
            key={item}
            onClick={() => setMode(item)}
            className={`pb-2 transition-all relative
              ${mode === item
                ? 'text-[#aa4725]'
                : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            {item === 'login' ? 'ورود به حساب' : 'ایجاد حساب'}
            {mode === item && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#aa4725]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Form Slider */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'login' ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'login' ? -30 : 30 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <AuthForm
              isLogin={mode === 'login'}
              onSubmit={handleSubmit}
              loading={loading}
            />

            {mode === 'login' && (
              <div className="text-right">
                <button
                  onClick={forgotPassword}
                  className="mt-4 text-xs font-medium text-[#aa4725] hover:underline"
                >
                  رمز عبور را فراموش کرده‌اید؟
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="my-8 flex items-center gap-4">
        <span className="flex-1 h-px bg-slate-100" />
        <span className="text-xs font-medium text-slate-400">یا ورود با</span>
        <span className="flex-1 h-px bg-slate-100" />
      </div>

      <GoogleButton onClick={handleGoogleLogin} disabled={loading} />

      <p className="mt-6 text-center text-[10px] text-slate-400">
        با ورود به سایت، تمامی قوانین و مقررات ما را می‌پذیرید.
      </p>
    </div>
  );
}

export default function LoginRegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#aa4725] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">در حال بارگذاری...</p>
        </div>
      }>
        <AuthContent />
      </Suspense>
    </div>
  );
}