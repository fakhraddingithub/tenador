import Swal from 'sweetalert2';

export const confirmCategoryDelete = async (category) => {
  if (!category?.slug) return null;
  const content = document.createElement('div');
  content.dir = 'rtl';
  const warning = document.createElement('p');
  warning.textContent = `دسته‌بندی «${category.title}» و تمام محصولات و واریانت‌های آن برای همیشه حذف می‌شوند؛ حتی محصولات غیرفعال و محصولات نمایش‌داده‌شده در ورزش‌های مشترک.`;
  const slug = document.createElement('p');
  slug.textContent = category.slug;
  slug.dir = 'ltr';
  slug.style.cssText = 'user-select:text;font-family:monospace;overflow-wrap:anywhere;margin-top:16px';
  content.append(warning, slug);
  const result = await Swal.fire({
    title: 'حذف دسته‌بندی و محصولات',
    html: content,
    icon: 'warning',
    input: 'text',
    inputLabel: 'برای تأیید، اسلاگ بالا را وارد کنید',
    inputAttributes: { dir: 'ltr', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' },
    inputValidator: (value) => value.trim() === category.slug ? undefined : 'اسلاگ واردشده با اسلاگ دسته‌بندی مطابقت ندارد',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'حذف دسته‌بندی و محصولات',
    cancelButtonText: 'انصراف',
    reverseButtons: true,
  });
  return result.isConfirmed ? result.value.trim() : null;
};

export const confirmDelete = async (title = 'آیا مطمئن هستید؟', text = 'این عمل قابل بازگشت نیست') => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'بله، حذف کن',
    cancelButtonText: 'انصراف',
    reverseButtons: true,
  });
  return result.isConfirmed;
};

export const showSuccess = (title, text = '') => {
  return Swal.fire({
    title,
    text,
    icon: 'success',
    confirmButtonColor: '#2563eb',
    confirmButtonText: 'باشه',
  });
};

export const showError = (title, text = '') => {
  return Swal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonColor: '#dc2626',
    confirmButtonText: 'باشه',
  });
};
