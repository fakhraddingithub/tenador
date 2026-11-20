'use client';

import { CUSTOM_TAB_TEXT_LIMITS } from '@/lib/customTabTexts';

const fieldClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none ' +
  'focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 disabled:bg-neutral-100';

/**
 * آیتم‌های تب سفارشیِ دسته برای یک محصول — مشترکِ فرم‌های ساخت و ویرایشِ محصول.
 * تیکِ هر آیتم = انتخاب (customTabItems، با عنوانِ آیتم). زیرِ آیتمِ انتخاب‌شده عنوان و توضیحاتِ
 * مخصوصِ همین محصول (customTabTitles / customTabDescriptions، با عنوانِ آیتم) نوشته می‌شود؛ خالی
 * یعنی صفحه‌ی محصول متنِ دستیِ آیتم را نشان می‌دهد، که همین‌جا placeholder است.
 *
 * @param {{
 *   tab: { items: Array<{ _id, title, description }> },
 *   selected: string[], titles: Record<string,string>, descriptions: Record<string,string>,
 *   onChange: (patch: { customTabItems?, customTabTitles?, customTabDescriptions? }) => void,
 *   errors?: Record<string,string>, disabled?: boolean,
 * }} props
 */
export default function CustomTabItemsField({ tab, selected = [], titles, descriptions, onChange, errors = {}, disabled = false }) {
  const titleMap = isMap(titles) ? titles : {};
  const descriptionMap = isMap(descriptions) ? descriptions : {};
  const setText = (key, map, title, text) => onChange({ [key]: { ...map, [title]: text } });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
        {(tab?.items || []).map((item) => {
          const checked = selected.includes(item.title);
          return (
            <div key={item._id || item.title} className={`rounded-lg border p-2.5 text-sm ${checked ? 'border-[var(--color-primary)]/40 bg-white' : 'border-neutral-200 bg-neutral-50'}`}>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({
                      customTabItems: e.target.checked
                        ? [...selected, item.title]
                        : selected.filter((t) => t !== item.title),
                    })
                  }
                />
                <span className="truncate font-bold">{item.title}</span>
              </label>
              {checked && (
                <div className="mt-2.5 space-y-2">
                  <input
                    dir="auto"
                    className={fieldClass}
                    value={titleMap[item.title] || ''}
                    maxLength={CUSTOM_TAB_TEXT_LIMITS.title}
                    disabled={disabled}
                    onChange={(e) => setText('customTabTitles', titleMap, item.title, e.target.value)}
                    placeholder={`عنوان برای این محصول — خالی: «${item.title}»`}
                    aria-label={`عنوانِ «${item.title}» برای این محصول`}
                  />
                  <textarea
                    dir="auto"
                    rows={3}
                    className={`${fieldClass} resize-y leading-6`}
                    value={descriptionMap[item.title] || ''}
                    maxLength={CUSTOM_TAB_TEXT_LIMITS.description}
                    disabled={disabled}
                    onChange={(e) => setText('customTabDescriptions', descriptionMap, item.title, e.target.value)}
                    placeholder={item.description ? `توضیحات برای این محصول — خالی: «${item.description}»` : 'توضیحات برای این محصول (آیتم توضیحِ پیش‌فرض ندارد)'}
                    aria-label={`توضیحاتِ «${item.title}» برای این محصول`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {['customTabItems', 'customTabTitles', 'customTabDescriptions'].map((key) =>
        errors[key] ? <p key={key} className="text-xs font-bold text-red-500">! {errors[key]}</p> : null,
      )}
    </div>
  );
}

const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
