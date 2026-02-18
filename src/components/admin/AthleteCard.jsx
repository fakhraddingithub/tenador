'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function AthleteCard({ athlete, onDelete }) {
  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
      <div className="aspect-w-16 aspect-h-9 bg-gray-100">
        {athlete.photo ? (
          <Image
            src={athlete.photo}
            alt={athlete.name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 flex items-center justify-center text-gray-400">
            بدون تصویر
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{athlete.name}</h3>
        <div className="space-y-1 mb-4">
          <p className="text-sm text-gray-500">
            <span className="font-medium">ورزش:</span> {athlete.sport?.name || '-'}
          </p>
          <p className="text-sm text-gray-500">
            <span className="font-medium">ملیت:</span> {athlete.nationality || '-'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/p-admin/admin-athletes/edit/${athlete._id}`}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            ویرایش
          </Link>
          <button
            onClick={() => onDelete(athlete._id)}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}
