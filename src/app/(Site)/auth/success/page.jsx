'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeLoginReturn } from 'base/utils/safeLoginReturn';

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const next = safeLoginReturn(searchParams.get('next'));

  useEffect(() => {
    // OAuth consent is an HTML route handler, not an RSC page. Navigate the
    // document after cookies are committed; this also refreshes auth context.
    window.location.replace(next);
  }, [next]);

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
