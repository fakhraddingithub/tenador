'use client';

/**
 * الگوی مشترک هدر صفحه (پنل ادمین)
 * - عنوان + توضیح در سمت راست
 * - دکمه‌های اکشن اصلی در «بالا-چپ» (پیش‌فرض هماهنگ در همه‌ی صفحه‌ها)
 * - در موبایل، اکشن‌ها تمام‌عرض می‌شوند
 *
 * استفاده:
 *   <PageHeader
 *      title="محصولات"
 *      subtitle="مدیریت محصولات فروشگاه"
 *      actions={<Button>افزودن محصول</Button>}
 *   />
 */
export default function PageHeader({ title, subtitle, actions = null, icon = null, children = null }) {
  return (
    <div className="a-page-header">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span
            className="inline-flex items-center justify-center w-9 h-9 flex-shrink-0"
            style={{
              borderRadius: 'var(--admin-radius)',
              background: 'var(--color-primary-soft)',
              color: 'var(--color-primary)',
            }}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="a-page-title truncate">{title}</h1>
          {subtitle && <p className="a-page-subtitle truncate">{subtitle}</p>}
        </div>
      </div>
      {(actions || children) && (
        <div className="a-page-actions">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}
