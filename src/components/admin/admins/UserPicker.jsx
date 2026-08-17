'use client';

/**
 * src/components/admin/admins/UserPicker.jsx
 *
 * انتخابگرِ کاربر برای ساختِ عضویتِ ادمین (فاز ۳).
 *
 * چرا انتخاب از فهرستِ کاربران و نه تایپِ دستیِ نام/نام‌کاربری:
 * عضویتِ بدون کاربر به هیچ نشستی map نمی‌شود، پس ردیفی می‌ساخت که در UI
 * «ادمینِ فعال» به‌نظر می‌رسید ولی هیچ‌کس نمی‌توانست با آن وارد شود.
 *
 * کاربرانِ دارای عضویت پنهان *نمی‌شوند*: با برچسبِ وضعیت نمایش داده می‌شوند تا
 * به‌جای «پیدا نشد»، مسیرِ درست (ویرایش/بازفعال‌سازی) دیده شود.
 */

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Search, UserCheck, ShieldAlert, Ban, ChevronLeft, ChevronRight } from 'lucide-react';

const BLOCKED_LABEL = {
  banned: 'کاربر مسدود است',
  'already-member': 'از قبل عضویت دارد',
};

export default function UserPicker({ value, onSelect }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  // debounce — setState داخل callback تایمر است، نه در بدنه‌ی effect
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const params = new URLSearchParams({ page: String(page), limit: '10' });
  if (debounced) params.set('search', debounced);

  const { data, isLoading } = useSWR(`/api/admin/admins/candidates?${params}`, {
    keepPreviousData: true,
  });

  const users = data?.users || [];
  const pages = data?.pages || 1;
  const loading = isLoading;

  if (value) {
    return (
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4"
        dir="rtl"
      >
        <div className="flex items-center gap-3 min-w-0">
          <UserCheck size={18} className="text-emerald-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate">
              {[value.name, value.lastName].filter(Boolean).join(' ') || 'بدون نام'}
            </p>
            <p className="text-[11px] text-gray-500 truncate" dir="ltr">
              {value.phone || value.email || value._id}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-[11px] font-bold text-emerald-700 underline underline-offset-4 self-start sm:self-auto"
        >
          تغییر کاربر
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="relative">
        <Search
          size={14}
          className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو بر اساس نام، شماره یا ایمیل…"
          className="w-full border-2 border-gray-200 rounded-[var(--radius)] bg-white py-2.5 pr-9 pl-3 text-xs font-bold focus:outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e8e4df' }}>
        {loading && (
          <p className="p-4 text-[11px] font-bold text-gray-400">در حال جست‌وجو…</p>
        )}

        {!loading && !users.length && (
          <p className="p-4 text-[11px] font-bold text-gray-400">کاربری یافت نشد</p>
        )}

        {!loading &&
          users.map((user) => {
            const blocked = !!user.blockedReason;
            return (
              <div
                key={user._id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between border-b last:border-b-0 p-3"
                style={{ borderColor: '#f0ede9' }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">
                    {[user.name, user.lastName].filter(Boolean).join(' ') || 'بدون نام'}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate" dir="ltr">
                    {user.phone || user.email || '—'}
                  </p>
                </div>

                {blocked ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                      {user.blockedReason === 'banned' ? (
                        <Ban size={11} />
                      ) : (
                        <ShieldAlert size={11} />
                      )}
                      {BLOCKED_LABEL[user.blockedReason]}
                    </span>

                    {user.membership && (
                      <Link
                        href={`/p-admin/users/admins/edit/${user.membership._id}`}
                        className="text-[10px] font-bold text-[var(--color-primary)] underline underline-offset-4"
                      >
                        {user.membership.isActive ? 'ویرایش عضویت' : 'فعال‌سازی دوباره'}
                      </Link>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(user)}
                    className="text-[11px] font-bold text-white rounded-lg px-3 py-1.5 flex-shrink-0 self-start sm:self-auto"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    انتخاب
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 disabled:opacity-40"
          >
            <ChevronRight size={13} />
            قبلی
          </button>
          <span className="text-[11px] font-bold text-gray-400">
            صفحه {page} از {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 disabled:opacity-40"
          >
            بعدی
            <ChevronLeft size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
