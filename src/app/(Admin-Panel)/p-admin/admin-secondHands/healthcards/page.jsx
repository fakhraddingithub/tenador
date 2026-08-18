'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { FiPlus, FiEdit3, FiTrash2, FiLayers } from 'react-icons/fi';
import { showToast } from '@/lib/toast';
import { confirmDelete } from '@/lib/swal';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';

// 🟢 محتوا/داده‌ی مرجع — پنجره‌ی ۵ دقیقه‌ای
const CONTENT_TTL = { dedupingInterval: 300_000 };

export default function HealthCardsPage() {
  const { can } = useAdminPermissions();
  // 🟢 HealthCard ها — داده‌ی مرجعِ بازارِ دست دوم
  const { data, isLoading: loading, error, mutate: fetchCards } =
    useSWR('/api/admin/healthcards', CONTENT_TTL);
  const cards = data?.cards || [];

  useEffect(() => {
    if (error) showToast.error('خطا در بارگذاری');
  }, [error]);

  const handleDelete = async (card) => {
    const ok = await confirmDelete('حذف HealthCard', `آیا مطمئنید؟ "${card.category?.title}" حذف می‌شود.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/healthcards/${card._id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCards(
          (cur) => cur && { ...cur, cards: (cur.cards || []).filter(c => c._id !== card._id) },
          { revalidate: false },
        );
        showToast.success('حذف شد');
      }
    } catch {
      showToast.error('خطا در حذف');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <FiLayers size={24} className="text-[var(--color-primary)]" />
          <h1 className="text-2xl font-bold">مدیریت کارت های سلامت</h1>
        </div>
        {can('healthCards.create') && (
        <Link
          href="/p-admin/admin-secondHands/healthcards/create"
          className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-5 py-2.5 rounded-[var(--radius)] text-sm font-bold hover:opacity-90 transition-all"
        >
          <FiPlus /> ایجاد جدید
        </Link>
        )}
      </div>

      {loading ? (
        <AdminLoader />
      ) : cards.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-neutral-200 rounded-[var(--radius)] text-neutral-400">
          هیچ HealthCard ای ثبت نشده است
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(card => (
            <div key={card._id} className="flex items-center justify-between bg-white border border-neutral-200 rounded-[var(--radius)] px-5 py-4 hover:shadow-md transition-all">
              <div>
                <p className="font-bold text-neutral-800">{card.category?.title || '—'}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{card.fields?.length || 0} فیلد ارزیابی</p>
              </div>
              {(can('healthCards.edit') || can('healthCards.delete')) && (
              <div className="flex gap-2">
                {can('healthCards.edit') && (
                <Link
                  href={`/p-admin/admin-secondHands/healthcards/${card._id}/edit`}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                >
                  <FiEdit3 size={16} />
                </Link>
                )}
                {can('healthCards.delete') && (
                <button
                  onClick={() => handleDelete(card)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <FiTrash2 size={16} />
                </button>
                )}
              </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}