'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  useEffect(() => {
    // کوکی الان کاملاً در مرورگر commit شده
    // refresh کش client رو پاک میکنه → Navbar آپدیت میشه
    router.refresh();
    router.push(next);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#aa4725] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">در حال ورود...</p>
      </div>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <AuthSuccessContent />
    </Suspense>
  );
}