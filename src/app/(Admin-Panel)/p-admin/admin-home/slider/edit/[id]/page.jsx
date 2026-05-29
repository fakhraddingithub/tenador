'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SlideForm from '@/components/admin/SlideForm';

export default function EditSlide() {
  const { id } = useParams();
  const [slide, setSlide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/slides/${id}`)
      .then((r) => r.json())
      .then((d) => setSlide(d.slide || d))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  return <SlideForm mode="edit" slideId={id} initialData={slide || {}} />;
}