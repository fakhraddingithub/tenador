'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import HealthCardForm from '@/components/admin/HealthCardForm';

export default function EditHealthCardPage() {
  const { id } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/healthcards/${id}`)
      .then(r => r.json())
      .then(d => setCard(d.card))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-neutral-400">در حال بارگذاری...</div>;
  if (!card) return <div className="flex items-center justify-center min-h-screen text-red-400">یافت نشد</div>;

  return <HealthCardForm initialData={card} categoryLocked />;
}