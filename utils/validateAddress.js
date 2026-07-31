export const validateAddress = (data) => {
    if (!data.title?.trim()) return 'عنوان آدرس الزامی است';
    if (!data.fullName?.trim()) return 'نام و نام خانوادگی الزامی است';
    if (!/^09\d{9}$/.test(data.phone)) return 'شماره موبایل معتبر نیست';
    if (!data.city?.trim()) return 'شهر الزامی است';
    if (!data.addressLine?.trim()) return 'آدرس کامل الزامی است';
    return null;
  };
