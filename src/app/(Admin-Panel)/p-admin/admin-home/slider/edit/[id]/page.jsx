'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SlideForm from '@/components/admin/SlideForm';
import AdminLoader from '@/components/admin/AdminLoader';

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
    return <AdminLoader />;
  }

  return <SlideForm mode="edit" slideId={id} initialData={slide || {}} />;
}