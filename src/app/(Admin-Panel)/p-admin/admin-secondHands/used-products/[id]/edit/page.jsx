'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import UsedProductForm from '@/components/admin/UsedProductForm';
import AdminLoader from '@/components/admin/AdminLoader';

export default function EditUsedProductPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/used-products/${id}`)
      .then(r => r.json())
      .then(d => setItem(d.item))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <AdminLoader fullScreen />;
  if (!item) return <div className="flex items-center justify-center min-h-screen text-red-400">یافت نشد</div>;

  return <UsedProductForm initialData={item} />;
}