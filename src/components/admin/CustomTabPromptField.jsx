'use client';

import { FiTag } from 'react-icons/fi';
import Textarea from '@/components/admin/Textarea';

export const EMPTY_TAB_PROMPTS = { prompt: '', titlePrompt: '', descriptionPrompt: '' };

/** سه پرامپتِ تب از دسته‌ی ذخیره‌شده (یا کپیِ آن) */
export const tabPromptsOf = (customTab) => ({
  prompt: customTab?.prompt || '',
  titlePrompt: customTab?.titlePrompt || '',
  descriptionPrompt: customTab?.descriptionPrompt || '',
});

const FIELDS = [
  {
    key: 'prompt',
    label: 'قاعده‌ی هوش مصنوعی برای انتخاب آیتم‌های این تب',
    placeholder: 'مثلاً: فقط تکنولوژی‌هایی را انتخاب کن که نامشان در متن محصول آمده است.',
  },
  {
    key: 'titlePrompt',
    label: 'قاعده‌ی ساختِ عنوانِ هر آیتم برای محصول',
    placeholder: 'مثلاً: نام تکنولوژی را نگه دار و در چند کلمه بگو در این راکت چه می‌کند.',
  },
  {
    key: 'descriptionPrompt',
    label: 'قاعده‌ی ساختِ توضیحاتِ هر آیتم برای محصول',
    placeholder: 'مثلاً: در دو جمله توضیح بده این تکنولوژی در همین محصول چه فایده‌ای برای بازیکن دارد.',
  },
];

/**
 * سه قاعده‌ی AI برای تب سفارشی — مشترکِ فرم‌های افزودن/ویرایشِ دسته. در پرامپتِ ساختِ
 * محصول «قاعده‌ی اختصاصیِ دسته»ی سه فیلدند (بعد از پرامپت پایه و گروه‌ها):
 * customTabItems (انتخاب)، customTabTitles و customTabDescriptions.
 *
 * @param {{ value: typeof EMPTY_TAB_PROMPTS, onChange: (key: string, text: string) => void }} props
 */
export default function CustomTabPromptField({ value, onChange }) {
  return (
    <div className="p-5 bg-purple-50/40 border border-purple-100 rounded-[var(--radius)] space-y-4">
      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-2">
          <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
            <FiTag size={16} />
            {field.label}
          </div>
          <Textarea
            value={value?.[field.key] || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
          />
        </div>
      ))}
      <p className="text-[11px] text-neutral-500 leading-5">
        * هوش مصنوعی هنگامِ ساخت و بازتولیدِ محصول، برای هر آیتمی که انتخاب می‌کند عنوان و توضیحاتِ مخصوصِ همان محصول را می‌نویسد.
        اگر برای آیتمی عنوان یا توضیحی ساخته نشود، در صفحه‌ی محصول همان عنوان و توضیحِ دستیِ آیتم (پایین) نمایش داده می‌شود.
      </p>
    </div>
  );
}
