'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FaArrowRight, FaHandshake, FaEdit, FaLayerGroup, FaBoxOpen,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

/**
 * صفحه جزئیات همکاری — تمام محصولات عضو این همکاری در همه سری‌ها،
 * گروه‌بندی‌شده بر اساس سری
 */
export default function CollaborationDetailPage() {
  const { collaborationId } = useParams();

  const [collaboration, setCollaboration] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collaborationId) return;

    const fetchData = async () => {
      try {
        const [collabRes, productsRes] = await Promise.all([
          fetch(`/api/collaborations/${collaborationId}`),
          fetch(`/api/product?isAdmin=true&collaboration=${collaborationId}`),
        ]);

        const [collabData, productsData] = await Promise.all([
          collabRes.json(),
          productsRes.json(),
        ]);

        if (!collabRes.ok) {
          toast.error(collabData.error || 'خطا در دریافت اطلاعات همکاری');
          return;
        }

        setCollaboration(collabData.collaboration);
        setProducts(productsData.products || []);
      } catch {
        toast.error('خطا در بارگذاری اطلاعات');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collaborationId]);

  // گروه‌بندی محصولات بر اساس سری
  const groupedBySerie = useMemo(() => {
    const groups = new Map();

    for (const product of products) {
      const serieId = product.serie?._id || 'no-serie';
      if (!groups.has(serieId)) {
        groups.set(serieId, {
          serie: product.serie || null,
          products: [],
        });
      }
      groups.get(serieId).products.push(product);
    }

    return Array.from(groups.values());
  }, [products]);

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-black/10 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (!collaboration) {
    return (
      <div className="py-20 text-center text-gray-400 font-bold">
        همکاری مورد نظر یافت نشد
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div>
        <Link
          href="/p-admin/admin-events/collaborations"
          className="inline-flex items-center gap-1.5 text-xs font-bold mb-4 hover:gap-2.5 transition-all"
          style={{ color: 'var(--color-primary)' }}
        >
          <FaArrowRight size={11} /> بازگشت به همکاری‌ها
        </Link>

        <div
          className="relative bg-white rounded-3xl border border-gray-100 overflow-hidden"
        >
          {/* نوار رنگی همکاری */}
          <div
            className="h-2 w-full"
            style={{
              background: `linear-gradient(to left, ${collaboration.colors?.primary || 'var(--color-primary)'}, ${collaboration.colors?.secondary || 'var(--color-secondary)'})`,
            }}
          />

          <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center overflow-hidden p-3">
                {collaboration.logo || collaboration.image ? (
                  <img
                    src={collaboration.logo || collaboration.image}
                    alt={collaboration.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <FaHandshake size={28} className="text-gray-200" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{collaboration.title}</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mt-1">
                  {collaboration.name}
                </p>
                {collaboration.description && (
                  <p className="text-xs text-gray-500 mt-3 max-w-xl leading-6">
                    {collaboration.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-400 bg-gray-50 border border-gray-100 px-4 py-2 rounded-full">
                {products.length} محصول در {groupedBySerie.length} گروه
              </span>
              <Link
                href={`/p-admin/admin-events/collaborations/edit/${collaboration._id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-xs font-bold bg-gray-900 text-white hover:bg-black transition-all"
              >
                <FaEdit size={12} /> ویرایش همکاری
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Products grouped by serie */}
      {products.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-200">
            <FaBoxOpen size={28} />
          </div>
          <p className="text-gray-400 font-bold">هنوز محصولی به این همکاری اختصاص داده نشده</p>
          <p className="text-xs text-gray-400 mt-2">
            از صفحه ساخت/ویرایش محصول، فیلد «همکاری» را برای محصولات مورد نظر انتخاب کنید.
          </p>
        </div>
      ) : (
        groupedBySerie.map((group, gi) => (
          <motion.section
            key={group.serie?._id || 'no-serie'}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.05, duration: 0.3 }}
            className="bg-white rounded-3xl border border-gray-100 p-6"
          >
            {/* Serie header */}
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-5">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-[var(--color-primary)]">
                <FaLayerGroup size={16} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">
                  {group.serie ? `سری ${group.serie.title || group.serie.name}` : 'بدون سری'}
                </h2>
                {group.serie?.name && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300">
                    {group.serie.name}
                  </p>
                )}
              </div>
              <span className="mr-auto text-[11px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">
                {group.products.length} محصول
              </span>
            </div>

            {/* Products */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {group.products.map((product) => (
                <Link
                  key={product._id}
                  href={`/p-admin/admin-products/edit/${product._id}`}
                  className="group border border-gray-100 rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gray-50/40"
                >
                  <div className="h-32 flex items-center justify-center mb-3 overflow-hidden">
                    {product.mainImage ? (
                      <img
                        src={product.mainImage}
                        alt={product.name}
                        className="max-h-full object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <FaBoxOpen size={30} className="text-gray-200" />
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 line-clamp-2 leading-6 group-hover:text-[var(--color-primary)] transition-colors">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    {product.brand?.name && (
                      <span className="text-[10px] font-bold text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-full">
                        {product.brand.name}
                      </span>
                    )}
                    {!product.isActive && (
                      <span className="text-[10px] font-bold text-red-400 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                        غیرفعال
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        ))
      )}
    </div>
  );
}
