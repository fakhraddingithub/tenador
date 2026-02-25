'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiPlus, FiEdit3, FiTrash2, FiLayers } from 'react-icons/fi';
import { showToast } from '@/lib/toast';
import { confirmDelete } from '@/lib/swal';

export default function HealthCardsPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCards(); }, []);

  const fetchCards = async () => {
    try {
      const res = await fetch('/api/admin/healthcards');
      const data = await res.json();
      setCards(data.cards || []);
    } catch {
      showToast.error('خطا در بارگذاری');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (card) => {
    const ok = await confirmDelete('حذف HealthCard', `آیا مطمئنید؟ "${card.category?.title}" حذف می‌شود.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/healthcards/${card._id}`, { method: 'DELETE' });
      if (res.ok) {
        setCards(prev => prev.filter(c => c._id !== card._id));
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
        <Link
          href="/p-admin/admin-secondHands/healthcards/create"
          className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-5 py-2.5 rounded-[var(--radius)] text-sm font-bold hover:opacity-90 transition-all"
        >
          <FiPlus /> ایجاد جدید
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-neutral-100 animate-pulse rounded-[var(--radius)]" />)}
        </div>
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
              <div className="flex gap-2">
                <Link
                  href={`/p-admin/admin-secondHands/healthcards/${card._id}/edit`}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                >
                  <FiEdit3 size={16} />
                </Link>
                <button
                  onClick={() => handleDelete(card)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}