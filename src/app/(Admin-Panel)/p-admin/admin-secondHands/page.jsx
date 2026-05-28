'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiPackage, FiShield, FiArrowRight, FiPlus,
  FiChevronLeft, FiCheck, FiTag,
} from 'react-icons/fi';
import { FaBoxOpen } from 'react-icons/fa';

/* ─── کارت آمار ─── */
function StatCard({ label, value, color = 'text-neutral-800' }) {
  return (
    <div className="bg-white border border-neutral-100 rounded-[var(--radius)] px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold text-neutral-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
    </div>
  );
}

/* ─── کارت دسترسی سریع ─── */
function SectionCard({ icon: Icon, title, desc, href, createHref, accent, stats }) {
  const router = useRouter();
  const isOrange = accent === 'orange';

  const base = isOrange ? 'text-[var(--color-primary)]' : 'text-blue-500';
  const light = isOrange ? 'bg-orange-50' : 'bg-blue-50';
  const btn = isOrange
    ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90'
    : 'bg-blue-500 hover:bg-blue-600';
  const addBtn = isOrange
    ? 'border-orange-200 text-[var(--color-primary)] hover:bg-orange-50'
    : 'border-blue-200 text-blue-500 hover:bg-blue-50';
  const bar = isOrange ? 'bg-[var(--color-primary)]' : 'bg-blue-500';

  return (
    <div className="bg-white border border-neutral-100 rounded-[var(--radius)] shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
      <div className={`h-1 w-full ${bar}`} />
      <div className="p-7 flex flex-col flex-grow">

        <div className="flex items-start justify-between mb-5">
          <div className={`p-3 ${light} rounded-[var(--radius)]`}>
            <Icon size={22} className={base} />
          </div>
          <button
            onClick={() => router.push(createHref)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${addBtn}`}
          >
            <FiPlus size={12} /> افزودن
          </button>
        </div>

        <h2 className="text-lg font-bold text-neutral-800 mb-1">{title}</h2>
        <p className="text-sm text-neutral-400 leading-relaxed mb-6">{desc}</p>

        {/* آمار */}
        {stats?.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center bg-neutral-50 rounded-[var(--radius)] py-2.5">
                <p className="text-base font-bold text-neutral-700">{s.value ?? '—'}</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex-grow" />

        <Link
          href={href}
          className={`flex items-center justify-between w-full px-4 py-3 rounded-[var(--radius)] font-bold text-sm text-white transition-all ${btn}`}
        >
          <span>ورود به {title}</span>
          <FiChevronLeft size={16} />
        </Link>
      </div>
    </div>
  );
}

/* ─── ردیف محصول اخیر ─── */
function RecentRow({ item }) {
  const isAvailable = item.status === 'available';
  return (
    <Link
      href={`/p-admin/admin-secondHands/used-products/${item._id}/edit`}
      className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-all group"
    >
      <div className="w-11 h-11 rounded-[var(--radius)] overflow-hidden bg-neutral-100 flex-shrink-0">
        {item.baseProduct?.mainImage
          ? <img src={item.baseProduct.mainImage} alt="" className="w-full h-full object-cover" />
          : <FiPackage className="w-full h-full p-2.5 text-neutral-300" />
        }
      </div>

      <div className="flex-grow min-w-0">
        <p className="font-bold text-sm text-neutral-800 truncate group-hover:text-[var(--color-primary)] transition-colors">
          {item.name}
        </p>
        <p className="text-[11px] text-neutral-400 mt-0.5">{item.baseProduct?.category?.title}</p>
      </div>

      {item.overallScore != null && (
        <div className="flex-shrink-0 text-center px-2">
          <p className="text-base font-bold text-[var(--color-primary)]">{item.overallScore}</p>
          <p className="text-[10px] text-neutral-400">از ۱۰</p>
        </div>
      )}

      <div className="flex-shrink-0 text-left hidden sm:block">
        <p className="text-sm font-bold text-neutral-700">{item.price?.toLocaleString('fa-IR')}</p>
        <p className="text-[10px] text-neutral-400">تومان</p>
      </div>

      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0 ${isAvailable ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-400'
        }`}>
        {isAvailable ? <FiCheck size={10} /> : <FiTag size={10} />}
        {isAvailable ? 'موجود' : 'فروخته‌شده'}
      </div>

      <FiChevronLeft size={13} className="text-neutral-300 group-hover:text-[var(--color-primary)] transition-colors flex-shrink-0" />
    </Link>
  );
}

/* ─── صفحه اصلی Hub ─── */
export default function UsedProductsHubPage() {
  const [stats, setStats] = useState(null);
  const [recentItems, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/used-products?page=1').then(r => r.json()),
      fetch('/api/admin/healthcards').then(r => r.json()),
    ])
      .then(([usedData, cardData]) => {
        const items = usedData.items || [];
        setStats({
          total: usedData.total || 0,
          available: items.filter(i => i.status === 'available').length,
          sold: items.filter(i => i.status === 'sold').length,
          cards: (cardData.cards || []).length,
        });
        setRecent(items.slice(0, 6));
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-20">

      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-neutral-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/p-admin"
                className="p-2 hover:bg-neutral-100 rounded-[var(--radius)] transition-all text-neutral-400 hover:text-neutral-700"
              >
                <FiArrowRight size={19} />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[var(--color-primary)]/10 rounded-[var(--radius)]">
                  <FaBoxOpen size={20} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-neutral-800">بازار دست‌دوم</h1>
                  <p className="text-xs text-neutral-400 mt-0.5">مدیریت محصولات کارکرده و کارت‌های سلامت</p>
                </div>
              </div>
            </div>

            <Link
              href="/p-admin/admin-secondHands/used-products/create"
              className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-5 py-2.5 rounded-[var(--radius)] text-sm font-bold hover:shadow-lg hover:shadow-[var(--color-primary)]/20 transition-all"
            >
              <FiPlus size={16} /> محصول جدید
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-10 space-y-8">

        {/* ─── آمار ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-neutral-100 animate-pulse rounded-[var(--radius)]" />
            ))
          ) : (
            <>
              <StatCard label="کل محصولات" value={stats?.total} color="text-neutral-800" />
              <StatCard label="موجود" value={stats?.available} color="text-green-600" />
              <StatCard label="فروخته شده" value={stats?.sold} color="text-red-500" />
              <StatCard label="کارت سلامت" value={stats?.cards} color="text-blue-500" />
            </>
          )}
        </div>

        {/* ─── دو کارت اصلی ─── */}
        <div className="grid md:grid-cols-2 gap-6">
          <SectionCard
            icon={FiPackage}
            title="محصولات دست‌دوم"
            desc="ثبت، ویرایش و قیمت‌گذاری محصولات کارکرده به همراه ارزیابی وضعیت با ستاره‌دهی"
            href="/p-admin/admin-secondHands/used-products"
            createHref="/p-admin/admin-secondHands/used-products/create"
            accent="orange"
            stats={[
              { label: 'کل', value: stats?.total },
              { label: 'موجود', value: stats?.available },
              { label: 'فروخته‌شده', value: stats?.sold },
            ]}
          />
          <SectionCard
            icon={FiShield}
            title="کارت‌های سلامت"
            desc="تعریف قالب ارزیابی برای هر دسته‌بندی تا بررسی وضعیت محصولات استاندارد شود"
            href="/p-admin/admin-secondHands/healthcards"
            createHref="/p-admin/admin-secondHands/healthcards/create"
            accent="blue"
            stats={[
              { label: 'قالب تعریف‌شده', value: stats?.cards },
              { label: '', value: null },
              { label: '', value: null },
            ]}
          />
        </div>

        {/* ─── آخرین محصولات ─── */}
        <div className="bg-white border border-neutral-100 rounded-[var(--radius)] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-50">
            <h3 className="font-bold text-neutral-700 flex items-center gap-2">
              <FiPackage size={16} className="text-[var(--color-primary)]" />
              آخرین محصولات ثبت‌شده
            </h3>
            <Link
              href="/p-admin/admin-secondHands/used-products"
              className="text-xs text-[var(--color-primary)] font-bold hover:underline flex items-center gap-1"
            >
              مشاهده همه <FiChevronLeft size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="divide-y divide-neutral-50">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-11 h-11 rounded-[var(--radius)] bg-neutral-100 animate-pulse flex-shrink-0" />
                  <div className="flex-grow space-y-2">
                    <div className="h-3 bg-neutral-100 animate-pulse rounded w-40" />
                    <div className="h-2 bg-neutral-100 animate-pulse rounded w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentItems.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <FiPackage size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">هنوز محصولی ثبت نشده</p>
              <Link
                href="/p-admin/admin-secondHands/used-products/create"
                className="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-primary)] font-bold hover:underline"
              >
                <FiPlus size={12} /> ثبت اولین محصول
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {recentItems.map(item => <RecentRow key={item._id} item={item} />)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}