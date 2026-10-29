'use client';

import { FiTag } from 'react-icons/fi';
import Textarea from '@/components/admin/Textarea';

/**
 * قاعده‌ی AI برای انتخابِ آیتم‌های تب سفارشی — مشترکِ فرم‌های افزودن/ویرایشِ دسته.
 * در پرامپتِ ساختِ محصول «قاعده‌ی اختصاصیِ دسته»ی فیلدِ customTabItems است
 * (بعد از پرامپت پایه)؛ راهنمای هر آیتم جدا، کنارِ عنوانِ همان آیتم می‌آید.
 */
export default function CustomTabPromptField({ value, onChange }) {
  return (
    <div className="p-5 bg-purple-50/40 border border-purple-100 rounded-[var(--radius)] space-y-3">
      <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
        <FiTag size={16} />
        قاعده‌ی هوش مصنوعی برای انتخاب آیتم‌های این تب
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="به AI بگویید آیتم‌های این تب را برای هر محصول چگونه انتخاب کند؛ مثلاً: فقط تکنولوژی‌هایی را انتخاب کن که نامشان در متن محصول آمده است."
        rows={3}
      />
      <p className="text-[11px] text-neutral-500 leading-5">
        * برای راهنمای یک آیتمِ خاص، «راهنمای انتخاب» همان آیتم را پر کنید. اگر هیچ‌کدام پر نشود، AI مثل قبل فقط از روی عنوان‌ها انتخاب می‌کند.
      </p>
    </div>
  );
}
